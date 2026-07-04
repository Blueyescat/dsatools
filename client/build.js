import { context, build as esbuild, formatMessages } from "esbuild"
import { watch as fsWatch } from "fs"
import { readFile, readdir, rename, rm, writeFile } from "fs/promises"
import { minify as minifyHtml } from "html-minifier-terser"
import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"
import pathM from "path"

const watch = process.argv.includes("-w"),
	srcDir = "./src/", // these has to have /x/ for md plugin
	outDir = "./dist/",
	libDir = "/lib/",
	outLibDir = outDir.slice(0, -1) + libDir,

	externals = new Set(["zoomist/css"]),
	noBundle = ["pixi.js", "dsabp-js"] // pixi won't be bundled in pixi-viewport, same for dsabp-js/img

const minify = true
const sourcemap = true

/** @type import("html-minifier-terser").Options */
const htmlOptions = {
	collapseWhitespace: true,
	conservativeCollapse: true,
	collapseBooleanAttributes: true,
	minifyCSS: true,
	minifyJS: { module: true },
	quoteCharacter: "\"",
	removeComments: true,
	removeRedundantAttributes: true,
	sortAttributes: true,
	sortClassName: true
}

let paused

console.info(time(), "cleaning")
for (const file of await readdir(outDir).catch(() => { }) ?? [])
	await rm(pathM.join(outDir, file), { recursive: true })

const srcCtx = await context({
	packages: "external",
	entryPoints: [`${srcDir}**`],
	loader: {
		".webmanifest": "copy",
		".json": "copy",
		".html": "copy",
		".ejs": "copy",
		".woff": "copy",
		".png": "copy",
		".webp": "copy",
		".svg": "copy",
		".md": "copy",
		".mp4": "copy",
		".gif": "copy",
	},
	outdir: outDir,
	logLevel: "silent",
	supported: { "class-static-blocks": false },
	target: "es2022",
	format: "esm",
	platform: "browser",
	bundle: true,
	minify,
	sourcemap,
	plugins: [mdToHtmlPl(), swCheckPl(), resolvePackagesPl(), minifyHtmlPl(), buildWithLogsPl()]
})

//

function swCheckPl() {
	return {
		name: "swCheck",
		setup(build) {
			build.onStart(() => {
				if (paused) {
					paused = false; throw "stop"
				}
				console.info(time(), (watch ? "[watch] " : "") + "Building...")
			})
		}
	}
}

async function updateSwCacheUrls() {
	const manuals = ["/", "https://dt.tmp.bz/p?https://pub.drednot.io/test/econ/item_schema.json"]

	const patterns = [
		{ path: "/", exclude: "assets lib sw.ts", recursive: false, folders: true },
		{ path: "/assets/", exclude: "changelog/", recursive: true },
		{ path: "/img2pixar/", recursive: true },
		{ path: "/bpbin/", recursive: false },
		{ path: "/bptools/", recursive: true },
		{ path: "/bpeditor/", recursive: true },
		{ path: "/lib/", recursive: true }
	]

	const paths = []
	for (const pattern of patterns) {
		const exclude = pattern.exclude ? pattern.exclude.split(" ") : null
		for (const file of await readdir(outDir + pattern.path, { withFileTypes: true, recursive: pattern.recursive, encoding: "utf8" }).catch(() => { }) ?? []) {
			if (!pattern.folders && !file.isFile())
				continue
			const name = file.name
			const path = file.path.replaceAll(/\\\\?|\/\//g, "/").replaceAll(/^\.?\/?dist\/|\/$/g, "") // recursive:true returns different
			const basePath = pattern.path.slice(1)
			const fullPath = (path != "" ? path + "/" : "") + name
			if (name == "index.html" || name.endsWith(".ejs") || name.endsWith(".map")
				|| exclude?.some(x =>
					x.endsWith("/")
						? fullPath.startsWith(basePath + x)
						: x == name
				)
			)
				continue
			paths.push({ parent: (path != "" ? path + "/" : ""), file: name })
		}
	}

	const merged = {}
	paths.forEach(({ parent, file }) =>
		(merged[parent] ??= []).push(file)
	)

	const content = Object.entries(merged).map(([parent, files]) =>
		(files.length > 2)
			? `...["${files.join(`","`)}"]${parent != "" ? `.map(f=>"${parent}"+f)` : ""}`
			: `"${files.map(f => parent + f).join(`", "`)}"`
	)

	return (await readFile(`${srcDir}sw.ts`, "utf8")).replace(
		/(?<=\/\*@build_cacheUrls>\*\/)(.*?)(?=\/\*@build_cacheUrls<\*\/)/,
		`"${manuals.join(`","`)}",` + content
	)
}

function resolvePackagesPl() {
	return {
		name: "resolvePackages",
		setup(build) {
			// filter out non-external imports
			build.onResolve({ filter: /.*/ }, async ({ kind, path, resolveDir, external, importer }) => {
				if (path.startsWith("data:") || kind == "url-token")
					return { path, external: true }

				if (
					(kind == "import-statement" || kind == "dynamic-import")
					&& /^\.?\/|^\.\.?/.test(path)
					&& (resolveDir.includes(`${pathM.sep}src${pathM.sep}`) || resolveDir.endsWith(`${pathM.sep}src`))
				)
					return { path, external: true }

				if (external || kind == "entry-point" || (importer.includes("node_modules") && !noBundle.includes(path)))
					return

				// collect the import name, and edit the import path
				if (path != "pixi.js")
					externals.add(path)
				return {
					path: libDir + path + (path.endsWith(".js") ? "" : ".js"),
					external: true
				}
			})
		}
	}
}

// shortened https://gist.github.com/ycmjason/370f9a476648b0a8ce6130e1cb0c2893
async function asyncReplace(str, regex, replacer) {
	const substrs = []
	let i = 0, match
	for (; (match = regex.exec(str)); i = regex.lastIndex)
		substrs.push(str.slice(i, match.index), await replacer(...match))
	return substrs.join("") + str.slice(i)
}

function minifyHtmlPl() {
	const regexHtmlTemplate = /\/\*html\*\/`([\s\S]+?)(?:(?<=^|>|\t)`|`(?=,|]))/gm
	return {
		name: "minifyHtml",
		setup(build) {
			build.onLoad({ filter: /\.(html|ejs|js|ts)$/ }, async ({ path }) => {
				let contents = await readFile(path, "utf8")

				if (path.endsWith(".ts") || path.endsWith(".js"))
					contents = await asyncReplace(contents, regexHtmlTemplate,
						async (match, html) => "`" + await minifyHtml(html, htmlOptions) + "`"
					)
				else
					contents = await minifyHtml(contents, htmlOptions)

				return { contents, loader: "default" }
			})
		}
	}
}

function buildWithLogsPl() {
	return {
		name: "buildLogs",
		setup(build) {
			build.onEnd(async result => {
				if (result.errors.find(err => err.text == "stop"))
					return

				// bundles and puts externals into outLibDir recursively, supporting nested externals
				const common = {
					target: "es2022",
					supported: { "class-static-blocks": false },
					format: "esm",
					platform: "browser",
					bundle: true,
					minify
				}
				const built = new Set()
				while (externals.size) {
					const entryPoints = Array.from(externals).filter(p => !built.has(p))
					externals.clear()
					entryPoints.forEach(p => built.add(p))
					const libResult = await esbuild({
						entryPoints,
						outdir: outLibDir,
						plugins: [resolvePackagesPl()],
						...common
					})
					result.errors.push(...libResult.errors)
					result.warnings.push(...libResult.warnings)
				}
				// TODO: try find a nicer way to tree shake while separating
				const libResult = await esbuild({
					stdin: {
						contents: "export{TilingSprite,Application,Assets,BitmapText,ColorMatrixFilter,Container,EventEmitter,Filter,GlProgram,GpuProgram,Graphics,Point,Rectangle,Sprite,Texture,Ticker}from'pixi.js'",
						resolveDir: srcDir
					},
					outfile: `${outDir}lib/pixi.js`,
					...common
				})

				const swContent = await updateSwCacheUrls()
				const swResult = await esbuild({
					stdin: { contents: swContent, loader: "ts" },
					outfile: `${outDir}sw.js`,
					...common
				})
				paused = true
				await writeFile(`${srcDir}sw.ts`, swContent).then(() => setTimeout(() => paused = false, 800))

				result.errors.push(...libResult.errors, ...swResult.errors)
				result.warnings.push(...libResult.warnings, ...swResult.warnings)

				if (watch) {
					if (result.errors.length)
						await formatMessages(result.errors, { kind: "error", color: true }).then(strings => console.error(strings.join("\n").trim()))
					if (result.warnings.length)
						await formatMessages(result.warnings, { kind: "warning", color: true }).then(strings => console.warn(strings.join("\n").trim()))
				}

				await generateChangelog()

				console.info(time(), (watch ? "[watch] " : "")
					+ `${result.errors.length ? "\x1b[31mBUILD FAILED" : "\x1b[32mBuilt"}\x1b[0m with`
					+ ` ${result.warnings.length} warnings${result.errors.length ? ` ${result.errors.length} errors` : ""}`)
			})
		}
	}
}

function mdToHtmlPl() {
	const name = "mdToHtml"
	return {
		name,
		setup(build) {
			const outPaths = []
			build.onStart(() => { outPaths.length = 0 })
			build.onLoad({ filter: /\.html\.md$/ }, async ({ path }) => {
				outPaths.push(path.replace(srcDir.replaceAll("/", pathM.sep).replace(".", ""), outDir.replaceAll("/", pathM.sep).replace(".", "")))
				const contents = await minifyHtml(DOMPurify.sanitize(await marked(await readFile(path, "utf8"))), htmlOptions)
				return { contents, loader: "default" }
			})
			build.onEnd(async result => {
				if (!result.errors.length)
					for (const path of outPaths)
						await rename(path, path.replace(/\.md$/, ""))
			})
		}
	}
}

function time() {
	return new Date().toLocaleTimeString()
}

/* changelog */
const CHANGELOG_HTML = /*html*/`<!DOCTYPE html><html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Changelog</title>
	<link rel="stylesheet" href="/main.css">
</head>
<body style="background: unset;">
	<div class="container-grid"><!--entries--></div>
	<script>
		for (const el of document.querySelectorAll("time"))
			el.textContent = new Date(el.getAttribute("datetime")).toLocaleDateString()
	</script>
</body>
</html>`

async function generateChangelog() {
	let firstDate
	const entries = []
	for (let section of
		(await readFile("../changelog.md", "utf8"))
			.split(/^---\s*$/m).map(s => s.trim())
	) {
		let date = null
		// extract date and remove it
		section = section.replace(/(\d{4}-\d{2}-\d{2})/, (_, d) => {
			return date = d, ""
		})
		if (date) firstDate ??= date

		// convert remaining dates
		section = section.replace(/\d{4}-\d{2}-\d{2}/g, d => `<time datetime="${d}"></time>`)

		// append date into heading or create one
		const lines = section.split(/\r?\n/)
		const firstLine = lines[0]?.trim()
		if (firstLine?.match(/^(#{1,6})\s+/))
			lines[0] = firstLine + ` (<time datetime="${date}"></time>)`
		else
			lines.unshift(`### <time datetime="${date}"></time>`)

		entries.push(DOMPurify.sanitize(
			marked.parse(lines.join("\n").trim())

		).replaceAll("<a href", "<a target=\"_blank\" href"))
	}

	await writeFile(pathM.join(outDir, "changelog.html"),
		`<!--${firstDate}-->` + CHANGELOG_HTML.replace("<!--entries-->",
			entries.map(html => `<div class="card">${html}</div>`).join("\n")
		)
	)
}

//
if (watch) {
	console.info(time(), "watching for changes\n")
	await srcCtx.watch()
	let changelogTimer
	fsWatch("../changelog.md", () => {
		clearTimeout(changelogTimer)
		changelogTimer = setTimeout(() => srcCtx.rebuild(), 100)
	})
} else {
	await srcCtx.rebuild()
	process.exit(0)
}
