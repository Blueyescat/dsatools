import { Body, deg2rad } from "detect-collisions"
import { ConfigCmd, FixedAngle, Item, LoaderPoint, Shape } from "dsabp-js"
import { PointData } from "pixi.js"
import { connectObject } from "../actions/connectObject.js"
import { createObject } from "../actions/createObject.js"
import { deleteObject } from "../actions/deleteObject.js"
import { disconnectObject } from "../actions/disconnectObject.js"
import { moveObject } from "../actions/moveObject.js"
import { updateObject } from "../actions/updateObject.js"
import { checkPlacement } from "../checkPlacement.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject, MapObjectData } from "../MapObject.js"
import { SelectBox } from "../SelectBox.js"
import { winMan } from "../ui/uiMain.js"
import { fixPoint, isKeyDown, objToData, some, updateCursor } from "../util.js"
import { ConfigDiff, getConfigDiff, pathToObject } from "./configs.js"
import { InteractionType } from "./pointer.js"
import { Dialog } from "/Dialog.js"
import { elByCls, linkRangeNumber, pointerEvent, triggerCustom, usesTouch } from "/main.js"

const KEY_CUT = "KeyX", KEY_COPY = "KeyC", KEY_PASTE = "KeyV", KEY_DUPLICATE = "KeyD"

const btnMenuCut = document.getElementById("button-menu-cut"),
	btnMenuCopy = document.getElementById("button-menu-copy"),
	btnMenuPaste = document.getElementById("button-menu-paste"),
	btnMenuDuplicate = document.getElementById("button-menu-duplicate"),
	btnMenuDelete = document.getElementById("button-menu-delete"),

	btnMenuSelFlipH = document.getElementById("button-menu-sel-flip-h"),
	btnMenuSelFlipV = document.getElementById("button-menu-sel-flip-v"),
	btnMenuMapFlipH = document.getElementById("button-menu-map-flip-h"),
	btnMenuMapFlipV = document.getElementById("button-menu-map-flip-v"),

	btnMenuSelRotate = document.getElementById("button-menu-sel-rotate"),
	btnMenuSelRotate90l = document.getElementById("button-menu-sel-rotate-90l"),
	btnMenuSelRotate90r = document.getElementById("button-menu-sel-rotate-90r"),
	btnMenuSelRotate180 = document.getElementById("button-menu-sel-rotate-180"),

	btnMenuMapRotate90l = document.getElementById("button-menu-map-rotate-90l"),
	btnMenuMapRotate90r = document.getElementById("button-menu-map-rotate-90r"),
	btnMenuMapRotate180 = document.getElementById("button-menu-map-rotate-180")


export type MovingUndoRedoData = {
	currPos: PointData,
	fromPos: PointData,
	item: Item,
	object?: MapObject
}
export type ConfiguringUndoRedoData = {
	undoShape: Shape
	redoShape: Shape
	configDiff: ConfigDiff
	object?: MapObject
}
export type MovingConfiguringUndoRedoData = MovingUndoRedoData & ConfiguringUndoRedoData

export function initSelection(editorMap: EditorMap) {
	const { viewport, app, events, collisions, info, placement, squareSize, history, bpRenderer, bp } = editorMap

	const selectBoxPrimary = new SelectBox({
		editorMap,
		lineWidth: 2,
		onSelectionStarted: e => {
			// connect crop box
			if (isCropT && (!selectBoxPrimary.selectedWhileDrag || selectBoxPrimary.isStickyActive))
				selectBoxCrop.startSelection(e)
			// clear selected objects
			initialSelectedObjects = new Set(selectedObjects)
			deselectedObjects.clear()
			if (!(isCropT || e.shiftKey || e.ctrlKey || e.metaKey))
				clearSelection()

			updateCursor(editorMap)
		},
		onSelectionStartedByTouch: () => {
			// clear selected objects
			initialSelectedObjects = new Set(selectedObjects)
			deselectedObjects.clear()
			if (isSelectT)
				clearSelection()
		},
		onSelectionUpdated: () => {
			// select objects
			const ctrlMeta = isKeyDown("ctrl|meta"),
				inBox = new Set<MapObject>(),
				newlySelected = new Set<MapObject>()

			collisions.checkOne(selectBoxPrimary.body, res => {
				const obj = (res.b as Body).mapObject
				if (!obj) return
				inBox.add(obj) // bg?
				if (res.bInA && !obj.bgTileType) {
					if (isSelectT && ctrlMeta && initialSelectedObjects.has(obj)) {
						deselectObject(obj)
						deselectedObjects.add(obj)
					} else if (isSelectT && ctrlMeta && deselectedObjects.has(obj)) {
						selectObject(obj)
						deselectedObjects.delete(obj)
					} else {
						selectObject(obj)
						newlySelected.add(obj)
					}
				}
			})

			if (ctrlMeta || isCropT)
				deselectedObjects.forEach(o => !inBox.has(o) && selectObject(o))

			selectedObjects.forEach(o =>
				(isSelectT && (ctrlMeta || isKeyDown("shift")) ? !initialSelectedObjects.has(o) : true) && !newlySelected.has(o) && deselectObject(o)
			)
			onSelectionChange()

			// connect crop box
			if (isCropT) {
				selectBoxCrop.isStickyActive = true
				selectBoxCrop.lastMinPoint = selectBoxPrimary.lastMinPoint
				selectBoxCrop.lastMaxPoint = selectBoxPrimary.lastMaxPoint
				selectBoxCrop.updateSelection()
			}

		},
		onSelectionEnded: (esc) => {
			// connect crop box
			const wasCrop = selectBoxCrop.isStickyActive
			if (wasCrop || esc) {
				selectBoxCrop.endSelection(esc)
				if (wasCrop) {
					for (const o of selectedObjects)
						o.isSelected = false
					selectedObjects.clear()
					onSelectionChange()
				}
			}
		}
	})

	const selectBoxCrop = new SelectBox({
		editorMap,
		lineWidth: 2,
		color: 0x00FFFF,
		disablePointerControl: true,
		sticky: true,
		enableSnapping: true,
		enableSizeIndicator: true
	})

	const selectedObjects = new Set<MapObject>(),
		deselectedObjects = new Set<MapObject>(),
		objectsClipboard: MapObjectData[] = []

	let initialSelectedObjects = new Set<MapObject>(),
		isCropT = info.selectedTool == "crop",
		isSelectT = info.selectedTool == "select"

	/* OBJECT SELECTION */
	function onSelectionChange() {
		[btnMenuCut, btnMenuCopy, btnMenuDuplicate, btnMenuDelete, btnMenuSelFlipH, btnMenuSelFlipV, btnMenuSelRotate, btnMenuSelRotate90l, btnMenuSelRotate90r, btnMenuSelRotate180]
			.forEach(el => el.classList.toggle("disabled", selectedObjects.size == 0))
		editorMap.emit("selectionchange")
	}
	onSelectionChange()

	function selectObject(obj: MapObject) {
		obj.isSelected = true
		selectedObjects.add(obj)
	}
	function deselectObject(obj: MapObject) {
		obj.isSelected = false
		selectedObjects.delete(obj)
	}
	function clearSelection(noUpdate?: boolean) {
		if (selectedObjects.size)
			selectedObjects.forEach(o => o.isSelected = false)
		selectedObjects.clear()
		if (!noUpdate)
			onSelectionChange()
	}

	window.addEventListener("keydown", e => {
		if (document.activeElement == document.body) {
			if (e.key == "Enter" && !e.repeat) crop()
			else if (e.key == "Delete") deleteObjects()
		}
	})

	btnMenuDelete.addEventListener("click", () => deleteObjects())

	editorMap.on("toolchange", () => {
		isCropT = info.selectedTool == "crop"
		isSelectT = info.selectedTool == "select"
		const enableBoxes = isCropT || info.selectedTool == "select"

		stopMovingObjects()

		editorMap.background.toggleGrid(isCropT)

		selectBoxPrimary.toggle(enableBoxes)
		selectBoxCrop.toggle(enableBoxes)

		if (enableBoxes) {
			selectBoxPrimary.endSelection(true)
			selectBoxPrimary.sticky = isCropT
			selectBoxPrimary.lineWidth = isCropT ? 4 : 2
			selectBoxCrop.enableSnapping = isCropT ? { objects: selectedObjects } : false
			selectBoxPrimary.preventStartingOnObjects = isSelectT
		}
	})

	function selectSingle(e: MouseEvent | TouchEvent, keepOthers = false, forceSelect = false) {
		const mapObj = editorMap.events.pointer.target?.mapObject
		if (!mapObj?.item) return false

		if (!keepOthers && !(e.ctrlKey || e.metaKey) && !e.shiftKey)
			clearSelection()

		if (mapObj) {
			if (!forceSelect && mapObj.isSelected)
				selectedObjects.delete(mapObj)
			else
				selectedObjects.add(mapObj)
			mapObj.isSelected = forceSelect || !mapObj.isSelected
		}
		onSelectionChange()
		updateCursor(editorMap)
		return true
	}

	editorMap.on("coll-pointerover", () => updateCursor(editorMap))
	editorMap.on("coll-pointerout", () => updateCursor(editorMap))

	/* MOVING */
	let isMoving = false, movingSnapX: boolean, movingSnapY: boolean
	function startMovingObjects(objects: MapObject[], pointerPos: PointData) {
		isMoving = true
		movingSnapX = movingSnapY = null
		info.moving.length = 0
		const isMultiple = objects.length > 1
		for (const object of objects) {
			info.moving.push({
				object,
				from: { x: object.x, y: object.y },
				offset: {
					x: object.body.x - pointerPos.x,
					y: object.body.y - pointerPos.y
				},
				initialValidity: object.isValid
			})
			if (isMultiple)
				object.isDisabled = true
			movingSnapX ??= object.item.buildInfo[0].snap_x
			movingSnapY ??= object.item.buildInfo[0].snap_y
		}
		if (isMultiple)
			for (const object of objects)
				disconnectObject(object, objects)

		updateCursor(editorMap)
		placement.update()
	}

	async function updateMovingObject(obj: MapObject, wPoint: PointData, bpPoint: PointData, movingInfo: Partial<EditorMap["info"]["moving"][0]>, movingMultiple: boolean, shouldCheckPlacement = true, thrust = false) {
		const result = { objectUpdated: false }
		const { snap_x, snap_y, offset, offset2 } = obj.item.buildInfo?.[obj.buildInfoIndex] ?? {}
		const body = obj.body

		fixPoint(bpPoint)
		wPoint ??= editorMap.toWorldPoint(bpPoint)
		fixPoint(wPoint)

		const pos = movingMultiple ? wPoint : placement.calc(wPoint, snap_x, snap_y, offset, offset2)
		bpPoint ??= editorMap.toBpPoint(pos)

		const previousHullDir = shouldCheckPlacement && obj.hullDirection
		if (previousHullDir) {
			const hullDirection = editorMap.getHullDirection(bpPoint.x, bpPoint.y)
			if (hullDirection && hullDirection != previousHullDir) {
				obj.hullDirection = hullDirection
				await updateObject(obj, { keepBpStr: true, keepServer: true })
				result.objectUpdated = true
			}
		}

		const res = shouldCheckPlacement && (
			!movingMultiple && editorMap.pusherBeams.updateHittingPushers(body, true),
			body.setPosition(pos.x, pos.y),
			checkPlacement(editorMap, obj.item, body, bpPoint.x, bpPoint.y, obj.buildInfoIndex, { separate: !movingMultiple && !thrust, passReqBlocksCheck: true })
		)

		if (movingMultiple || !shouldCheckPlacement || res.can) {
			moveObject(obj, null, shouldCheckPlacement ? body : pos, movingMultiple ? { all: true, server: true } : null)
			obj.isValid = (shouldCheckPlacement
				? movingInfo.lastMeetsReq = res.can && res.meetsRequirements
				: movingInfo.initialValidity)
			movingInfo.lastValidPos = { x: obj.x, y: obj.y }

			if (!movingMultiple)
				events.pointer.check(true)
		} else {
			moveObject(obj, movingInfo.lastValidPos ?? movingInfo.from)
			if (obj.hullDirection != previousHullDir) {
				obj.hullDirection = previousHullDir
				await updateObject(obj)
				result.objectUpdated = true
			}
			obj.isValid = movingInfo.lastMeetsReq ?? movingInfo.initialValidity
			events.pointer.check(true)

			if (!thrust && res.separateFailed) {
				const { snap_x, snap_y } = obj.item.buildInfo[obj.buildInfoIndex]
				let dirX = pos.x - body.x
				let dirY = pos.y - body.y
				if (!(dirX == 0 && dirY == 0)) {
					const distance = Math.sqrt(dirX ** 2 + dirY ** 2)
					dirX /= distance
					dirY /= distance
					const forceX = dirX * (snap_x ? squareSize : 4)
					const forceY = dirY * (snap_y ? squareSize : 4)
					updateMovingObject(obj, { x: body.x + forceX, y: body.y + forceY }, null, movingInfo, false, shouldCheckPlacement, true)
				}
			}
		}
		return result
	}

	let lastMovePointerX: number, lastMovePointerY: number, lastGroupX: number, lastGroupY: number
	async function updateMovingObjects(pointerPos: PointData, last?: boolean) {
		if (info.moving.length > 1) {
			const shouldCheckPlacement = last || (pointerPos.x == lastMovePointerX || pointerPos.y == lastMovePointerY)
			lastMovePointerX = pointerPos.x
			lastMovePointerY = pointerPos.y

			const refMovingInfo = info.moving.find(movingInfo => movingInfo.object.item.buildInfo[0].snap_x == movingSnapX && movingInfo.object.item.buildInfo[0].snap_y == movingSnapY)
			const refBuildInfo = refMovingInfo.object.item.buildInfo[refMovingInfo.object.buildInfoIndex]

			const groupPos = placement.calc({
				x: pointerPos.x + refMovingInfo.offset.x,
				y: pointerPos.y + refMovingInfo.offset.y
			}, movingSnapX, movingSnapY, refBuildInfo.offset, refBuildInfo.offset2)

			if (!last && (groupPos.x == lastGroupX && groupPos.y == lastGroupY))
				return

			if (shouldCheckPlacement) {
				lastGroupX = groupPos.x
				lastGroupY = groupPos.y
			}

			const baseX = groupPos.x - refMovingInfo.offset.x
			const baseY = groupPos.y - refMovingInfo.offset.y

			for (const movingInfo of info.moving) {
				updateMovingObject(movingInfo.object, {
					x: baseX + movingInfo.offset.x,
					y: baseY + movingInfo.offset.y
				}, null, movingInfo, true, shouldCheckPlacement)
			}
			events.pointer.check(true)
		} else {
			const movingInfo = info.moving[0]
			updateMovingObject(movingInfo.object, {
				x: pointerPos.x + movingInfo.offset.x,
				y: pointerPos.y + movingInfo.offset.y,
			}, null, movingInfo, false)
		}
	}

	async function movingUndoRedo(currPos: PointData, targetPos: PointData, item: Item, previousHullDir: FixedAngle) {
		const obj = editorMap.getObjectByPos(currPos.x, currPos.y, o => o.item == item)
		if (!obj) return // ignore invalid
		moveObject(obj, targetPos)

		const hullDirection = editorMap.getHullDirection(obj.x, obj.y)
		if (hullDirection) {
			obj.hullDirection = hullDirection
			await updateObject(obj, { keepBpStr: true })
		}

		const res = checkPlacement(editorMap, obj.item, obj.body, obj.x, obj.y, obj.buildInfoIndex)
		obj.isValid = res.can && res.meetsRequirements && !(previousHullDir && hullDirection == null)

		events.pointer.check(true)
	}

	function movingMultipleUndoRedo(undoRedoData: MovingUndoRedoData[], isUndo: boolean) {
		moveConfigMultipleUndoRedo({ type: "moving", data: undoRedoData }, isUndo)
	}

	function movingConfiguringMultipleUndoRedo(undoRedoData: MovingConfiguringUndoRedoData[], isUndo: boolean) {
		return moveConfigMultipleUndoRedo({ type: "movingAndConfig", data: undoRedoData }, isUndo)
	}

	async function moveConfigMultipleUndoRedo(
		param: { type: "moving", data: MovingUndoRedoData[] }
			| { type: "movingAndConfig", data: MovingConfiguringUndoRedoData[] },
		isUndo: boolean
	) {
		const { type, data } = param,
			objects: MapObject[] = []

		for (const info of data) {
			const pos = isUndo ? info.currPos : info.fromPos

			let obj: MapObject, origObj: MapObject
			const posObjects = editorMap.posToObject[pos.x]?.[pos.y]
			if (posObjects) for (const o of posObjects) {
				if (!o.isDisabled && !o.bgTileType && o.item == info.item) {
					if (!origObj) origObj = o
					else obj = o
				}
			}
			if (origObj && !obj) {
				obj = origObj
				origObj = null
			}
			if (!obj) continue // ignore invalid
			info.object = obj

			objects.push(obj)
			obj.isDisabled = true
			disconnectObject(obj)
		}

		data.sort(a => a.object?.item.isBlock ? -1 : 1) // ignore invalid

		const move = (info: MovingUndoRedoData) => {
			const { object, fromPos, currPos } = info
			object.isDisabled = false
			const targetPos = isUndo ? fromPos : currPos
			moveObject(object, targetPos, editorMap.toWorldPoint(targetPos), { all: true, server: true })
		}

		if (type == "movingAndConfig") {
			for (const info of data) {
				if (!info.object) continue // ignore invalid

				move(info)
				const { object, configDiff, undoShape, redoShape } = info

				if (configDiff?.length)
					for (const { path, prev, curr } of configDiff)
						pathToObject(object.config, path, (isUndo ? prev : curr) ?? pathToObject(ConfigCmd.defaults, path))

				const s = isUndo ? undoShape : redoShape
				if (s) object.shape = s

				await updateObject(object, { keepBpStr: true, keepServer: true })
			}
		} else {
			for (const info of data)
				if (info.object) move(info) // ignore invalid
		}

		editorMap.emit("objectsmoveconfig", objects.sort(a => a.item.isBlock ? -1 : 1),
			data.reduce((acc: any, info) => {
				if (info.object) // ignore invalid
					acc.push(isUndo ? info.currPos : info.fromPos)
				return acc
			}, [] as any) as any
		)

		data.forEach(info => delete info.object) // get rid of object references, data may be reused

		for (const o of objects)
			connectObject(o, objects)
		objects.length = 0
		events.pointer.check(true)
		editorMap.updateBpStr()
	}

	function stopMovingObjects() {
		if (!isMoving) return
		isMoving = false
		if (info.moving.length > 1) {
			let didNotMove: boolean
			const undoRedoData: MovingUndoRedoData[] = []
			for (const movingInfo of info.moving) {
				const { object: { x, y, item }, from } = movingInfo
				if (x == from.x && y == from.y) {
					didNotMove = true
					break
				}
				undoRedoData.push({
					currPos: { x, y },
					fromPos: { x: from.x, y: from.y },
					item
				})
			}

			const objects = info.moving.map(i => i.object)

			if (!didNotMove) {
				history.add({
					type: "moveObjects",
					undo: () => movingMultipleUndoRedo(undoRedoData, true),
					redo: () => movingMultipleUndoRedo(undoRedoData, false)
				})
				editorMap.emit("objectsmoveconfig", objects, undoRedoData.map(data => data.fromPos))
			}

			// objects are now sorted, update blocks first
			objects.sort(o => o.item.isBlock ? -1 : 1)

			for (const o of objects) {
				o.isDisabled = false
				editorMap.addObjectPos(o)
			}

			for (const o of objects)
				connectObject(o, objects)
		} else {
			const { object, from } = info.moving[0]
			const { x, y, hullDirection, item } = object
			if (x != from.x || y != from.y)
				history.add({
					type: "moveObject",
					undo: () => movingUndoRedo({ x, y }, { x: from.x, y: from.y }, item, hullDirection),
					redo: () => movingUndoRedo({ x: from.x, y: from.y }, { x, y }, item, hullDirection)
				})
		}

		info.moving.length = 0
		updateCursor(editorMap)
		editorMap.updateBpStr()
	}

	/* DELETING */
	function deleteObjects() {
		const size = selectedObjects.size
		if (!size) return

		const objectsArr = Array.from(selectedObjects).sort(a => a.item.isBlock ? -1 : 1)

		editorMap.emit("objectsdelete", objectsArr, { all: true, server: true })

		const undoRedoData: MapObjectData[] = []
		for (const o of objectsArr) {
			undoRedoData.push(objToData(o))
			deleteObject(o, false, { all: true, server: true })
		}
		for (const data of undoRedoData)
			editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
				!some(undoRedoData, data => data.x == tx && data.y == ty)
			)

		history.add({
			type: `deleteObject${size > 1 ? "s" : ""}`,
			undo: async () => {
				clearSelection()
				for (const data of undoRedoData)
					selectObject(await createObject(data, false, { bpStr: true }))
				onSelectionChange()
				events.pointer.check()
				editorMap.updateBpStr()
			},
			redo: () => {
				for (const data of undoRedoData) {
					const obj = editorMap.getObjectByPos(data.x, data.y, o => o.item == data.item)
					if (obj) { // ignore invalid
						deleteObject(obj, false, { all: true })
						editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
							!some(undoRedoData, data => data.x == tx && data.y == ty)
						)
					}
				}
				onSelectionChange()
				events.pointer.check()
				editorMap.updateBpStr()
			}
		})

		onSelectionChange()
		events.pointer.check()
		editorMap.updateBpStr()
	}

	/* CROPPING */
	async function crop() {
		const { isStickyActive: isBoxSticking, bbox: { minX, minY, maxX, maxY } } = selectBoxCrop
		if (!isBoxSticking)
			return

		const height = maxY - minY,
			undoRedoMoveData: MovingUndoRedoData[] = [],
			undoRedoDeleteData: MapObjectData[] = [],
			prevBpW = bp.width,
			prevBpH = bp.height,
			cropBpW = Math.trunc((maxX - minX) / squareSize),
			cropBpH = Math.trunc(height / squareSize),
			walls = {} as { top: boolean, right: boolean, bottom: boolean, left: boolean }

		// using primary box so bInA actually works for edge objects
		let w = 0
		collisions.checkOne(selectBoxPrimary.body, res => {
			const obj = (res.b as Body).mapObject
			if (!obj?.bgTileType || !res.bInA || w == 4)
				return
			/* eslint-disable @typescript-eslint/no-unused-expressions */
			if (!walls.top && obj.bgTileType == "wallH" && obj.y == prevBpH - 1)
				walls.top = true, ++w
			else if (!walls.right && obj.bgTileType == "wallV" && obj.x == prevBpW - 1)
				walls.right = true, ++w
			else if (!walls.bottom && obj.bgTileType == "wallH" && obj.y == 0)
				walls.bottom = true, ++w
			else if (!walls.left && obj.bgTileType == "wallV" && obj.x == 0)
				walls.left = true, ++w
			/* eslint-enable @typescript-eslint/no-unused-expressions */
		})

		const offset = {
			x: -Math.floor(minX / squareSize),
			y: -Math.floor((prevBpH * squareSize - minY - height) / squareSize) + 1
		}
		if (walls.left) offset.x -= 1
		if (walls.bottom) offset.y -= 1

		await editorMap.resize(
			cropBpW + (walls.right && cropBpW != 1 ? 0 : 1) + (walls.left && cropBpW != 1 ? 0 : 1),
			cropBpH + (walls.top && cropBpH != 1 ? 0 : 1) + (walls.bottom && cropBpH != 1 ? 0 : 1)
		)

		const sortedSelectedObjects = sortObjectsByZIndex(Array.from(selectedObjects))

		for (const o of sortedSelectedObjects) {
			o.isDisabled = true
			disconnectObject(o, sortedSelectedObjects)
		}

		for (const o of editorMap.objects)
			if (!o.isSelected && !o.bgTileType) {
				undoRedoDeleteData.push(objToData(o))
				deleteObject(o, false, { all: true })
			}

		for (const data of undoRedoDeleteData)
			editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
				!some(undoRedoDeleteData, data => data.x == tx && data.y == ty)
			)

		for (const o of sortedSelectedObjects) {
			const newPosBp = fixPoint({
				x: o.x + offset.x,
				y: o.y + offset.y
			})
			undoRedoMoveData.push({
				currPos: { x: newPosBp.x, y: newPosBp.y },
				fromPos: { x: o.x, y: o.y },
				item: o.item
			})
			await updateMovingObject(o, null, newPosBp, { initialValidity: o.isValid }, true)
		}

		editorMap.emit("objectsmoveconfig", sortedSelectedObjects, undoRedoMoveData.map(data => data.fromPos))

		const redoW = bp.width, redoH = bp.height
		history.add({
			type: "crop",
			undo: async () => {
				await editorMap.resize(prevBpW, prevBpH)
				movingMultipleUndoRedo(undoRedoMoveData, true)
				for (const data of undoRedoDeleteData)
					await createObject(data, false, { bpStr: true })
				events.pointer.check()
				editorMap.updateBpStr()
			},
			redo: async () => {
				await editorMap.resize(redoW, redoH)
				for (const data of undoRedoDeleteData) {
					const obj = editorMap.getObjectByPos(data.x, data.y, o => o.item == data.item)
					if (obj) { // ignore invalid
						deleteObject(editorMap.getObjectByPos(data.x, data.y, o => o.item == data.item), false, { all: true })
						await editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
							!some(undoRedoDeleteData, data => data.x == tx && data.y == ty)
						)
					}
				}
				movingMultipleUndoRedo(undoRedoMoveData, false)
				editorMap.updateBpStr()
				events.pointer.check()
			}
		})

		for (const o of sortedSelectedObjects) {
			o.isDisabled = false
			editorMap.addObjectPos(o)
		}
		for (const o of sortedSelectedObjects)
			connectObject(o, sortedSelectedObjects)

		viewport.scale.x = Math.min(viewport.scaled, viewport.screenWidth / viewport.worldWidth)
		viewport.scale.y = Math.min(viewport.scaled, viewport.screenHeight / viewport.worldHeight)
		if (viewport.scale.x < viewport.scale.y) viewport.scale.y = viewport.scale.x
		else viewport.scale.x = viewport.scale.y

		const space = -(squareSize / 2 + Math.round((squareSize / viewport.scaled) / squareSize) * squareSize)

		viewport.moveCorner(space, space)

		events.pointer.check(true)
		editorMap.updateBpStr()
		selectBoxPrimary.endSelection(true)
	}

	/* DUPLICATING */
	function addDuplicationHistory(undoRedoData: MapObjectData[]) {
		history.add({
			type: `duplicateObject${undoRedoData.length > 1 ? "s" : ""}`,
			undo: () => {
				for (const data of undoRedoData) {
					let obj: MapObject, origObj: MapObject

					const objects = editorMap.posToObject[data.x]?.[data.y]
					if (objects) for (const o of objects) {
						if (!o.isDisabled && !o.bgTileType) {
							if (!origObj) origObj = o
							else obj = o
						}
					}

					if (origObj && !obj) {
						obj = origObj
						origObj = null
					}

					deleteObject(obj, false)
					if (origObj)
						selectObject(origObj)
				}
				events.pointer.check()
				editorMap.updateBpStr()
			},
			redo: async () => {
				const newObjects: MapObject[] = []

				for (const data of undoRedoData)
					newObjects.push(await createObject(data, false, { bpStr: true }))
				clearSelection()
				for (const obj of newObjects) {
					selectObject(obj)
					obj.isValid = !editorMap.getObjectByPos(obj.x, obj.y,
						o => !o.bgTileType && o != obj
					)
				}

				events.pointer.check()
				editorMap.updateBpStr()
			}
		})
	}

	async function duplicateObjects() {
		if (!selectedObjects.size) return

		const undoRedoData: MapObjectData[] = [],
			newObjects: MapObject[] = []

		for (const obj of selectedObjects) {
			const data = objToData(obj, true)
			undoRedoData.push(data)
			newObjects.push(await createObject(data, false, { bpStr: true }))
		}
		clearSelection()
		for (const obj of newObjects) {
			selectObject(obj)
			obj.isValid = !editorMap.getObjectByPos(obj.x, obj.y,
				o => !o.bgTileType && o != obj
			)
		}

		addDuplicationHistory(undoRedoData)

		events.pointer.check()
		editorMap.updateBpStr()

		return newObjects
	}

	function copyCut(cut?: boolean) {
		if (!selectedObjects.size) return

		objectsClipboard.length = 0
		for (const o of selectedObjects)
			objectsClipboard.push(objToData(o, true))
		if (cut)
			deleteObjects()
		btnMenuPaste.classList.remove("disabled")
	}

	async function paste() {
		const undoRedoData: MapObjectData[] = [],
			newObjects: MapObject[] = []

		for (const data of objectsClipboard) {
			if (data.config)
				data.config = data.config.clone()
			undoRedoData.push(data)
			newObjects.push(await createObject(data, false, { bpStr: true }))
		}
		clearSelection()
		for (const obj of newObjects) {
			selectObject(obj)
			obj.isValid = !editorMap.getObjectByPos(obj.x, obj.y,
				o => !o.bgTileType && o != obj
			)
		}
		onSelectionChange()

		addDuplicationHistory(undoRedoData)

		events.pointer.check()
		editorMap.updateBpStr()
	}

	window.addEventListener("keydown", e => {
		if (!e.repeat && !e.shiftKey && (e.ctrlKey || e.metaKey)
			&& (document.activeElement == document.body || (winMan.findReplace.win.isOpen && winMan.findReplace.win.contains(document.activeElement)))
		) {
			if (e.code == KEY_COPY || e.code == KEY_CUT)
				copyCut(e.code == KEY_CUT)
			else if (e.code == KEY_DUPLICATE)
				duplicateObjects()
			else if (objectsClipboard.length && !events.pointer.target?.mapObject?.item && e.code == KEY_PASTE)
				paste()
		}
	})

	btnMenuCopy.addEventListener("click", () => copyCut())
	btnMenuCut.addEventListener("click", () => copyCut(true))
	btnMenuPaste.addEventListener("click", () => paste())
	btnMenuDuplicate.addEventListener("click", () => duplicateObjects())

	/* FLIPPING */
	const loaderFlipMap = {
		H: new Map([
			[LoaderPoint.TOP_LEFT, LoaderPoint.TOP_RIGHT],
			[LoaderPoint.LEFT, LoaderPoint.RIGHT],
			[LoaderPoint.BOTTOM_LEFT, LoaderPoint.BOTTOM_RIGHT]
		]),
		V: new Map([
			[LoaderPoint.TOP_LEFT, LoaderPoint.BOTTOM_LEFT],
			[LoaderPoint.TOP, LoaderPoint.BOTTOM],
			[LoaderPoint.TOP_RIGHT, LoaderPoint.BOTTOM_RIGHT]
		])
	}
	const shapeFlipMap = {
		H: new Map([
			[Shape.RAMP_DL, Shape.RAMP_DR],
			[Shape.RAMP_UL, Shape.RAMP_UR],
			[Shape.SLAB_L, Shape.SLAB_R],
			[Shape.HALF_RAMP_1_D, Shape.HALF_RAMP_1_DI],
			[Shape.HALF_RAMP_1_L, Shape.HALF_RAMP_1_RI],
			[Shape.HALF_RAMP_2_D, Shape.HALF_RAMP_2_DI],
			[Shape.HALF_RAMP_2_L, Shape.HALF_RAMP_2_RI],
			[Shape.HALF_RAMP_1_UI, Shape.HALF_RAMP_1_U],
			[Shape.HALF_RAMP_1_LI, Shape.HALF_RAMP_1_R],
			[Shape.HALF_RAMP_2_UI, Shape.HALF_RAMP_2_U],
			[Shape.HALF_RAMP_2_LI, Shape.HALF_RAMP_2_R],
			[Shape.HALF_RAMP_3_D, Shape.HALF_RAMP_3_DI],
			[Shape.HALF_RAMP_3_L, Shape.HALF_RAMP_3_RI],
			[Shape.HALF_RAMP_3_UI, Shape.HALF_RAMP_3_U],
			[Shape.HALF_RAMP_3_LI, Shape.HALF_RAMP_3_R],
			[Shape.QUARTER_DL, Shape.QUARTER_DR],
			[Shape.QUARTER_UL, Shape.QUARTER_UR],
			[Shape.QUARTER_RAMP_DL, Shape.QUARTER_RAMP_DR],
			[Shape.QUARTER_RAMP_UL, Shape.QUARTER_RAMP_UR],
			[Shape.BEVEL_DL, Shape.BEVEL_DR],
			[Shape.BEVEL_UL, Shape.BEVEL_UR]
		]),
		V: new Map([
			[Shape.RAMP_UR, Shape.RAMP_DR],
			[Shape.RAMP_UL, Shape.RAMP_DL],
			[Shape.SLAB_U, Shape.SLAB_D],
			[Shape.HALF_RAMP_1_R, Shape.HALF_RAMP_1_RI],
			[Shape.HALF_RAMP_2_R, Shape.HALF_RAMP_2_RI],
			[Shape.HALF_RAMP_1_UI, Shape.HALF_RAMP_1_D],
			[Shape.HALF_RAMP_1_DI, Shape.HALF_RAMP_1_U],
			[Shape.HALF_RAMP_1_LI, Shape.HALF_RAMP_1_L],
			[Shape.HALF_RAMP_2_UI, Shape.HALF_RAMP_2_D],
			[Shape.HALF_RAMP_2_DI, Shape.HALF_RAMP_2_U],
			[Shape.HALF_RAMP_2_LI, Shape.HALF_RAMP_2_L],
			[Shape.HALF_RAMP_3_R, Shape.HALF_RAMP_3_RI],
			[Shape.HALF_RAMP_3_L, Shape.HALF_RAMP_3_LI],
			[Shape.HALF_RAMP_3_UI, Shape.HALF_RAMP_3_D],
			[Shape.HALF_RAMP_3_DI, Shape.HALF_RAMP_3_U],
			[Shape.QUARTER_UR, Shape.QUARTER_DR],
			[Shape.QUARTER_UL, Shape.QUARTER_DL],
			[Shape.QUARTER_RAMP_DR, Shape.QUARTER_RAMP_UR],
			[Shape.QUARTER_RAMP_UL, Shape.QUARTER_RAMP_DL],
			[Shape.BEVEL_DR, Shape.BEVEL_UR],
			[Shape.BEVEL_UL, Shape.BEVEL_DL]
		])
	}

	for (const D of ["H", "V"]) {
		for (const [k, v] of shapeFlipMap[D])
			shapeFlipMap[D].set(v, k)
		for (const [k, v] of loaderFlipMap[D])
			loaderFlipMap[D].set(v, k)
	}

	async function flipObjects(objects: MapObject[], D: "H" | "V", flippingMap?: boolean) {
		if (!objects.length) return
		const isHorizly = D == "H",
			undoRedoData: MovingConfiguringUndoRedoData[] = []

		sortObjectsByZIndex(objects)

		for (const o of objects) {
			o.isDisabled = true
			disconnectObject(o, objects)
		}

		const [minX, minY, maxX, maxY] = getObjectsBBox(objects),
			length = Math.round((isHorizly ? minX + maxX : minY + maxY) / squareSize) * squareSize

		for (let i = 0; i < objects.length; i++) {
			const o = objects[i],
				cfg = o.config,
				origConfig = cfg.clone()

			const historyData = {} as MovingConfiguringUndoRedoData

			// flip configuration
			let update: boolean
			if (cfg.loader?.pickupPoint != null) {
				cfg.loader.pickupPoint = loaderFlipMap[D].get(cfg.loader.pickupPoint) ?? cfg.loader.pickupPoint
				update = true
			}

			if (cfg.loader?.dropPoint != null) {
				cfg.loader.dropPoint = loaderFlipMap[D].get(cfg.loader.dropPoint) ?? cfg.loader.dropPoint
				update = true
			}

			if (cfg.pusher?.angle != null) {
				cfg.pusher.angle = (isHorizly ? 180 : 360) - cfg.pusher?.angle
				if (cfg.pusher.angle < 0) cfg.pusher.angle += 360
				update = true
			}

			if (cfg.angle != null) {
				cfg.angle = (isHorizly ? 180 : 360) - cfg.angle
				if (cfg.angle < 0) cfg.angle += 360
				update = true
			}

			if (cfg.fixedAngle != null) {
				const a = cfg.fixedAngle
				if (isHorizly && (a == FixedAngle.RIGHT || a == FixedAngle.LEFT))
					cfg.fixedAngle = cfg.fixedAngle == FixedAngle.RIGHT ? FixedAngle.LEFT : FixedAngle.RIGHT
				else if (!isHorizly && (a == FixedAngle.UP || a == FixedAngle.DOWN))
					cfg.fixedAngle = cfg.fixedAngle == FixedAngle.UP ? FixedAngle.DOWN : FixedAngle.UP
				update = true
			}

			if (update)
				historyData.configDiff = getConfigDiff(origConfig, cfg)

			// flip shape
			if (o.shape) {
				historyData.undoShape = o.shape
				historyData.redoShape =
					o.shape = shapeFlipMap[D].get(o.shape) ?? o.shape
				update = true
			}

			// flip position
			const newPos = { x: o.body.x, y: o.body.y }
			if (isHorizly)
				newPos.x = length - newPos.x
			else
				newPos.y = length - newPos.y

			// apply
			const newPosBp = fixPoint(editorMap.toBpPoint(newPos))
			historyData.currPos = { x: newPosBp.x, y: newPosBp.y }
			historyData.fromPos = { x: o.x, y: o.y }
			historyData.item = o.item

			await updateMovingObject(o, newPos, newPosBp, { initialValidity: o.isValid }, true)
				.then(res => update && !res.objectUpdated && updateObject(o, { keepBpStr: true, keepServer: true }))
			undoRedoData.push(historyData)

			o.isDisabled = false
			editorMap.addObjectPos(o) // necessary?
		}

		editorMap.emit("objectsmoveconfig", objects, undoRedoData.map(data => data.fromPos))

		for (const o of objects)
			connectObject(o, objects)

		history.add({
			type: `flip${flippingMap ? "Map" : "Objects"}`,
			undo: async () => {
				await movingConfiguringMultipleUndoRedo(undoRedoData, true)
				events.pointer.check()
				editorMap.updateBpStr()
			},
			redo: async () => {
				await movingConfiguringMultipleUndoRedo(undoRedoData, false)
				editorMap.updateBpStr()
				events.pointer.check()
			}
		})

		events.pointer.check()
		editorMap.updateBpStr()
	}

	function flipMap(D: "H" | "V") {
		return flipObjects(Array.from(editorMap.objects).filter(o => !o.bgTileType), D, true)
	}

	btnMenuSelFlipH.addEventListener("click", () => flipObjects(Array.from(selectedObjects), "H"))
	btnMenuSelFlipV.addEventListener("click", () => flipObjects(Array.from(selectedObjects), "V"))
	btnMenuMapFlipH.addEventListener("click", () => flipMap("H"))
	btnMenuMapFlipV.addEventListener("click", () => flipMap("V"))

	/* ROTATING */
	const dialogRotation = new Dialog({
		draggable: { key: "rotate-objects" },
		title: "Rotate Objects",
		body: [/*html*/`
<p style="display: flex; align-items: center; gap: 0.2em;">
	<i class="i rotate-l-2"></i>Angle:
	<input type="range" min="0" max="360" style="width: 300px;">
	<input class="input-angle" type="number" style="width: 70px;">°
</p>
<p style="font-size: smaller;">Rotation won't attempt to snap each object.</p>`],
		footer: {
			html: /*html*/`
<button class="button-rotate">Rotate</button>`,
			closeButton: "Cancel"
		},
		onCreate(dialog) {
			linkRangeNumber(dialog.querySelector("input[type=range]"))

			const inputAngle = elByCls<HTMLInputElement>(dialog, "input-angle")

			elByCls(dialog, "button-rotate").addEventListener("click", () => {
				triggerCustom(dialog, "apply-rotation", { detail: { angle: parseInt(inputAngle.value) } })
				dialog.close()
			})
		}
	})

	const loaderRotationArr = [LoaderPoint.LEFT, LoaderPoint.BOTTOM_LEFT, LoaderPoint.BOTTOM, LoaderPoint.BOTTOM_RIGHT, LoaderPoint.RIGHT, LoaderPoint.TOP_RIGHT, LoaderPoint.TOP, LoaderPoint.TOP_LEFT]

	function rotateLoaderPoint(point: LoaderPoint, angle: number) {
		if (angle % 45 != 0)
			angle = Math.round(angle / 45) * 45
		const currentIndex = loaderRotationArr.indexOf(point),
			steps = Math.round(angle / 45),
			pointAmount = loaderRotationArr.length
		return loaderRotationArr[(currentIndex + steps + pointAmount) % pointAmount]
	}

	function rotateShape(shape: Shape, angle: number) {
		if (angle % 90 != 0)
			angle = Math.round(angle / 90) * 90
		const relativeIndex = (shape.enumValue - 1) % 4, // imaginary index of shape between 4 Shapes that are the same type
			groupIndex = shape.enumValue - relativeIndex // find index of the first shape in ^
		let newRelativeIndex = relativeIndex - angle / 90 // decrease the relative index (results in clockwise rotation)
		if (newRelativeIndex < 0)
			newRelativeIndex += 4
		return Shape.getByValue(groupIndex + newRelativeIndex)
	}

	function rotateFixedAngle(fixedAngle: FixedAngle, angle: number) {
		if (angle % 90 != 0)
			angle = Math.round(angle / 90) * 90
		return FixedAngle.getByValue((fixedAngle.enumValue + angle / 90) % 4)
	}

	function rotatePoint(point: PointData, center: PointData, cos: number, sin: number) {
		const dx = point.x - center.x,
			dy = point.y - center.y
		return {
			x: center.x + (dx * cos - dy * sin),
			y: center.y + (dx * sin + dy * cos)
		}
	}

	async function rotateObjects(objects: MapObject[], angle: number, rotatingMap?: boolean, resizingMap?: boolean) {
		if (!objects.length) return

		const radians = deg2rad(-angle),
			cos = Math.cos(radians),
			sin = Math.sin(radians),
			undoRedoData: MovingConfiguringUndoRedoData[] = []

		sortObjectsByZIndex(objects)

		for (const o of objects) {
			o.isDisabled = true
			disconnectObject(o, objects)
		}

		const [minX, minY, maxX, maxY] = getObjectsBBox(objects),
			middle = {
				x: (Math.round(((minX + maxX)) / squareSize) * squareSize) / 2,
				y: (Math.round(((minY + maxY)) / squareSize) * squareSize) / 2
			}

		for (let i = 0; i < objects.length; i++) {
			const o = objects[i],
				cfg = o.config,
				origConfig = cfg.clone()

			const historyData = {} as MovingConfiguringUndoRedoData

			// rotate configurations
			let update = false
			if (cfg.loader?.pickupPoint != null) {
				cfg.loader.pickupPoint = rotateLoaderPoint(cfg.loader.pickupPoint, angle)
				update = true
			}
			if (cfg.loader?.dropPoint != null) {
				cfg.loader.dropPoint = rotateLoaderPoint(cfg.loader.dropPoint, angle)
				update = true
			}
			if (cfg.pusher?.angle != null) {
				cfg.pusher.angle += angle
				if (cfg.pusher.angle < 0) cfg.pusher.angle += 360
				update = true
			}
			if (cfg.angle != null) {
				cfg.angle += angle
				if (cfg.angle < 0) cfg.angle += 360
				update = true
			}
			if (cfg.fixedAngle != null) {
				cfg.fixedAngle = rotateFixedAngle(cfg.fixedAngle, angle)
				update = true
			}

			if (update)
				historyData.configDiff = getConfigDiff(origConfig, cfg)

			if (o.shape && o.shape != Shape.BLOCK) {
				historyData.undoShape = o.shape
				historyData.redoShape =
					o.shape = rotateShape(o.shape, angle)
				update = true
			}

			// rotate position
			const newPos = rotatePoint(o.body, middle, cos, sin)
			if (resizingMap) {
				newPos.x -= (bp.height - bp.width) / 2 * squareSize // height = old width, width = new width
				newPos.y -= (bp.width - bp.height) / 2 * squareSize // width = old height, height = new height
			}

			// apply
			const newPosBp = fixPoint(editorMap.toBpPoint(newPos))

			historyData.currPos = { x: newPosBp.x, y: newPosBp.y }
			historyData.fromPos = { x: o.x, y: o.y }
			historyData.item = o.item

			await updateMovingObject(o, newPos, newPosBp, { initialValidity: o.isValid }, true)
				.then(res => update && !res.objectUpdated && updateObject(o, { keepBpStr: true, keepServer: true }))
			undoRedoData.push(historyData)

			o.isDisabled = false
			editorMap.addObjectPos(o)
		}

		editorMap.emit("objectsmoveconfig", objects, undoRedoData.map(data => data.fromPos))

		for (const o of objects)
			connectObject(o, objects)

		const handleHistory = async (isUndo?: boolean) => {
			if (resizingMap)
				await editorMap.resize(bp.height, bp.width)
			await movingConfiguringMultipleUndoRedo(undoRedoData, isUndo)
			events.pointer.check()
			editorMap.updateBpStr()
		}
		history.add({
			type: `rotate${rotatingMap ? "Map" : "Objects"}`,
			undo: () => handleHistory(true),
			redo: () => handleHistory()
		})

		events.pointer.check()
		editorMap.updateBpStr()
	}

	async function rotateMap(angle: number) {
		const resizeMap = angle != 180 && bp.width != bp.height
		if (resizeMap)
			await editorMap.resize(bp.height, bp.width)
		await rotateObjects(Array.from(editorMap.objects).filter(o => !o.bgTileType), angle, true, resizeMap)
	}

	btnMenuSelRotate.addEventListener("click", () =>
		dialogRotation.open().addEventListener("apply-rotation", ({ detail: { angle } }: CustomEvent<{ angle: number }>) => {
			if (!isNaN(angle))
				rotateObjects(Array.from(selectedObjects), angle)
		}, { once: true })
	)
	btnMenuSelRotate90l.addEventListener("click", () => rotateObjects(Array.from(selectedObjects), 90))
	btnMenuSelRotate90r.addEventListener("click", () => rotateObjects(Array.from(selectedObjects), 270))
	btnMenuSelRotate180.addEventListener("click", () => rotateObjects(Array.from(selectedObjects), 180))

	btnMenuMapRotate90l.addEventListener("click", () => rotateMap(90))
	btnMenuMapRotate90r.addEventListener("click", () => rotateMap(270))
	btnMenuMapRotate180.addEventListener("click", () => rotateMap(180))

	/* POINTER EVENTS */

	let downX: number, downY: number, lastMovedObjectsAt = 0,
		/** non-bg object at the pointer on down */
		downObject: MapObject
	function handlePointerEvent(e: pointerEvent, type: InteractionType, isInterval: boolean, isDouble: boolean, targetEl: HTMLElement, lastMoveTouch: Touch) {
		const sb = selectBoxPrimary,
			coords = isInterval && e.type == "touchstart" && lastMoveTouch ? lastMoveTouch : pointerEvent.getValues(e)

		if (isDouble && isCropT)
			return selectBoxPrimary.hoverState.middle ? crop() : (!selectBoxPrimary.hoverState.any && selectBoxPrimary.endSelection(true))

		const ctrlMeta = isKeyDown("ctrl|meta"), dragging = editorMap.info.dragging

		if (type == "down" && !isInterval) {
			if (targetEl == app.canvas) {
				downX = coords.clientX
				downY = coords.clientY
				downObject = e.shiftKey || ctrlMeta ? null : events.pointer.target?.mapObject
				if (downObject?.bgTileType)
					downObject = null
			} else {
				downObject = downX = downY = null
			}
		} else if (!sb.isActive && isSelectT && (!usesTouch || !dragging) && ((type == "move" || (usesTouch && type == "down")) || isInterval)) {
			if (!isInterval && info.downPointer != null && downObject && !isMoving) {
				if (selectSingle(e, selectedObjects.has(downObject), true)) {
					if (isKeyDown("alt"))
						duplicateObjects().then(objects =>
							startMovingObjects(objects, events.pointer.body)
						)
					else
						startMovingObjects(Array.from(selectedObjects), events.pointer.body)
				}
			} else if (isMoving) {
				const now = Date.now()
				if (now - lastMovedObjectsAt >= Math.max(10, info.moving.length > 1 ? (info.moving.length * (isInterval ? 0.08 : 0.04)) : 10)) {
					lastMovedObjectsAt = now
					updateMovingObjects(events.pointer.body)
				}
			}
		} else if (type == "up" || type == "cancel") {
			if (!dragging || usesTouch) {
				if (isMoving) {
					updateMovingObjects(events.pointer.body, true)
					stopMovingObjects()
				} else if (type != "cancel") {
					if (!sb.selectedWhileDrag && isSelectT && !isMoving && coords.clientX == downX && coords.clientY == downY)
						selectSingle(e)
				}
			}
			downObject = downX = downY = null
		}
	}

	return { handlePointerEvent, selectObject, deselectObject, clearSelection, isMoving, selectedObjects, onSelectionChange, get downObject() { return downObject }, selectBoxPrimary, selectBoxCrop, movingUndoRedo, movingConfiguringMultipleUndoRedo }

	function sortObjectsByZIndex(objects: MapObject[]) {
		return objects.sort((a, b) => {
			const zIndexA = bpRenderer.zIndexMap.get(a.item), zIndexB = bpRenderer.zIndexMap.get(b.item)
			if (a.item.isBlock || zIndexA == null) return -1
			if (b.item.isBlock || zIndexB == null) return 1
			return zIndexA - zIndexB
		})
	}
}

function getObjectsBBox(objects: MapObject[]) {
	let minX = Infinity, minY = Infinity,
		maxX = -Infinity, maxY = -Infinity
	for (const { body: { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } } of objects) {
		minX = Math.min(minX, bMinX)
		maxX = Math.max(maxX, bMaxX)
		minY = Math.min(minY, bMinY)
		maxY = Math.max(maxY, bMaxY)
	}
	return [minX, minY, maxX, maxY]
}
