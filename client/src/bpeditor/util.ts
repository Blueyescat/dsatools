import { Body, Box, Polygon } from "detect-collisions"

const isBox = (body: Body): body is Box => body instanceof Box
const isPolygon = (body: Body): body is Polygon => body instanceof Polygon

declare module "detect-collisions" {
	interface MapBody {
		mapObject?: import("./MapObject.js").MapObject
	}
	interface Line {
		pusher?: import("./MapObject.js").MapObject
	}
	interface Polygon extends MapBody { } // eslint-disable-line
	interface Circle extends MapBody { } // eslint-disable-line
}

export { isBox, isPolygon }

/************************************/

import { Blueprint, BuildCmd, ConfigCmd, FixedAngle, Item, Shape } from "dsabp-js"
import { PointData } from "pixi.js"
import { EditorMap, Tool } from "./EditorMap.js"
import { radiosTools, slotSelectedItem } from "./main.js"
import { MapObject, MapObjectData } from "./MapObject.js"
import { SelectBox } from "./SelectBox.js"
import { winMan } from "./ui/uiMain.js"
import { trigger, triggerCustom } from "/main.js"

export function fixPoint<T extends number | PointData>(n: T): T {
	if (n == null) return n
	if (typeof n != "number") {
		n.x = fixPoint(n.x)
		n.y = fixPoint(n.y)
		return n
	}
	return Math.round(n * 1e12) / 1e12 as T
}

export function scaleVertices(item: Item, buildInfoIndex: number, blockShape: Shape, squareSize: number) {
	const multiplier = squareSize + (item == Item.EXPANDO_BOX ? 2.1 : 0) // no idea why 2.1
	return (blockShape ? blockShape.vertices : item.buildInfo[buildInfoIndex].shape.verts)
		.map(({ x, y }) => ({
			x: x * multiplier,
			y: y * multiplier * (blockShape ? -1 : 1),
		}))
}

export function resizeVertices(verts: SAT.Vector[], up: number, right: number, down: number, left: number) {
	return verts.map(v => ({
		x: v.x + (v.x > 0 ? right : -left),
		y: v.y + (v.y > 0 ? down : -up)
	}) as SAT.Vector)
}

const regexPackaged = / \(Packaged\)|, Packaged/
export function getUnpackagedName(item: Item) {
	return item.name?.replace(regexPackaged, "")
}

export function handleNumberInput(input: HTMLInputElement, allowFloat = true) {
	const val = input.value
	if (val == "") return // ends with dot
	const num = Math.min(
		Number(input.max),
		Math.max(
			Number(input.min),
			(allowFloat ? Number(val) : parseInt(val))
		)
	)
	if (!val.endsWith("0"))
		input.value = num.toString()
	return num
}

export function setSelectedTool(editorMap: EditorMap, tool: Tool) {
	let found: boolean
	for (const radio of radiosTools) {
		if (radio.value == tool) {
			found = radio.checked = true
			trigger(radio, "change")
		}
	}
	if (!found) {
		for (const radio of radiosTools) {
			if (radio.checked) {
				radio.checked = false
				editorMap.info.selectedTool = tool
				trigger(radio, "change")
				break
			}
		}
	}
	editorMap.placement.update()
		.then(() => editorMap.placement.check(editorMap.events.pointer.body))
}

export function setSelectedItem(editorMap: EditorMap, item: Item, keepSlot?: boolean) {
	if (item == Item.NULL)
		item = null
	if (editorMap.info.selectedTool != "place" && item?.isBuildable)
		setSelectedTool(editorMap, "place")
	editorMap.info.selectedItem = item
	editorMap.placement.update()
		.then(() => editorMap.placement.check(editorMap.events.pointer.body))
	if (!keepSlot)
		slotSelectedItem.setItem(item ?? Item.NULL)
	editorMap.emit("itemchange")
}
export const isKeyDown = (() => {
	type Key = "ctrl" | "meta" | "shift" | "alt" | "r" | "w" | "a" | "s" | "d" | "up" | "right" | "down" | "left"
	const down = new Set<Key>(),
		map: Record<string, Key> = {
			KeyR: "r",
			KeyW: "w",
			KeyA: "a",
			KeyS: "s",
			KeyD: "d",
			ArrowUp: "up",
			ArrowRight: "right",
			ArrowDown: "down",
			ArrowLeft: "left"
		}

	const updateKey = (e: KeyboardEvent, isDown: boolean) => {
		const { ctrlKey, metaKey, shiftKey, altKey, code } = e,
			keyName = map[code]

		if (keyName) down[isDown ? "add" : "delete"](keyName)

		down[ctrlKey ? "add" : "delete"]("ctrl")
		down[metaKey ? "add" : "delete"]("meta")
		down[shiftKey ? "add" : "delete"]("shift")
		down[altKey ? "add" : "delete"]("alt")
	}

	window.addEventListener("keydown", e => updateKey(e, true))
	window.addEventListener("keyup", e => updateKey(e, false))
	window.addEventListener("blur", () => down.clear()) // may not work if devtools is open

	return (...keys: (Key | "ctrl|meta")[]) =>
		some(keys, key => key === "ctrl|meta" ? down.has("ctrl") || down.has("meta") : down.has(key))
})()

export function updateCursor(editorMap: EditorMap) {
	// setting events cursor changes cursor instantly, before moving it
	const ctrlMeta = isKeyDown("ctrl|meta"),
		{ info: { moving, dragging, selectedTool }, events, selection, app } = editorMap

	let cursor: string
	if (moving.length)
		cursor = "grabbing"
	else if (dragging)
		cursor = "move"
	else if ((selectedTool == "select" || selectedTool == "eraser") && !selection.selectBoxPrimary.isActive) {
		if (ctrlMeta && selectedTool == "select")
			cursor = "crosshair"
		else {
			const mapObj = events.pointer.target?.mapObject
			if (mapObj?.item)
				cursor = mapObj.isSelected ? (moving.length ? "grabbing" : "grab") : "pointer"
		}
	} else if (selection.selectBoxPrimary.isActive)
		cursor = "crosshair"
	else if (selectedTool == "crop" || selectedTool == "bpexport") {
		for (const sb of SelectBox.selectBoxes) {
			if (sb.disablePointerControl) continue

			const edges = { ...sb.hoverState }
			for (const key in sb.holdState)
				if (sb.holdState[key]) edges[key] = true

			if (ctrlMeta) cursor = "crosshair"
			else if (edges.middle) cursor = "move"
			else if (edges.top && edges.left) cursor = "nw-resize"
			else if (edges.top && edges.right) cursor = "ne-resize"
			else if (edges.right && edges.bottom) cursor = "se-resize"
			else if (edges.bottom && edges.left) cursor = "sw-resize"
			else if (edges.top) cursor = "n-resize"
			else if (edges.right) cursor = "e-resize"
			else if (edges.bottom) cursor = "s-resize"
			else if (edges.left) cursor = "w-resize"
			else if (!cursor) cursor = "crosshair"
		}
	}

	app.canvas.style.cursor = cursor ?? ""
}

export function getHullD8Rotation(hullDirection) {
	return hullDirection ? hullDirection.enumValue * 2 : 0
}

// may be adjusted for more inputs like range
const changeKeys = new Set(["ArrowUp", "ArrowDown"])
/**
 * The change event of a number input is triggered when arrow keys are
 * held down which is incorrect and not the case for the buttons.
 * 
 * The main purpose of this is to fix that issue, but additionally it
 * acts as a merge of input+change with the "end" detail.
 * 
 * Note that this doesn't check if the value was actually changed.
 * Listen for "c-input" event after calling this.
 */
export function addBetterInputEvent(el: HTMLElement) {
	let isKeyDown = false
	const call = (end = false) => triggerCustom(el, "c-input", { detail: { end } })
	const keyEvent = (e: KeyboardEvent) => {
		if (!changeKeys.has(e.key)) return
		isKeyDown = e.type == "keydown"
		if (!isKeyDown) call(true)
	}
	el.addEventListener("keydown", keyEvent)
	el.addEventListener("keyup", keyEvent)
	el.addEventListener("change", () => !isKeyDown && call(true))
	el.addEventListener("input", () => call())
}

export function objToData(o: MapObject, clone?: boolean): MapObjectData {
	return {
		editorMap: o.editorMap,
		x: o.x,
		y: o.y,
		item: o.item,
		bgTileType: o.bgTileType,
		shape: o.shape,
		config: clone ? o.config.clone() : o.config,
		buildInfoIndex: o.buildInfoIndex,
		hullDirection: o.hullDirection
	}
}

export type SerializedMapObjectData = ReturnType<typeof serializeMapObjectData>
export function serializeMapObjectData({ buildInfoIndex, config, shape, hullDirection, item, x, y }: MapObjectData) {
	return [
		x,
		y,
		item?.id,
		config?.toArray(),
		shape?.enumValue,
		hullDirection?.enumValue,
		buildInfoIndex
	] as [x: number, y: number, item: number, config: any[], shape: number, hullDirection: number, buildInfoIndex: number]
}
export function deserializeMapObjectData([x, y, item, config, shape, hullDirection, buildInfoIndex]: SerializedMapObjectData) {
	const result = { buildInfoIndex, x, y } as MapObjectData
	if (config != null)
		result.config = new ConfigCmd().fillFromArray(config)
	if (shape != null)
		result.shape = Shape.getByValue(shape)
	if (hullDirection != null)
		result.hullDirection = FixedAngle.getByValue(hullDirection)
	if (item != null)
		result.item = Item.getByValue(item)
	return result
}

export function chunkArr<T>(array: T[], chunkSize: number): T[][] {
	const r = []
	for (let i = 0, len = array.length; i < len; i += chunkSize)
		r.push(array.slice(i, i + chunkSize))
	return r
}

export function some<T>(array: T[], cb: (item: T, index: number) => unknown) {
	for (let i = 0, l = array.length; i < l; i++)
		if (cb(array[i], i))
			return true
	return false
}

export function deepEquals<T>(a: T, b: T, { ignoreArrayOrder = false } = {}): boolean {
	if (a === b) return true
	if (a?.constructor !== b?.constructor) return false

	if (ignoreArrayOrder && Array.isArray(a) && Array.isArray(b)) {
		a = a.slice().sort() as T
		b = b.slice().sort() as T
	}

	const keysA = Object.keys(a)
	return a && b
		&& typeof a === "object" && typeof b === "object"
		? (keysA.length === Object.keys(b).length
			&& keysA.every(key => deepEquals(a[key], b[key], { ignoreArrayOrder })))
		: a === b
}

export function getBpInfoHtml(bp: Blueprint, bpStr: string, noCannons?: boolean) {
	const reqW = bp.width - 11,
		reqH = bp.height - 8,
		buildCmdAmount = bp.commands.filter(c => c instanceof BuildCmd).length
	let buildAmount = 0

	for (const cmd of bp.commands)
		if (cmd instanceof BuildCmd)
			buildAmount += cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1

	const rcdCost = Math.ceil(buildAmount / 10)

	return /*html*/`
		<li><b>${bp.width}</b> width, <b>${bp.height}</b> height
		– for the starter ship: <b>${reqW > 0 ? "+" : ""}${reqW}</b> width, <b>${reqH > 0 ? "+" : ""}${reqH}</b> height.
		${noCannons ? "" : `Can fit <b>${Math.trunc((bp.width - 2) / 3 * 10) / 10}</b>x<b>${Math.trunc((bp.height - 2) / 3 * 10) / 10}</b> cannons.`}</li>

		<li>Building with RCD costs <b>${rcdCost}</b> flux crystal${rcdCost == 1 ? "" : "s"}.</li>

		<li><a class="a-itemmatlist no-link no-select">${winMan.itemMatList.MAIN_TITLE}</a></li>
		
		<li><a class="a-buildorder no-link no-select">${winMan.buildOrder.MAIN_TITLE}</a></li>

		<li>${bpStr.length} characters – ${buildCmdAmount} build and ${bp.commands.length - buildCmdAmount} config commands.</li>
	`
}

export function setQueryParam(key: string, value: string) {
	const url = new URL(window.location.href)
	if (value === null)
		url.searchParams.delete(key)
	else
		url.searchParams.set(key, value)
	window.history.replaceState(null, document.title, url.toString())
}
