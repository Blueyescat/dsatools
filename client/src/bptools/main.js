const credits = `by <a href='https://github.com/Blueyescat' target='_blank'>Blueyescat</a>.
	Uses <a href='https://github.com/Blueyescat/dsabp-js' target='_blank'>dsabp-js</a>.`

const autoInputSave = import("/assets/autoInputSave.js")
import { BuildCmd, Item, PREFIX, decode, encode } from "dsabp-js"
import { BpRenderer, setImagesPath } from "dsabp-js-img"
import Zoomist from "zoomist"
import { cleanItemInput, crop, flip, processBuildCommands, replace, resolveItemInputs, rotate } from "./operations.js"
import { loadHF, trigger } from "/main.js"
loadHF(credits)
setImagesPath("../assets/game-images/")

const inputBp = document.getElementById("bp-input")
const opRadios = Array.from(document.getElementById("chips-operation").querySelectorAll("input"))
const opOptions = document.getElementById("op-options")
const elResultContainer = document.getElementById("result-container")
const elResult = document.getElementById("result")
const elResultOp = document.getElementById("result-op")
const elsNotice = {
	input: document.getElementById("notice-input"),
	result: document.getElementById("notice-result"),
	copy: document.getElementById("notice-copy")
}
const buttonProcess = document.getElementById("button-process")
const buttonCopy = document.getElementById("button-copy")
const buttonMove = document.getElementById("button-move")
const inputRotateAngle = document.getElementById("input-rotate-angle")
const inputSortItemFirst = document.getElementById("input-sortitem-first")
const inputSortItemLast = document.getElementById("input-sortitem-last")
const tBodyContents = document.getElementById("table-contents-content")
const tBodyBuildOrder = document.getElementById("table-build-order-content")
const elResultResources = document.getElementById("result-resources")
const zoomistContainerInput = document.querySelector(".zoomist-container.input")
const zoomistContainerResult = document.querySelector(".zoomist-container.result")
const canvasPreviewInput = document.getElementById("canvas-preview-input")
const canvasPreviewResult = document.getElementById("canvas-preview-result")

const regexPkg = / \(Packaged\)|, Packaged/

const noticeTimeoutIds = {},
	searchParams = new URLSearchParams(window.location.search)

/** @type {import("dsabp-js").Blueprint} */
let bp,
	currentOp = "crop",
	inputBpTimer,
	autoCopy

const rendererInput = new BpRenderer(canvasPreviewInput)
const rendererResult = new BpRenderer(canvasPreviewResult)
rendererResult.useCacheOf(rendererInput)

const zoomist = { input: null, result: null }

function getZoomist(name) {
	const container = name == "input" ? zoomistContainerInput : zoomistContainerResult
	const canvas = name == "input" ? canvasPreviewInput : canvasPreviewResult
	return zoomist[name] ??= new Zoomist(container, {
		bounds: false,
		zoomRatio: 0.3,
		initScale: 1,
		minScale: 0.02,
		maxScale: 16,
		on: {
			reset() {
				const { width: imgWidth, height: imgHeight } = canvas
				const { width: conWidth, height: conHeight } = this.data.containerData
				this.move({ x: -imgWidth / 2 + conWidth / 2, y: -imgHeight / 2 + conHeight / 2 })
				const reduceMargin = (rendererInput.squareSize * 2.75) * 2
				this.zoomTo(Math.min(conWidth / (imgWidth - reduceMargin), conHeight / (imgHeight - reduceMargin)))
				container.classList.remove("loading")
				new Promise(resolve => canvas.toBlob(resolve))
					.then(blob => container.querySelector("a").href = URL.createObjectURL(blob) + "#_You_can't_share_this_URL_it_is_local_temporary")
			}
		}
	})
}

inputBp.addEventListener("input", function () {
	this.style.height = 0
	this.style.height = "58px"
	clearTimeout(inputBpTimer)
	inputBpTimer = setTimeout(() => loadBlueprint(this.value.trim()), 300)
})
inputBp.addEventListener("focus", () => inputBp.select())
inputBp.addEventListener("dblclick", () => inputBp.select())
setTimeout(() => inputBp.scrollTop = inputBp.scrollHeight, 100)

if (searchParams.has("op")) {
	const radio = opRadios.find(radio => radio.value == searchParams.get("op"))
	autoInputSave.then(() => {
		if (radio && !radio.checked) {
			radio.checked = true
			trigger(radio, "change")
		}
	})
}

opRadios.forEach(radio => {
	radio.addEventListener("change", function () {
		currentOp = this.value
		const divs = opOptions.querySelectorAll(":scope>div")
		divs.forEach(div => div.classList.toggle("active", div.dataset.op == currentOp))
		searchParams.set("op", currentOp)
		history.replaceState(null, null, "?" + searchParams.toString())
	})
})

async function loadBlueprint(str) {
	zoomistContainerInput.classList.add("loading")
	if (str == "")
		return canvasPreviewInput.width = 0, notice("input", "suc", "")
	bp = await decode(str).catch(err => {
		canvasPreviewInput.width = 0
		notice("input", "err", "Invalid blueprint string.")
		console.info("Blueprint decoding error:", err)
	})
	if (!bp) return
	notice("input", "suc", getBpInfo(str, bp))
	rendererInput.render(bp).then(() => getZoomist("input").reset())
}

buttonProcess.addEventListener("click", async () => {
	if (bp == null) return
	const newBp = bp.clone()
	let additionalNotice
	if (currentOp == "crop") {
		crop(newBp, {
			delete: document.getElementById("select-crop-mode").value == "0",
			top: parseInt(document.getElementById("input-crop-top").value),
			right: parseInt(document.getElementById("input-crop-right").value),
			bottom: parseInt(document.getElementById("input-crop-bottom").value),
			left: parseInt(document.getElementById("input-crop-left").value)
		})
	} else if (currentOp == "flip") {
		flip(newBp, document.getElementById("select-flip-direction").value)
	} else if (currentOp == "rotate") {
		rotate(newBp, inputRotateAngle.valueAsNumber)
	} else if (currentOp == "replace") {
		const amount = replace(newBp, {
			search: cleanItemInput(document.getElementById("input-replace-search").value),
			replacement: cleanItemInput(document.getElementById("input-replace-replacement").value)
		})
		additionalNotice = `Replaced ${amount} items`
	} else if (currentOp == "sortitem") {
		processBuildCommands(newBp, {
			sortOthers: true,
			sortFirst: new Set(resolveItemInputs(cleanItemInput(inputSortItemFirst.value), { followInputCategoriesOrder: true, onlyBuildables: true })),
			sortLast: new Set(resolveItemInputs(cleanItemInput(inputSortItemLast.value), { followInputCategoriesOrder: true, onlyBuildables: true }))
		})
	}
	elResult.textContent = PREFIX + await encode(newBp)
	if (autoCopy) buttonCopy.click()
	elResult.focus()
	elResult.style.height = "58px"
	elResult.scrollTop = elResult.scrollHeight
	notice("result", "suc", (additionalNotice ? `${additionalNotice}\n` : "") + getBpInfo(elResult.textContent, newBp))
	updateTable("contents", newBp)
	updateTable("buildOrder", newBp)
	elResultOp.textContent = opRadios.find(radio => radio.value == currentOp).parentElement.textContent
	elResultContainer.style.removeProperty("display")
	zoomistContainerResult.classList.add("loading")
	rendererResult.render(newBp).then(() => getZoomist("result").reset())
})

document.getElementById("cb-auto-copy").addEventListener("change", e => autoCopy = e.target.checked)

setTimeout(() => {
	if (inputSortItemFirst.value == inputSortItemFirst.getAttribute("value"))
		trigger(inputSortItemFirst, "change")
	if (inputSortItemLast.value == inputSortItemLast.getAttribute("value"))
		trigger(inputSortItemLast, "change")
}, 500)

// angle buttons
document.getElementById("rotate-angle-buttons").addEventListener("click", e => {
	if (!("a" in e.target.dataset)) return
	inputRotateAngle.value = e.target.dataset.a
	trigger(inputRotateAngle, "change")
})

// load item lists
void function () {
	for (const box of document.getElementsByClassName("item-list")) {
		const buildables = [], items = []
		for (const item of Item.getMap().values()) {
			if (item != Item.NULL)
				(item.isBuildable ? buildables : items).push(`${item.id.toString().padStart(3, "0")}: ${item.name}`)
		}
		box.innerHTML += buildables.join("<br>") + "<br><br>" + items.join("<br>")
	}
}()

// result buttons

elResult.addEventListener("focus", () => elResult.select())
elResult.addEventListener("dblclick", () => elResult.select())
buttonCopy.addEventListener("click", () => {
	navigator.clipboard.writeText(elResult.textContent).catch(console.error)
	notice("copy", "var(--blue)", "Copied!", 2000)
})
buttonMove.addEventListener("click", () => {
	inputBp.value = elResult.textContent
	trigger(inputBp, "input")
	elResult.textContent = ""
	notice("result", "suc", "")
})

// tables

function updateTable(type = "buildOrder", bp) {
	const tBodyEl = type == "contents" ? tBodyContents : tBodyBuildOrder
	tBodyEl.innerHTML = ""

	let array
	if (type == "contents") {
		/** item id to count */
		const reqResources = new Map()
		const map = new Map()
		for (const cmd of bp.commands) {
			if (!(cmd instanceof BuildCmd)) continue

			const cmdBuildAmount = cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1

			let mapItem = map.get(cmd.item)
			if (!mapItem)
				map.set(cmd.item, mapItem = { count: 0 })
			mapItem.count += cmdBuildAmount

			if (cmd.item.recipe != null) {
				for (const input of cmd.item.recipe.input) {
					reqResources.set(
						input.item,
						(reqResources.get(input.item) || 0)
						+ (input.count * cmdBuildAmount)
					)
				}
			}
		}
		array = Array.from(map).sort((a, b) => b[1].count - a[1].count)

		elResultResources.innerHTML = Array.from(reqResources)
			.map(([itemID, count]) => {
				const item = Item.getById(itemID)
				return `${count} <img src="${location.origin}/p?https://test.drednot.io/img/${item.image}.png" title="${item.name}" style="vertical-align: middle; width: 1.2em;">`
			}).join(" ")
	} else if (type == "buildOrder") {
		array = []
		let lastItem
		for (const cmd of bp.commands) {
			if (!(cmd instanceof BuildCmd)) continue

			let currentItem = lastItem?.[0] == cmd.item ? lastItem[1] : null
			if (!currentItem)
				array.push(lastItem = [cmd.item, currentItem = { count: 0 }])
			currentItem.count += cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1
		}
	}

	let i = 0
	for (const [item, data] of array) {
		tBodyEl.insertAdjacentHTML("beforeend", `<tr${i % 2 == 0 ? " class=\"odd\"" : ""}>`
			+ `<td><img src="${location.origin}/p?https://test.drednot.io/img/${item.image}.png"></td>`
			+ `<td>${data.count}</td>`
			+ `<td>${item.name.replace(regexPkg, "")}</td>`
			+ "</tr>"
		)
		++i
	}
}

// util

/**
 * @param {string} str
 * @param {Blueprint} bp
 */
function getBpInfo(str, bp) {
	const reqW = bp.width - 11, reqH = bp.height - 8
	const buildCmdAmount = bp.commands.filter(c => c instanceof BuildCmd).length
	let buildAmount = 0
	for (const cmd of bp.commands)
		if (cmd instanceof BuildCmd)
			buildAmount += cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1

	return `<b>${bp.width}</b> width, <b>${bp.height}</b> height (can fit <b>${Math.trunc((bp.width - 2) / 3 * 10) / 10}</b>x<b>${Math.trunc((bp.height - 2) / 3 * 10) / 10}</b> cannons,`
		+ ` for the starter ship: <b>${reqW < 0 ? "" : "+"}${reqW}</b> width, <b>${reqH < 0 ? "" : "+"}${reqH}</b> height)`
		+ ` – RCD build cost: <b>${Math.ceil(buildAmount / 10)}</b> flux`
		+ `\n${str.length} chars – ${buildCmdAmount} build, ${bp.commands.length - buildCmdAmount} config commands`
}

function notice(target, color, html = "", temp) {
	const el = elsNotice[target]
	clearTimeout(noticeTimeoutIds[target])
	el.style.color = color == "err" ? "#D8000C"
		: color == "suc" ? "#61C761"
			: color
	el.innerHTML = html
	if (html == "") return
	if (temp) noticeTimeoutIds[target] = setTimeout(
		() => el.innerHTML = "",
		typeof temp == "number" ? temp : 8000
	)
}
