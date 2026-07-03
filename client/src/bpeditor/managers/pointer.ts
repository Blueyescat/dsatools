import { PointData } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { MapObjectData } from "../MapObject.js"
import { SelectBox } from "../SelectBox.js"
import { createObject } from "../actions/createObject.js"
import { deleteObject } from "../actions/deleteObject.js"
import { lastMultiTouchTime, usesTouch } from "../main.js"
import { isKeyDown, setSelectedItem } from "../util.js"
import { pointerEvent } from "/main.js"

export type InteractionType = "down" | "up" | "move" | "cancel"

export function initPointer(editorMap: EditorMap) {
	const { info, placement, events, configs, app, selection, shapePlacement } = editorMap

	let lastPlacePos: PointData, placeMachineCooldown: boolean, lastyPlacedWithMove: boolean, lastMoveTouch: Touch
	const placeQueue = {}

	const handleClick = async (e: pointerEvent, isInterval?: boolean, isDouble?: boolean) => {
		if (isDouble)
			e.preventDefault()
		let target: HTMLElement
		if (e.type == "touchend") {
			const touch = (e as TouchEvent).changedTouches[0]
			target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement
		} else {
			target = e.target as HTMLElement
		}

		const type: InteractionType = (e.type == "mousedown" || e.type == "touchstart") ? "down"
			: (e.type == "mousemove" || e.type == "touchmove") ? "move"
				: (e.type == "mouseleave" ? "cancel" : "up")
		const isTouch = !!(e as TouchEvent).touches

		/* if (target == app.canvas) {
			e.preventDefault()
			if (type == "down")
				(document.activeElement as HTMLElement).blur?.()
		} */

		// do nothing for multi touch or in 500ms after a multi touch
		if (isTouch && (e as TouchEvent).touches.length > 1 || Date.now() - lastMultiTouchTime < 500)
			return

		const isLeft = isTouch || info.downPointer == 0,
			isTap = type == "up" || (!isTouch && info.downPointer != null && type == "move"),
			dragging = editorMap.info.dragging,
			targetBody = events.pointer.target,
			targetObject = targetBody?.mapObject

		if (isTouch && isTap)
			placement.check(events.pointer.body)

		let handled: boolean

		if (isLeft && info.selectedTool == "place" && lastPlacePos?.x == info.placementPos.x && lastPlacePos?.y == info.placementPos.y) {
			if (isDouble && targetObject && !targetObject.bgTileType)
				configs.openFor(targetObject.item, { mapObject: targetObject })
			return
		}

		if (target == app.canvas && !dragging && targetObject && !targetObject.bgTileType) {
			if (
				isTap
				&& !lastyPlacedWithMove
				&& type != "move"
				&& !isInterval // don't open config while holding down
				&& (
					(info.selectedTool == "select" && (isDouble || !isLeft)) // select: dbl-L or R config
					|| (info.selectedTool == "place" && isLeft && !info.placementCheckResult.can) // place: L config
					|| (info.selectedTool == "eraser" && !isLeft) // erase: R config
				)
			) {
				configs.openFor(targetObject.item, { mapObject: targetObject })
				handled = true
			} else if (
				(type == "down" || type == "move") && (isLeft && info.selectedTool == "eraser")
				|| ((type == "down" || (type == "move" && info.downPointer != null)) && !isLeft && info.selectedTool == "place") // place: R d
			) {
				deleteObject(targetBody.mapObject, true)
				placement.update()
					.then(() => placement.check(events.pointer.body))
				events.pointer.check()
				handled = true
			}
		}

		if (!handled && (!isTap || isLeft)/*  && (info.selectedTool == "select" || info.selectedTool == "crop") */) {
			selection.handlePointerEvent(e, type, isInterval, isDouble, target, lastMoveTouch)
			SelectBox.handlePointerEvent(e, type, isInterval, target, lastMoveTouch)
			editorMap.emit("pointeraction", { e, type, isInterval, isDouble, target, lastMoveTouch })
			// handled = true
		}

		if (info.selectedTool == "place" && !placeMachineCooldown && target == app.canvas && !handled && !dragging && isLeft) {
			if (shapePlacement.isActive && (type == "up" || !isKeyDown("shift"))) {
				shapePlacement.endLine()
			} else if (isKeyDown("shift")) {
				if (type == "down" && isKeyDown("shift") && !isInterval) {
					shapePlacement.startLine({ x: info.placementPos.x, y: info.placementPos.y })
				} else if (isTap && shapePlacement.isActive) {
					shapePlacement.updateLine()
					lastyPlacedWithMove = type == "move"
				}
			} else if (isTap && info.placementCheckResult.can) {
				const key = info.placementPos.x + "" + info.placementPos.y
				if (placeQueue[key] || !editorMap.hasLoadedBp)
					return

				if (!info.selectedItem.isBlock)
					placeMachineCooldown = true
				placeQueue[key] = true
				lastPlacePos = { x: info.placementPos.x, y: info.placementPos.y }
				shapePlacement.endLine()

				lastyPlacedWithMove = type == "move"

				const data: MapObjectData = {
					editorMap,
					x: info.placementPos.x,
					y: info.placementPos.y,
					item: info.selectedItem,
					buildInfoIndex: info.placementCheckResult.buildInfoIndex
				}

				const clipboardConfig = configs.getClipboardCfg(info.selectedItem)
				const clipboardShape = info.selectedItem.isBlock && configs.clipboardShape
				if (clipboardConfig)
					data.config = clipboardConfig.clone()
				if (clipboardShape)
					data.shape = clipboardShape

				await createObject(data, true)
				placeMachineCooldown = false

				placement.update()
					.then(() => placement.check(events.pointer.body))
				events.pointer.check()
				setTimeout(() => {
					delete placeQueue[key]
					lastPlacePos = null
				}, 200)
			}
		}

		if (type == "up" || type == "cancel")
			lastyPlacedWithMove = false
	}

	function handleMidleClick(e: MouseEvent) {
		const mapObj = events.pointer.target?.mapObject
		if (mapObj?.item) {
			const copyConfig = !e.ctrlKey && !e.metaKey
			if (copyConfig)
				configs.copy(mapObj, false)
			setSelectedItem(editorMap, mapObj.item)
		}
	}

	const DBL_CLK_MOVE_TH = 3, DBL_CLK_TIME = 350

	let pointerDownInterval: number, dblClkMoveCount = 0, dblClkLastAt = 0
	const onDown = (e: pointerEvent) => {
		clearInterval(pointerDownInterval)
		pointerDownInterval = setInterval(() => {
			if (Date.now() - dblClkLastAt > DBL_CLK_TIME)
				handleClick(e, true)
		}, 80)
		info.downPointer = (e as TouchEvent).touches ? 0 : (e as MouseEvent).button
		handleClick(e)
	}
	const onMove = (e: pointerEvent) => {
		if (window.TouchEvent && e instanceof TouchEvent)
			lastMoveTouch = e.changedTouches[0]
		if (++dblClkMoveCount == DBL_CLK_MOVE_TH)
			dblClkLastAt = 0
		if (Date.now() - dblClkLastAt > DBL_CLK_TIME)
			handleClick(e)
	}
	const onRelease = (e: pointerEvent) => {
		clearInterval(pointerDownInterval)
		const now = Date.now()
		handleClick(e, false, now - dblClkLastAt <= DBL_CLK_TIME)
		dblClkLastAt = now
		dblClkMoveCount = 0
		if (info.downPointer == ((e as TouchEvent).touches ? 0 : (e as MouseEvent).button))
			info.downPointer = null
	}

	window.addEventListener(pointerEvent.move, onMove)
	if (usesTouch) {
		window.addEventListener("touchstart", onDown)
		window.addEventListener("touchend", onRelease)
		window.addEventListener("touchcancel", onRelease)
	} else {
		document.getElementById("map-container").addEventListener("mousedown", e => {
			if (e.button == 0 || e.button == 2)
				onDown(e)
			else if (e.button == 1)
				handleMidleClick(e)
		})
		window.addEventListener("mouseup", e => (e.button == 0 || e.button == 2) && onRelease(e))
		window.addEventListener("mouseleave", onRelease)
	}
}
