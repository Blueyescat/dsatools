import { Blueprint, decode, PREFIX } from "dsabp-js"
import { importBlueprint } from "../actions/importBlueprint.js"
import { resetZoom, setLastCopiedBpStr } from "../main.js"
import { resetSessionId } from "../managers/webStorage.js"
import { editorMap, winMan } from "./uiMain.js"
import { Dialog } from "/Dialog.js"
import { elByCls, trigger, showChangelog } from "/main.js"
import { toast } from "/Toast.js"

/* FIND REPLACE */
document.getElementById("button-menu-findreplace").addEventListener("click", () =>
	winMan.findReplace.toggle()
)

/* ITEM MAT LIST */
document.getElementById("button-menu-itemmatlist").addEventListener("click", () => {
	const itemMatList = winMan.itemMatList,
		oldType = itemMatList.type
	itemMatList.setType("map").setSource(editorMap.objects)
	if (itemMatList.win.isOpen && oldType != "map")
		itemMatList.win.open()
	else
		itemMatList.toggle()
})

/* VIEW/COPY BLUEPRINT */
document.getElementById("button-menu-view-bp").addEventListener("click", () => {
	winMan.bpStr.setType("map").open()
	winMan.itemMatList.setType("map")
	winMan.buildOrder.setType("map")
})
document.getElementById("button-menu-copy-bp").addEventListener("click", () =>
	winMan.bpStr.mapBpStr && navigator.clipboard?.writeText(PREFIX + winMan.bpStr.mapBpStr)
)

/* NEW */
const dialogNew = new Dialog({
	id: "dialog-newmap",
	title: "New Map",
	draggable: { key: "newmap" },
	body: /*html*/`
		<p>
			<select class="unit" style="width: 6.5em;" data-save>
				<option value="0">Squares</option>
				<option value="1">Cannons</option>
			</select>
		</p>
		<p>
			Width:
			<span class="cannon-only" style="display: none;">fits</span>
			<input type="number" class="width" value="11" min="0" style="width: 3em;" data-save>
			<span class="cannon-only" style="display: none;">cannons + <input type="number" class="width-sq" value="0" min="0" style="width: 2em;" data-save> squares</span>
		</p>
		<p>
			Height:
			<span class="cannon-only" style="display: none;">fits</span>
			<input type="number" class="height" value="8" min="0" style="width: 3em;" data-save>
			<span class="cannon-only" style="display: none;">cannons + <input type="number" class="height-sq" value="0" min="0" style="width: 2em;" data-save> squares</span>
		</p>
		<p class="smaller">A ship of this size fits into an area of <b class="z-w"></b> by <b class="z-h"></b> zone tiles.</p>
		<p class="warn" style="font-size: smaller; float: right;">The current blueprint will be lost!</p>
	`,
	footer: {
		html: /*html*/`
			<button class="button-create">Create</button>`,
		closeButton: "Cancel"
	},
	onCreate(dialog) {
		const btnCreate = elByCls<HTMLButtonElement>(dialog, "button-create"),
			inputWidth = elByCls<HTMLInputElement>(dialog, "width"),
			inputHeight = elByCls<HTMLInputElement>(dialog, "height"),
			selectUnit = elByCls<HTMLSelectElement>(dialog, "unit"),
			inputWidthSq = elByCls<HTMLInputElement>(dialog, "width-sq"),
			inputHeightSq = elByCls<HTMLInputElement>(dialog, "height-sq"),
			cannonExtras = dialog.getElementsByClassName("cannon-only") as HTMLCollectionOf<HTMLElement>,
			elZoneTilesW = elByCls<HTMLInputElement>(dialog, "z-w"),
			elZoneTilesH = elByCls<HTMLInputElement>(dialog, "z-h"),
			elWarn = elByCls(dialog, "warn")

		let isCannonUnit: boolean,
			inputDebounceTimer: number

		const parseMainInputs = () => [parseInt(inputWidth.value) || 0, parseInt(inputHeight.value) || 0] as [w: number, h: number],
			parseSqInputs = () => [parseInt(inputWidthSq.value) || 0, parseInt(inputHeightSq.value) || 0] as [w: number, h: number]

		selectUnit.addEventListener("change", () => {
			isCannonUnit = selectUnit.value == "1"
			for (const el of cannonExtras)
				el.style.display = isCannonUnit ? "" : "none"
			let [baseW, baseH] = parseMainInputs()
			if (isCannonUnit) {
				baseW -= 2
				baseH -= 2
				if (baseW > -1) {
					inputWidth.value = "" + Math.floor(baseW / 3)
					inputWidthSq.value = "" + baseW % 3
				}
				if (baseH > -1) {
					inputHeight.value = "" + Math.floor(baseH / 3)
					inputHeightSq.value = "" + baseH % 3
				}
			} else {
				const [baseSqW, baseSqH] = parseSqInputs()
				inputWidth.value = "" + (baseW * 3 + baseSqW + 2)
				inputHeight.value = "" + (baseH * 3 + baseSqH + 2)
				inputWidthSq.value = "0"
				inputHeightSq.value = "0"
			}
			trigger([inputWidth, inputHeight, inputWidthSq, inputHeightSq], "change")
			onInput()
		})

		function getCurrSizes() {
			let [width, height] = parseMainInputs()
			if (isCannonUnit) {
				const [sqW, sqH] = parseSqInputs()
				width = width * 3 + sqW + 2
				height = height * 3 + sqH + 2
			}
			return [width, height]
		}

		function onInput() {
			const [width, height] = getCurrSizes()
			elZoneTilesW.textContent = (width / 8).toFixed(2)
			elZoneTilesH.textContent = (height / 8).toFixed(2)
		}

		[inputWidth, inputHeight, inputWidthSq, inputHeightSq].forEach(el => {
			el.addEventListener("beforeinput", e => {
				if (!(e.data == null || !isNaN(parseInt(e.data)))) // only int
					return e.preventDefault()
				clearTimeout(inputDebounceTimer)
				inputDebounceTimer = setTimeout(onInput, 4)
			})
			el.addEventListener("click", () =>
				el.readOnly = !(el.readOnly = true) // this prevents dbl clicking arrows starting auto spin
			)
		})

		btnCreate.addEventListener("click", () => {
			const [width, height] = getCurrSizes()
			dialog.close()
			editorMap.loadBlueprint(new Blueprint({ width, height }))
			editorMap.updateBpStr()
		})

		dialog.addEventListener("open", () => elWarn.style.display = editorMap.hasLoadedBp ? "" : "none")

		onInput()
	}
})
document.getElementById("button-menu-new").addEventListener("click", () => dialogNew.open())

/* IMPORT BLUEPRINT */
let importBpInput: HTMLTextAreaElement
const dialogImportBp = new Dialog({
	title: "Load & Place Blueprint",
	draggable: { key: "importbp" },
	body: /*html*/`
		<p><textarea class="bp" rows="5" spellcheck="false" autocomplete="off" placeholder="DSA:.."></textarea></p>
		<p class="info" style="float: right;"></p>`,
	footer: {
		html: /*html*/`
			<button class="button-load">Load & Place</button>`,
		closeButton: "Cancel"
	},
	onCreate(dialog) {
		importBpInput = elByCls<HTMLTextAreaElement>(dialog, "bp")
		const btnLoad = elByCls<HTMLButtonElement>(dialog, "button-load"),
			elInfo = elByCls(dialog, "info")
		btnLoad.addEventListener("click", async () => {
			if (!editorMap.hasLoadedBp)
				return

			const bpStr = importBpInput.value,
				bp = await decode(bpStr).catch(console.error)
			if (!bp) {
				elInfo.textContent = "Invalid blueprint string!"
				return setTimeout(() => elInfo.textContent = "", 3000)
			}
			elInfo.textContent = ""
			importBlueprint(editorMap, bp, bpStr)
			dialog.close()
		})
	}
})
document.getElementById("button-menu-import-bp").addEventListener("click", () => dialogImportBp.open())

/* CLOSE MAP */
document.getElementById("button-menu-close-map").addEventListener("click", async () => {
	if (editorMap.hasLoadedBp) {
		resetSessionId()
		await editorMap.loadBlueprint(new Blueprint({ width: -1, height: -1 }))
		winMan.bpStr.setBlueprint(editorMap.bp, null, true)
		editorMap.emit("bpchange")
	}
	winMan.welcome.open(true)
})

/* UNDO / REDO */
document.getElementById("button-menu-undo").addEventListener("click", () => editorMap.history.undo())
document.getElementById("button-menu-redo").addEventListener("click", () => editorMap.history.redo())

/* RESET ZOOM */
document.getElementById("button-menu-reset-zoom").addEventListener("click", () => resetZoom())

/* ABOUT */
const dialogAbout = new Dialog({
	title: "About",
	body: /*html*/`
		<div style="text-align: center; font-size: 0.9em;">
			<img src="/assets/icons/144.svg" alt="App Logo" height="48">
			<h4>${document.title}</h4>
			<!-- <p>Release notes are in the forum thread in the game's Discord server.</p> -->
			<p>Made by <a href="https://github.com/Blueyescat" target="_blank">Blueyescat</a>.</p>
			<p>Most of the graphics used belong to <a href="https://drednot.io" target="_blank">drednot.io</a>.</p>
			<a href="https://github.com/Blueyescat/dsatools" target="_blank">Source on GitHub</a>
		</div>`,
	footer: {
		closeButton: "Close"
	}
})
document.getElementById("button-menu-about").addEventListener("click", () => dialogAbout.open())

/* GUIDE */
const dialogGuide = new Dialog({
	id: "dialog-guide",
	title: "Guide",
	footer: { closeButton: "Close" },
	backdrop: true,
	async onCreate(dialog) {
		dialog.style.maxHeight = "calc(90vh - 1em)"
		dialog.style.maxWidth = "800px"

		await fetch("assets/guide.html").then(res => res.text()).then(html =>
			dialog.elBody.innerHTML = html
		).catch(console.error)

		dialog.elBody.querySelectorAll("a[href*='#']").forEach((a: HTMLAnchorElement) => {
			a.addEventListener("click", e => {
				e.preventDefault()
				if (a.hash) dialog.elBody.scrollTo({
					top: Array.from<HTMLHeadingElement>(dialog.querySelectorAll("h1,h2,h3,h4,h5,h6"))
						.find(el => el.textContent.toLowerCase().startsWith(a.hash.slice(1).toLowerCase().replaceAll("+", " "))).offsetTop
				})
			})
		})

		let slashkey: string
		if (navigator["keyboard"])
			await navigator["keyboard"].getLayoutMap().then(map => slashkey = map.get("Slash"))
		elByCls(dialog.elBody, "slashkey").textContent = slashkey ??= "/"
	}
})
document.getElementById("button-menu-guide").addEventListener("click", () => dialogGuide.open())

/* CHANGELOG */
document.getElementById("button-menu-changelog").addEventListener("click", showChangelog)

/* MODS */
const dialogMods = new Dialog({
	id: "dialog-mods",
	title: "Asset Modification",
	footer: {
		html: `<button class="button-clear">Remove All Mods</button>`,
		closeButton: { html: "Close", right: true }
	},
	body: /*html*/`
		<p>
			To load a mod pack: you can 
			<input class="input-file" type="file" accept="application/x-zip-compressed" style="display: none;">
			<a class="no-link">select a ZIP file</a>,
			<input class="input-folder" type="file" webkitdirectory directory multiple style="display: none;">
			<a class="no-link">select a folder</a>,
			or drag & drop them into the app.
		</p>
		<details style="margin-bottom: 0.9em;">
			<summary>Notes</summary>
			<p>
				You can't load files individually or download the files later. You should build the pack in your computer and keep it somewhere.
			</p>
			<p>
				Folder names and file extensions are not restricted. Anything that works in the game,
				or files from the <a href="https://test.drednot.io/img/" target="_blank">/img/</a> directory that are used by the editor (like <code>silk/</code>), should work.
				Your pack must include the <code>img</code> root folder.
			</p>
		</details>
		<div class="info"></div>
	`,
	async onCreate(dialog) {
		dialog.style.maxWidth = "500px"

		const inputFile = elByCls<HTMLInputElement>(dialog, "input-file"),
			inputFolder = elByCls<HTMLInputElement>(dialog, "input-folder"),
			btnClear = elByCls<HTMLButtonElement>(dialog, "button-clear"),
			elInfo = elByCls(dialog, "info")

		inputFile.nextElementSibling.addEventListener("click", () => inputFile.click())
		inputFolder.nextElementSibling.addEventListener("click", () => inputFolder.click())

		inputFile.addEventListener("change", () => {
			const zipFile = inputFile.files?.[0]
			if (zipFile?.type == "application/x-zip-compressed")
				editorMap.mods.importFromAndUpdate(zipFile)
		})

		inputFolder.addEventListener("change", () => {
			if (inputFolder.files.length)
				editorMap.mods.importFromAndUpdate(inputFolder.files)
		})

		btnClear.addEventListener("click", () => {
			new Dialog({
				title: "Remove All Mods",
				body: `Are you sure you want to remove all the mods (${Object.keys(editorMap.mods.mods).length})?`,
				footer: {
					closeButton: { html: "No", right: true },
					html: /*html*/`<button class="button-yes">Yes</button>`
				},
				removeOnClose: true,
				closeWhenClickedOutside: true,
				onCreate(dialog) {
					const btnYes = elByCls<HTMLButtonElement>(dialog, "button-yes")
					btnYes.addEventListener("click", () => { dialog.close(); editorMap.mods.removeMods() })
					dialog.addEventListener("open", () => btnYes.focus())
				},
			}).open(true)
		})

		function updateInfo() {
			const mods = editorMap.mods.mods,
				ids = Object.keys(mods)
			let listHtml = "" // how does join() cause li's other than first one to go after ul?
			if (ids.length)
				ids.forEach(id => listHtml += /*html*/`
					<li><img src="${mods[id].url}"> <code>${mods[id].path}</code></li>
				`)
			elInfo.innerHTML = listHtml
				? `Loaded mods (${ids.length}): <ol class="mod-list">${listHtml}</ol>`
				: `<i style="color: gray;">No mods loaded.</i>`
		}

		editorMap.mods.setChangeCb(updateInfo)
		dialog.addEventListener("open", updateInfo)
		dialog.addEventListener("close", () => elInfo.innerHTML = "")
	}
})
document.getElementById("button-menu-mods").addEventListener("click", () => dialogMods.open())


/* KEYS */
window.addEventListener("keydown", e => {
	const ctrlMeta = e.ctrlKey || e.metaKey

	if (ctrlMeta) {
		if ((e.code == "KeyH" || e.code == "KeyF" || e.code == "KeyG") // G for edge
			&& !e.repeat
		) {
			e.preventDefault()
			winMan.findReplace.win.toggle()
			return
		}

		if (e.code == "KeyS" && !e.repeat) {
			if (winMan.bpStr.mapBpStr) {
				navigator.clipboard.writeText(PREFIX + winMan.bpStr.mapBpStr)
					.then(() => {
						setLastCopiedBpStr(PREFIX + winMan.bpStr.mapBpStr)
						toast({ body: "Blueprint string copied to clipboard.", duration: 3000, color: "#0F0" })
					}).catch(() => toast({ body: "Unable to copy to clipboard: no permission.", duration: 5000, color: "#F00" }))
			}
			return e.preventDefault()
		}
	}

	const isBodyFocused = document.activeElement == document.body

	if (!e.repeat && e.shiftKey && ctrlMeta
		&& e.code == "KeyV"
		&& isBodyFocused
	) {
		navigator.clipboard.readText().then(str => {
			if (!str
				|| (editorMap.events.pointer.target && !editorMap.events.pointer.target.mapObject?.bgTileType)
				|| !importBpInput
			) return
			importBpInput.value = str
			dialogImportBp.open()
		}).catch(() => { })
		return
	}

	if (e.repeat) return
	if (e.code == "KeyN" && (isBodyFocused || dialogNew.hasFocus(true))) {
		e.preventDefault()
		dialogNew.toggle()
	} if (e.code == "KeyB" && (isBodyFocused || winMan.bpStr.win.hasFocus(true))) {
		e.preventDefault()
		if (winMan.bpStr.win.toggle()) {
			winMan.bpStr.setType("map")
			winMan.itemMatList.setType("map")
			winMan.buildOrder.setType("map")
		}
	}
})
