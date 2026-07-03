import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"
import { subtle } from "crypto"
import "dotenv/config"
import { BuildCmd, ConfigCmd, decode, Item, PREFIX } from "dsabp-js"
import { BpRenderer, setImagesPath } from "dsabp-js-img"
import { renderFile as ejsFile } from "ejs"
import { express as hyperexpress, Response } from "hyper-express"
import { rateLimit } from "hyper-express-rate-limit"
import DOMPurify from "isomorphic-dompurify"
import LiveDirectory from "live-directory"
import { open as lmdb } from "lmdb"
import { parse as marked } from "marked"
import { dirname, join } from "path"
import sjson from "secure-json-parse"
import { Readable } from "stream"
import { fileURLToPath } from "url"
import * as dbUtil from "./dbUtil.js"
import { initUdpServer } from "./udpServer.js"

/* env read & checks */
const ENV = process.env.ENV?.toLowerCase() == "prod" ? "prod" : "dev"
const isDev = ENV == "dev"
const PORT = parseInt(process.env.DEV_PORT ?? "80")
const IS_FIRST_INSTANCE = process.env.NODE_APP_INSTANCE ?? "0" == "0" // for pm2 clusters

if (!process.env.DB_PATH) {
	console.error("db path required")
	process.exit(1)
}
const CLOUDINARY_CONFIG = {
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
}
if (!CLOUDINARY_CONFIG.cloud_name || !CLOUDINARY_CONFIG.api_key || !CLOUDINARY_CONFIG.api_secret) {
	console.error("cloudinary credentials required")
	process.exit(1)
}
const GOATCOUNTER_URL = process.env.GOATCOUNTER_URL
//

/* constants */
const DB_KEY = { // data that must be synced between processes
	GLOBAL_STATS: "globalStats",
	LIVE_MIN: "liveMinutes"
}

// used for hashing to generate a cloudinary image id for each blueprint
const GAME_VERSION = "07f2ca264b6c837f0aba304ea0101ac0a53b3fbf"
const IMG_HASH_VERSION = "1"

const regexPackaged = / ?\(Packaged\)|, Packaged/g
const __dirname = dirname(fileURLToPath(import.meta.url))
const TxtEncdr = new TextEncoder()
export const exitFunctions: Array<() => Promise<void>> = []

const globalStatsDefaults: GlobalStats = {
	count: 0,
	bytesStr: 0,
	bytesDesc: 0,
	bytesImg: 0,
	views: 0,
	cmdsBuild: 0,
	cmdsConfig: 0,
	items: null,
	itemsTotal: 0,
	renderTime: [] as any,
	liveTime: [] as any
}

const cooldowns = { views: new Set() }

/* init */
export const server = hyperexpress({
	...(process.env.SSL_CERT_FILE ? {
		cert_file_name: process.env.SSL_CERT_FILE,
		key_file_name: process.env.SSL_KEY_FILE,
	} : null),
})

if (IS_FIRST_INSTANCE) initUdpServer(server)

export const DB = lmdb({
	path: process.env.DB_PATH,
	compression: true,
	encoding: "msgpack"
})
export const BpDB = DB.openDB({ name: "bp" })

await DB.ifNoExists(DB_KEY.GLOBAL_STATS, () => DB.put(DB_KEY.GLOBAL_STATS, globalStatsDefaults))
updateGlobalStats()

setImagesPath(abs("game-images/"))
export const renderer = new BpRenderer()
renderer.squareSize = 30

cloudinary.config(CLOUDINARY_CONFIG)

/* middlwares / routes */
server.use(rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isDev ? 10000 : 4000,
	standardHeaders: "draft-7",
	legacyHeaders: false
}))

server.set_error_handler((req, res, err) => {
	const time = Date.now()
	console.error(`\nUncaught Server Error (${time} ${req.url})\n`, err)
	res.status(500).send(`Unexpected server error. Please report with: ${time}`)
})

server.use((req, res, next) => { // redirect for trailing slashes
	if (req.path.length > 1 && req.path.slice(-1) == "/") {
		return res.redirect(req.path.slice(0, -1).replace(/\/+/g, "/") // safe path
			+ req.url.slice(req.path.length) // query
		)
	}
	next()
})

server.get("/p", async (req, res) => {
	const fetchRes = await fetch(
		Object.keys(req.query_parameters)[0]
	).catch(err => console.error("Proxy error", req.query_parameters, err))

	if (!fetchRes)
		return res.status(502).json({ error: "failed to fetch" })
	res.header("Access-Control-Allow-Origin", "*").stream(Readable.fromWeb(fetchRes.body as any))
})

if (GOATCOUNTER_URL) {
	server.post("/a", async (req, res) => {
		const url = new URL("https://" + req.hostname + req.originalUrl)
		url.hostname = new URL(GOATCOUNTER_URL).hostname
		url.pathname = "/count"
		req.headers["host"] = new URL(GOATCOUNTER_URL).hostname
		req.headers["x-forwarded-proto"] = "https"
		req.headers["x-forwarded-for"] = req.ip
		req.headers["x-real-ip"] = req.ip
		delete req.headers["connection"]
		await fetch(url, req).catch(console.error)
		res.status(200).send()
	})
}

server.get("/bpeditor2", (req, res) => res.redirect("/bpeditor"))
server.get("/tn", (req, res) => res.sendFile(abs("tn.png")))

server.get("/bpbin/stats",
	rateLimit({ windowMs: 10 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }),
	async (req, res) => {
		sendRenderedEjs(res, "../../client/dist/bpbin/stats.ejs", DB.get(DB_KEY.GLOBAL_STATS))
	}
)

server.get("/bpbin/:id",
	rateLimit({ windowMs: 10 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false }),
	async (req, res) => {
		const id = req.path_parameters.id.toLowerCase()
		if (!/^[a-z0-9]{6}$/.test(id))
			return res.status(404).send("Paste not found.")

		const viewData: any = {}
		const data = dbUtil.get(id.toLowerCase())

		if (data) {
			if (!cooldowns.views.has(req.ip) && !req.headers["user-agent"]?.includes("Discordbot")) {
				cooldowns.views.add(req.ip)
				setTimeout(() => cooldowns.views.delete(req.ip), 2 * 60 * 1000)
				++data.views

				const gstats = DB.get(DB_KEY.GLOBAL_STATS)
				++gstats.views
				DB.put(DB_KEY.GLOBAL_STATS, gstats)
				dbUtil.set(id, data)
			}

			viewData.title = data.title
			viewData.str = PREFIX + data.str
			if (data.desc)
				viewData.desc = DOMPurify.sanitize(await marked(data.desc), { IN_PLACE: false })
			if (data.img)
				viewData.imgUrl = `https://res.cloudinary.com/dbp/image/upload/v${Date.now()}/${data.img}.webp`
			viewData.views = data.views
			viewData.date = data.date
			viewData.ver = data.bpInfo.ver
			viewData.width = data.bpInfo.w
			viewData.turretWidth = Math.trunc((data.bpInfo.w - 2) / 3 * 10) / 10
			viewData.height = data.bpInfo.h
			viewData.turretHeight = Math.trunc((data.bpInfo.h - 2) / 3 * 10) / 10

			viewData.itemsTotal = 0
			const allItems: Record<string, { name: string, img: string, amount: number }> = {}
			for (const id in data.bpInfo.items) {
				const item = Item.getById(parseInt(id))
				allItems[id] = {
					name: item.name.replace(regexPackaged, ""),
					img: item.image.substring("item/".length),
					amount: data.bpInfo.items[id]
				}
				viewData.itemsTotal += allItems[id].amount
			}
			viewData.items = Object.values(allItems).sort((a, b) => b.amount - a.amount)
		}

		sendRenderedEjs(res, "../../client/dist/bpbin/view/index.ejs", viewData)
	}
)

server.post("/bpbin/new",
	rateLimit({ windowMs: 10 * 1000, limit: 2, standardHeaders: "draft-7", legacyHeaders: false }),
	async (req, res) => {
		try {
			const data: BpBinData = await (async () => {
				try {
					return sjson.parse(await req.text())
				} catch (err) {
					console.error(err)
					return null
				}
			})()

			if (data == null || !data.title || !data.str)
				return res.status(400).json({ error: "Invalid request body." })

			if (data.title.length > 128)
				return res.status(400).json({ error: "Too long title." })

			if (data.desc?.length > 32768)
				return res.status(400).json({ error: "Too long description." })

			if (data.str.length < 4 || data.str.length > 20480)
				return res.status(400).json({ error: "Too long or short blueprint string." })

			data.iphash = await hashData(req.ip, 8)
			data.date = Date.now()
			data.title = data.title.trim()
			data.str = data.str.trim().replace(/^:+/, "")

			if (data.str.substring(0, PREFIX.length).toUpperCase() == PREFIX)
				data.str = data.str.substring(PREFIX.length)

			if (data.desc) {
				data.desc = data.desc.trim()
				if (data.desc == "")
					delete data.desc
			}

			const bp = await decode(data.str).catch(() => { })

			if (!bp)
				return res.status(400).json({ error: "Invalid blueprint string." })

			data.views = 0
			data.bpInfo = {
				ver: bp.version,
				w: bp.width,
				h: bp.height,
				cmds: {
					b: 0,
					c: 0
				},
				items: {}
			}

			bp.commands.forEach(cmd => {
				if (cmd instanceof BuildCmd) {
					++data.bpInfo.cmds.b
					const count = cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1
					data.bpInfo.items[cmd.item.id] = (data.bpInfo.items[cmd.item.id] ?? 0) + count
				} else if (cmd instanceof ConfigCmd) {
					++data.bpInfo.cmds.c
				}
			})

			data.img = await hashData(data.str + IMG_HASH_VERSION + GAME_VERSION + renderer.squareSize, 6)

			console.log("rendering", data.title, data.img)
			data.renderTime = await renderer.render(bp, 1)
			console.log("finished render in ", data.renderTime)

			const cldResult = await cldUploadStream(
				data.img,
				renderer.canvasOut.toBuffer("image/png")
			).catch(console.error) as UploadApiResponse

			data.imgSize = cldResult.bytes
			const result = await dbUtil.create(data)
			updateGlobalStats()

			if (cldResult && result) {
				return res.status(201).json({ message: "success", id: result.id })
			} else {
				console.error("cldResult or result is falsy", cldResult, result)
				return res.status(500).json({ error: "unexpected server error" })
			}
		} catch (err) {
			console.error(err)
			return res.status(500).json({ error: "unexpected server error" })
		}
	}
)

const publicDir = new LiveDirectory(abs("../../client/dist/"), {
	static: false,
	cache: { max_file_count: 0, max_file_size: 0 }
})
server.get("/*", (req, res) => {
	const path = req.path.substring(1),
		file = publicDir.get(path + (req.path.includes(".") ? "" : `${path.endsWith("/") ? "" : "/"}index.html`))

	if (!file)
		return res.status(404).send()

	const parts = file.path.split("."),
		ext = parts[parts.length - 1]

	res.type(ext).header("Access-Control-Allow-Origin", "*")

	return file.cached
		? res.send(file.content)
		: res.stream(file.stream(), file.stats.size)
})

await server.listen(PORT)
	.then(() => console.log("Listening :" + PORT))
	.catch(err => console.error("Error serving", err))

/* update live min stat */
if (IS_FIRST_INSTANCE) {
	setInterval(async () => {
		await DB.ifNoExists(DB_KEY.LIVE_MIN, () => DB.put(DB_KEY.LIVE_MIN, 0))
		const curr = DB.get(DB_KEY.LIVE_MIN) + 1
		DB.put(DB_KEY.LIVE_MIN, curr)
		updateLiveTimeStat(curr)
	}, 60 * 1000)
}

/* functions */
export async function updateGlobalStats() {
	console.log("Current blueprint IDs:", (await BpDB.getKeys().asArray).join(", "))
	const stats = DB.get(DB_KEY.GLOBAL_STATS) as GlobalStats
	Object.assign(stats, globalStatsDefaults)
	updateLiveTimeStat()

	let renderTimeMs = 0
	const allItems: Record<string, { name: string, img: string, amount: number }> = {}

	const transaction = BpDB.useReadTransaction()
	for (const { value: bp } of BpDB.getRange({ transaction })) {
		++stats.count
		stats.bytesStr += TxtEncdr.encode(bp.str).length
		stats.bytesDesc += TxtEncdr.encode(bp.title).length
		if (bp.desc) stats.bytesDesc += TxtEncdr.encode(bp.desc).length
		stats.bytesImg += bp.imgSize
		stats.views += bp.views
		stats.cmdsBuild += bp.bpInfo.cmds.b
		stats.cmdsConfig += bp.bpInfo.cmds.c
		for (const id in bp.bpInfo.items) {
			const item = Item.getById(parseInt(id))
			if (!Object.hasOwn(allItems, id))
				allItems[id] = { name: item.name.replace(regexPackaged, ""), img: item.image!.substring("item/".length), amount: 0 }
			allItems[id].amount += bp.bpInfo.items[id]
			stats.itemsTotal += allItems[id].amount
		}
		renderTimeMs += bp.renderTime
	}
	transaction.done()

	stats.items = Object.values(allItems).sort((a, b) => b.amount - a.amount)
	const totalSeconds = renderTimeMs / 1000
	stats.renderTime[0] = Math.floor(totalSeconds / 60)
	stats.renderTime[1] = totalSeconds % 60

	DB.put(DB_KEY.GLOBAL_STATS, stats)
}

function updateLiveTimeStat(mins = DB.get(DB_KEY.LIVE_MIN)) {
	const stats = DB.get(DB_KEY.GLOBAL_STATS)
	stats.liveTime[0] = Math.floor(mins / (60 * 24))
	stats.liveTime[1] = parseFloat(((mins % (60 * 24)) / 60).toFixed(1))
	DB.put(DB_KEY.GLOBAL_STATS, stats)
}

export function cldUploadStream(id: string, buffer: ArrayBufferLike): Promise<UploadApiResponse> {
	return new Promise((res, rej) => {
		cloudinary.uploader.upload_stream(
			{ public_id: id, overwrite: true, format: "webp" },
			(err, result) => {
				if (err) return rej(err)
				res(result!)
			}
		).end(buffer)
	})
}

function sendRenderedEjs(res: Response, relPath: string, data: unknown) {
	return ejsFile(abs(relPath), data, {}, (err: unknown, str: string) => {
		if (err) throw err
		else res.type("html").send(str)
	}), res
}

async function hashData(input: string, length?: number) {
	return Array.from(new Uint8Array(await subtle.digest("SHA-1", TxtEncdr.encode(input))))
		.map(byte => byte.toString(16).padStart(2, "0")).join("")
		.substring(0, length)
}

function abs(relPath: string) {
	return join(__dirname, relPath)
}

/* exit functions */
process.on(isDev ? "SIGINT" : "SIGTERM", async () =>
	await Promise.all(exitFunctions.map(fn => fn())).then(() => process.exit(0)).catch(() => process.exit(1))
)

/* gracefully close DB */
exitFunctions.push(() =>
	DB.close().then(() => console.info("Database closed."))
)

/* http redirect */
if (PORT != 80) {
	const server = hyperexpress()
	server.all("*", (req, res) => res.status(301).redirect(`https://${req.header("host")}${req.url}`))
	server.listen(80)
}

/* types */
type GlobalStats = { count: number, bytesStr: number, bytesDesc: number, bytesImg: number, views: number, cmdsBuild: number, cmdsConfig: number, itemsTotal: number, items: { name: string, img: string, amount: number }[], renderTime: [number, number], liveTime: [number, number] }
type BpBinData = { iphash: string; str: string; title: string; desc?: string; date: number; views: number; img: string; imgSize: number; renderTime: number; bpInfo: { ver: number; w: number; h: number; cmds: { b: number; c: number }; items: { [s: string]: number } } }

/* some scripts to quickly run when needed */

/* if (IS_FIRST_INSTANCE) {
	cloudinary.api.delete_all_resources().then(console.log)
} */

/* setTimeout(async function RERENDER_ALL_BLUEPRINTS() {
	console.log("started")
	const transaction = BpDB.useReadTransaction()
	for (const { key: id, value: data } of BpDB.getRange({ transaction })) {
		console.log("processing", id, data.img, data.renderTime)
		const bp = await decode(data.str)
		data.renderTime = await renderer.render(bp, 1)
		const cldResult = await cldUploadStream(data.img, renderer.canvasOut.toBuffer("image/png"))
		data.imgSize = cldResult.bytes
		console.log("done", data.renderTime, !!cldResult)
		dbUtil.set(id, data)
		await new Promise(r => setTimeout(r, 1000))
	}
	transaction.done()
	console.log("all done.")
	updateGlobalStats()
}, 3000) */

/* setTimeout(async function EDIT_BLUEPRINT() {
	const id = "".toLowerCase() // Target BP ID
	const data = await dbUtil.get(id)
	if (!data)
		return console.error("no bp by id " + id)

	if (data.desc) {
		// data.desc = 
	}

	let newStr = ""
	if (newStr != "") {
		data.str = newStr.trim().replace(/^:+/, "")
		if (data.str.substring(0, PREFIX.length).toUpperCase() == PREFIX)
			data.str = data.str.substring(PREFIX.length)

		const bp = await decode(data.str).catch(() => { })
		if (!bp)
			return console.error("new str is not valid bp")
		data.bpInfo = {
			ver: bp.version,
			w: bp.width,
			h: bp.height,
			cmds: { b: 0, c: 0 },
			items: {}
		}
		bp.commands.forEach(cmd => {
			if (cmd instanceof BuildCmd) {
				++data.bpInfo.cmds.b
				const count = cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1
				data.bpInfo.items[cmd.item.id] = (data.bpInfo.items[cmd.item.id] ?? 0) + count
			} else if (cmd instanceof ConfigCmd)
				++data.bpInfo.cmds.c
		})
		console.log("rendering", data.title, data.img)
		data.renderTime = await renderer.render(bp, 1)
		console.log("finished render in ", data.renderTime)

		const cldResult = await cldUploadStream(data.img, renderer.canvasOut.toBuffer("image/png"))
		data.imgSize = cldResult.bytes
		updateGlobalStats()
	}

	dbUtil.set(id, data)
		.then(() => console.info("success"))
		.catch(err => console.error(err))
}, 0) */
