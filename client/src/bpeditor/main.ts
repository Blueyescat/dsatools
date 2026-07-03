import { getRecentBps, getSettings, sessionId, SettingsBool } from "./managers/webStorage.js"
import { toggleThrobber } from "/assets/throbber.js"
import { elByCls, loadHF, trigger, usesTouch } from "/main.js"

toggleThrobber("Loading editor...", true)

const elHeader = loadHF().header,
	url = new URL(location.href)

void (() => {
	const settings = getSettings()
	if (!settings.bools.has(SettingsBool.hideHeader) && !url.searchParams.has("nh")) {
		const elInfo = document.getElementById("hide-header-info")
		elHeader.style.display = "block"
		elInfo.style.removeProperty("display")
		document.getElementById("button-app-nav").addEventListener("pointerdown", () => {
			settings.bools.enable(SettingsBool.hideHeader)
			settings.save()
			elInfo.style.display = "none"
			elHeader.style.opacity = "0"
			setTimeout(() => {
				elHeader.style.display = "none"
				elHeader.style.removeProperty("opacity")
				trigger(window, "resize")
			}, 2000)
		}, { once: true })
	}
	const ulNav = document.getElementById("app-nav")
	for (const el of elHeader.querySelector("#header-content nav .dropdown ul").children)
		!el.querySelector(".active") && ulNav.append(el.cloneNode(true))
})()

export { usesTouch }

// Setup dsabp-js-img
import { setImagesPath } from "dsabp-js-img"
setImagesPath("../assets/game-images/")

// Setup PixiJS and init the app
import { Application, Assets } from "pixi.js"
Assets.loader.parsers.find(p => p.name == "loadTextures").test = () => true // broken with urls containing "?"

import "./ui/AngleInput.js"
import "./ui/FilterModeInput.js"
import "./ui/FixedAngleInput.js"
import "./ui/LoaderPointsInput.js"
import "./ui/LoaderPriorityInput.js"
import "./ui/MultiItemInput.js"
import "./ui/PusherModeInput.js"
import "./ui/uiMain.js"

import { EditorMap, Tool } from "./EditorMap.js"
import * as itemPicker from "./ui/itemPicker.js"
import { ItemSlot } from "./ui/ItemSlot.js"

import { initMods } from "./managers/mods.js"
import * as UI from "./ui/uiMain.js"
import { setSelectedItem, setSelectedTool, updateCursor } from "./util.js"
import { toast } from "/Toast.js"
window["toast"] = toast

const querySource = url.searchParams.get("load")?.replaceAll(" ", "+"),
	sessionSource = !querySource && getRecentBps()[sessionId]?.str,
	queryCollabRoom = url.searchParams.get("collab")

// "DSA:pVDLSsNAFL2TPiJJS6aQtks/wI3+gQH9jlBsUgOxlbaCy9uuQhZhot3U7/Af/AQXggpFFFRQ10Kdmwx2YZBCV3PmzD3n3DMC2m0hwLTxlempgGoDX1hJAl2CyZJJxInSiOL4Nrkhiln4Pl1+boOUsFlZAKSS3WrhEzoSmC18lAfYuJgy2AeiIt+/cPCWaMBnRbPZgbzHdT8Ix97QPRr0/aAHAtK4pqhg7J2MJCMT4nr+7oaDTtcbgtAqjNtJklJ2zcJv8jss8mN//HBeZFhl2q+hqQw3WVCH1YKG8tslv//Ep2ejYxIzAC0x8nIcv0i7t65WfvG1rcSGEjdJbHb6vdBz/eDc69K/ZE05PmzatFxaNWU8b1oQqGUD0MgDLRqoZAMURE/R1dx1osXdpYMfNLKz/k4kb3K8l+AH"

const canvasContainer = document.getElementById("canvas-container"),
	canvas = document.getElementById("canvas-map") as HTMLCanvasElement

canvasContainer.addEventListener("contextmenu", e => e.preventDefault())

const modMan = await initMods()
itemPicker.init()

export let lastMultiTouchTime = 0
if (usesTouch) {
	const h = (e: TouchEvent) => e.touches.length > 1 && (lastMultiTouchTime = Date.now())
	canvas.addEventListener("touchstart", h)
	canvas.addEventListener("touchmove", h)
}

const elToolbar = document.getElementById("toolbar")
elToolbar.style.pointerEvents = "none"
export const radiosTools = document.getElementById("chips-tools").getElementsByTagName("input")
export const slotSelectedItem = document.getElementById("item-picker-preview") as ItemSlot
slotSelectedItem.allowDrag = true
slotSelectedItem.allowDrop = true

slotSelectedItem.addEventListener("change", () =>
	setSelectedItem(editorMap, slotSelectedItem.item, true)
)
// preload item picker
let itemPickerPreloading: boolean
if (location.hostname != "localhost") {
	itemPickerPreloading = true
	itemPicker.dialog.style.visibility = "hidden"
	itemPicker.open()
	setTimeout(() => {
		if (itemPickerPreloading) {
			itemPicker.close()
			itemPicker.dialog.style.removeProperty("visibility")
			itemPickerPreloading = null
		}
	}, 2000)
}

function openItemPicker(closeCb?: () => void, noFocus?: boolean) {
	if (itemPickerPreloading) {
		itemPicker.dialog.style.removeProperty("visibility")
		itemPickerPreloading = null
	}
	slotSelectedItem.classList.add("open")
	itemPicker.open(item => {
		slotSelectedItem.classList.remove("open")
		if (!item) return closeCb?.()

		itemPicker.close()
		slotSelectedItem.setItem(item)
	}, noFocus)
}

const slotClickHandler = (e: Event) => {
	e.preventDefault()
	if ("longTouch" in slotSelectedItem.dataset)
		return
	if (slotSelectedItem.classList.contains("open") && !itemPickerPreloading)
		return itemPicker.close(), slotSelectedItem.blur()
	openItemPicker()
}
slotSelectedItem.addEventListener("click", slotClickHandler)
slotSelectedItem.addEventListener("contextmenu", slotClickHandler)

export const app = new Application()
await app.init({
	canvas,
	// resizeTo: canvasContainer,
	width: canvasContainer.clientWidth,
	height: canvasContainer.clientHeight,
	resolution: window.devicePixelRatio,
	antialias: true,
	autoDensity: true,
	webgl: { useBackBuffer: true }
})

app.ticker.start()

export const editorMap = new EditorMap()
editorMap.mods = modMan
UI.setEditorMap(editorMap)

let { bpLoaded } = await editorMap.init(app, queryCollabRoom ? null : (querySource ?? sessionSource))

if (queryCollabRoom) {
	await editorMap.collab.joinRoom(queryCollabRoom, null, true)
	const collabState = editorMap.collab.state
	if (collabState.roomId) {
		toast({ body: `Successfully joined room '${collabState.roomId}'<br>${collabState.isRoomOwner ? "You are the room owner." : ""} `, duration: 8000, color: "#0F0" })
		if (collabState.isRoomOwner && sessionSource)
			bpLoaded = await editorMap.loadBlueprint(sessionSource)
	}
}

if (querySource && !queryCollabRoom && !bpLoaded)
	toast({ body: "The blueprint string from the URL is invalid.", duration: 10000, color: "#F00" })

UI.initUI()
UI.winMan.bpStr.setType("map")
UI.winMan.itemMatList.setType("map")
UI.winMan.buildOrder.setType("map")
if (bpLoaded) {
	editorMap.updateBpStr()
	if (querySource)
		toast({ body: "Successfully loaded the blueprint string from the URL.", duration: 6000, color: "#0F0" })
} else if (!(queryCollabRoom && !editorMap.collab.state.isRoomOwner)) {
	UI.winMan.welcome.open(true)
}

if (querySource) {
	url.searchParams.delete("load")
	history.replaceState(null, document.title, url.toString())
}

let lastCopiedBpStr: string
window.addEventListener("beforeunload", e =>
	location.hostname == "dt.tmp.bz" && !window["reloadingToUpdate"]
	&& editorMap.history.commands.length && lastCopiedBpStr != UI.winMan.bpStr.textareaBp.value
	&& e.preventDefault()
)

window.addEventListener("copy", () => lastCopiedBpStr = document.getSelection().toString())
window.addEventListener("cut", () => lastCopiedBpStr = document.getSelection().toString())

export const setLastCopiedBpStr = (str: string) => lastCopiedBpStr = str

for (const radio of radiosTools)
	radio.addEventListener("change", toolChangeHandler)
function toolChangeHandler(this: HTMLInputElement) {
	if (this.checked) {
		editorMap.info.selectedTool = this.value as Tool
		updateCursor(editorMap)
		editorMap.placement?.update()
		this.blur()
	}
	editorMap.emit("toolchange")
}

export const resetZoom = () => editorMap.viewport.setZoom(1, true).ensureVisible(-editorMap.squareSize * 1.5, -editorMap.squareSize * 1.5, 0, 0)

const PLACE_TOOL_KEY = "KeyF",
	PLACE_TOOL_KEY_OPEN_IPICKER_MS = 140,
	itemPickerSearchP = elByCls(itemPicker.dialog, "input-search")?.parentElement

let placeToolKeyTimer: number,
	placeToolKeyItemPickerOpen: boolean

window.addEventListener("keydown", e => {
	if (!e.ctrlKey && !e.metaKey && !e.repeat && document.activeElement == document.body) {
		if (e.code == "KeyC")
			resetZoom()
		else if (e.code == "KeyQ")
			setSelectedTool(editorMap, "select")
		else if (e.code == PLACE_TOOL_KEY) {
			setSelectedTool(editorMap, "place")
			if (!placeToolKeyItemPickerOpen) {
				placeToolKeyTimer = setTimeout(() => {
					itemPickerSearchP.style.display = "none"
					openItemPicker(() => {
						placeToolKeyItemPickerOpen = false
						itemPickerSearchP.style.removeProperty("display")
					}, true)
					placeToolKeyItemPickerOpen = true
				}, PLACE_TOOL_KEY_OPEN_IPICKER_MS)
			}
		} else if (e.code == "KeyE")
			setSelectedTool(editorMap, "eraser")
		else if (e.code == "KeyT")
			setSelectedTool(editorMap, "crop")
		else if (e.code == "KeyG")
			setSelectedTool(editorMap, "bpexport")
	}
})

window.addEventListener("keyup", e => {
	if (e.code == PLACE_TOOL_KEY) {
		if (placeToolKeyItemPickerOpen) {
			itemPicker.close()
		} else {
			clearTimeout(placeToolKeyTimer)
			placeToolKeyTimer = null
		}
	}
})

editorMap.emit("toolchange")
toggleThrobber()
window.removeEventListener("keydown", window["blockKeysHandler"])
delete window["blockKeysHandler"]
window.scrollTo(0, 0)
elToolbar.style.removeProperty("pointer-events")

if (usesTouch) (async () => {
	const m = await import("../assets/drag-drop-touch.esm.js")
	m.enableDragDropTouch()
})()
