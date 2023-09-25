globalThis.toolPath = import.meta.url.substring(0, import.meta.url.lastIndexOf("/"))
const tool = {
	name: "Blueprint Editor",
	credits: `by <a href='https://github.com/Blueyescat' target='_blank'>Blueyescat</a>.
			Uses <a href='https://github.com/Blueyescat/dsabp-js' target='_blank'>dsabp-js</a>.`
}

const autoInputSave = import("/assets/autoInputSave.js")
import { BuildCmd, Item, PREFIX, decode, encode } from "../assets/lib/dsabp-js/index.min.js"
import * as operations from "./operations.js"
import { addTooltip } from "/main.js"

const inputBp = document.getElementById("bp-input")
const opRadios = Array.from(document.getElementById("chips-operation").querySelectorAll("input"))
const opOptions = document.getElementById("op-options")
const elResult = document.getElementById("result")
const elsNotice = {
	input: document.getElementById("notice-input"),
	result: document.getElementById("notice-result"),
	copy: document.getElementById("notice-copy")
}
const buttonProcess = document.getElementById("button-process")
const buttonCopy = document.getElementById("button-copy")
const buttonMove = document.getElementById("button-move")
const inputRotateAngle = document.getElementById("input-rotate-angle")

const noticeTimeoutIds = {},
	searchParams = new URLSearchParams(window.location.search)

/** @type {import("../assets/lib/dsabp-js/index.js").Blueprint} */
let bp,
	currentOp = "0",
	inputBpTimer,
	autoCopy

inputBp.addEventListener("input", function () {
	this.style.height = 0
	this.style.height = this.scrollHeight + "px"
	clearTimeout(inputBpTimer)
	inputBpTimer = setTimeout(() => loadBlueprint(this.value.trim()), 300)
})


if (searchParams.has("op")) {
	const radio = opRadios.find(radio => radio.value == searchParams.get("op"))
	autoInputSave.then(() => {
		if (radio && !radio.checked) {
			radio.checked = true
			radio.dispatchEvent(new Event("change"))
		}
	})
}

opRadios.forEach(radio => {
	radio.addEventListener("change", function () {
		currentOp = this.value
		const divs = opOptions.querySelectorAll(":scope > div")
		divs.forEach(div => div.classList.toggle("active", div.dataset.op == currentOp))
		searchParams.set("op", currentOp)
		history.replaceState(null, null, "?" + searchParams.toString())
	})
})

async function loadBlueprint(str) {
	if (str == "") return notice("input", "suc", "")
	bp = await decode(str).catch(err => {
		notice("input", "err", "Invalid blueprint string.")
		console.info("Blueprint decoding error:", err.message)
	})
	if (!bp) return
	notice("input", "suc", getBpStats(str, bp))
}

buttonProcess.addEventListener("click", async () => {
	if (bp == null) return
	const newBp = bp.clone()
	let additionalNotice
	if (currentOp == "crop") {
		operations.crop(newBp, {
			delete: document.getElementById("select-crop-mode").value == "0",
			top: parseInt(document.getElementById("input-crop-top").value),
			right: parseInt(document.getElementById("input-crop-right").value),
			bottom: parseInt(document.getElementById("input-crop-bottom").value),
			left: parseInt(document.getElementById("input-crop-left").value)
		})
	} else if (currentOp == "flip") {
		operations.flip(newBp, document.getElementById("select-flip-direction").value)
	} else if (currentOp == "rotate") {
		operations.rotate(newBp, parseFloat(inputRotateAngle.value))
	} else if (currentOp == "replace") {
		const amount = operations.replace(newBp, {
			search: document.getElementById("input-replace-search").value.toLowerCase().trim().replace(/ +/, " ").split(/\s*,\s*/),
			replacement: document.getElementById("input-replace-replacement").value.toLowerCase().trim().replace(/ +/, " ")
		})
		additionalNotice = `Replaced ${amount} items`
	}
	elResult.textContent = PREFIX + await encode(newBp)
	if (autoCopy) buttonCopy.click()
	elResult.focus()
	elResult.style.height = 0
	elResult.style.height = elResult.scrollHeight + "px"
	elResult.scrollTop = elResult.scrollHeight
	notice("result", "suc", (additionalNotice ? `${additionalNotice}\n` : "") + getBpStats(elResult.textContent, newBp))
})

document.getElementById("cb-auto-copy").addEventListener("change", e => autoCopy = e.target.checked)

// angle buttons
document.getElementById("rotate-angle-buttons").addEventListener("click", e => {
	if (!("a" in e.target.dataset)) return
	inputRotateAngle.value = e.target.dataset.a
	inputRotateAngle.dispatchEvent(new Event("change"))
})

// load replace item list
void function () {
	const box = document.getElementById("replace-item-list")
	const buildables = [], items = []
	for (const item of Item.getMap().values()) {
		if (item != Item.NULL)
			(item.isBuildable ? buildables : items).push(`${item.id.toString().padStart(3, "0")}: ${item.name}`)
	}
	box.innerHTML += buildables.join("<br>") + "<br><br>" + items.join("<br>")
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
	inputBp.dispatchEvent(new Event("input"))
	elResult.textContent = ""
	notice("result", "suc", "")
})

// util

function getBpStats(str, bp) {
	const b = bp.commands.filter(c => c instanceof BuildCmd).length
	return `${str.length} characters, ${bp.width}x${bp.height}, ${b} build commands, ${bp.commands.length - b} config commands`
}

function notice(target, color, text = "", temp) {
	const el = elsNotice[target]
	clearTimeout(noticeTimeoutIds[target])
	el.style.color = color == "err" ? "#D8000C"
		: color == "suc" ? "#61C761"
			: color
	el.textContent = text
	if (text == "") return
	if (temp) noticeTimeoutIds[target] = setTimeout(
		() => el.textContent = "",
		typeof temp == "number" ? temp : 8000
	)
}

document.querySelectorAll(".tooltip-ref").forEach(addTooltip)
document.querySelector("header nav .dropdown>.text").innerHTML = tool.name
if (tool.credits) document.getElementById("credits").innerHTML = tool.name + " " + tool.credits
