import { Polygon } from "detect-collisions"
import { Graphics, PointData } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject, MapObjectData } from "../MapObject.js"
import { createObject } from "../actions/createObject.js"
import { deleteObject } from "../actions/deleteObject.js"
import { moveObject } from "../actions/moveObject.js"
import { checkPlacement } from "../checkPlacement.js"
import { isKeyDown, objToData } from "../util.js"

const DEBUG = false

/** Only snapped axes use Bresenham's algo. */
class LineIterator {
	stepSize: number
	coarseStepSize: number
	snap_x: boolean
	snap_y: boolean
	// start-end
	x1: number
	y1: number
	x2: number
	y2: number
	// start-end distance
	distance: number
	// current pos
	x: number
	y: number

	// bresenham - start-end differences
	dx: number
	dy: number
	// start-end directions, 1 right -1 left
	sx: number
	sy: number // 1 up -1 down
	// err
	err: number

	// cached steps for non-snapped movement
	private stepX: number
	private stepY: number

	constructor(x1: number, y1: number, x2: number, y2: number, {
		initialStep = 0.01,
		coarseStep = 1,
		snap_x = false,
		snap_y = false
	} = {}) {
		this.x = this.x1 = x1
		this.y = this.y1 = y1
		this.x2 = x2
		this.y2 = y2

		this.stepSize = initialStep
		this.coarseStepSize = coarseStep
		this.snap_x = snap_x && snap_y
		this.snap_y = this.snap_x // TODO

		this.dx = Math.abs(this.x2 - this.x1)
		this.dy = Math.abs(this.y2 - this.y1)

		this.sx = this.x1 < this.x2 ? 1 : -1
		this.sy = this.y1 < this.y2 ? 1 : -1

		this.err = (this.dx - this.dy) / 2

		this.distance = Math.hypot(this.dx, this.dy)
	}

	next() {
		const { x, y, err } = this

		if (this.snap_x) {
			if (err > -this.dx) {
				this.err -= this.dy
				this.x += this.sx
			}
		} else {
			this.x += this.stepX ??= (this.x2 - this.x1) * (this.stepSize / this.distance)
		}

		if (this.snap_y) {
			if (err < this.dy) {
				this.err += this.dx
				this.y += this.sy
			}
		} else {
			this.y += this.stepY ??= (this.y2 - this.y1) * (this.stepSize / this.distance)
		}

		return {
			pos: { x, y },
			done:
				(this.sx == 1 && this.x > this.x2) // R
				|| (this.sx == -1 && this.x < this.x2) // L
				|| (this.sy == 1 && this.y > this.y2) // U
				|| (this.sy == -1 && this.y < this.y2) // D
		}
	}

	success() {
		if (!this.snap_x)
			this.x += (this.x2 - this.x1) * (this.coarseStepSize / this.distance)

		if (!this.snap_y)
			this.y += (this.y2 - this.y1) * (this.coarseStepSize / this.distance)
	}
}


export function initShapePlacement(editorMap: EditorMap) {
	const { info, placement, configs, history, events } = editorMap

	let linePlacementStartPos: PointData,
		isUpdating: boolean

	const lineGraph = DEBUG ? new Graphics({ zIndex: 300 }) : null,
		dotGraph = DEBUG ? new Graphics({ zIndex: 301 }) : null
	DEBUG && editorMap.viewport.addChild(lineGraph, dotGraph)

	const linePlacementPreviewObjects: MapObject[] = []

	function startLine(bpPoint: PointData) {
		linePlacementStartPos = { x: bpPoint.x, y: bpPoint.y }
	}

	function endLine() {
		if (linePlacementPreviewObjects.length) {
			const undoRedoData: MapObjectData[] = linePlacementPreviewObjects.map(o => objToData(o))
			history.add({
				type: `lineObjects`,
				undo: () => {
					for (const data of undoRedoData)
						deleteObject(editorMap.getObjectByPos(data.x, data.y), false)
					events.pointer.check()
					editorMap.updateBpStr()
				},
				redo: async () => {
					for (const data of undoRedoData)
						await createObject(data, false, { bpStr: true })
					events.pointer.check()
					editorMap.updateBpStr()
				}
			})
			editorMap.events.pointer.check()
			editorMap.updateBpStr()
		}

		linePlacementStartPos = null
		linePlacementPreviewObjects.length = 0
		isUpdating = false
	}

	async function updateLine() {
		if (isUpdating)
			return

		const buildInfoIndex = info.placementCheckResult.buildInfoIndex,
			{ bounds, snap_x, snap_y, offset, offset2 } = info.selectedItem.buildInfo[buildInfoIndex],
			getSnappedBpPoint = (p: PointData) => editorMap.toBpPoint(placement.calc(editorMap.toWorldPoint(p), snap_x, snap_y, offset, offset2)),
			getPointOnLine = (from: PointData, dirX: number, dirY: number, dist: number) => ({
				x: from.x + dirX * dist,
				y: from.y + dirY * dist
			})

		const lineStartPos = getSnappedBpPoint(linePlacementStartPos),
			lineEndPos = getSnappedBpPoint(info.placementPos),
			lineDiffX = lineEndPos.x - lineStartPos.x,
			lineDiffY = lineEndPos.y - lineStartPos.y,
			lineDist = Math.hypot(lineDiffX, lineDiffY),
			lineDirX = lineDiffX / lineDist,
			lineDirY = lineDiffY / lineDist

		while (linePlacementPreviewObjects.length > 0)
			deleteObject(linePlacementPreviewObjects.pop(), false, { bpStr: true })
		isUpdating = true
		dotGraph?.clear()

		// place first object
		const firstObjData: MapObjectData = {
			editorMap,
			x: lineStartPos.x,
			y: lineStartPos.y,
			item: info.selectedItem,
			buildInfoIndex
		}

		const clipboardConfig = configs.getClipboardCfg(info.selectedItem),
			clipboardShape = info.selectedItem.isBlock && configs.clipboardShape
		if (clipboardConfig) firstObjData.config = clipboardConfig.clone()
		if (clipboardShape) firstObjData.shape = clipboardShape

		const firstObj = await createObject(firstObjData, false, { bpStr: true })

		linePlacementPreviewObjects.push(firstObj)

		// don't show second object until mouse is moved enough
		if (lineDist < 0.5) return isUpdating = false

		let minBoundary = Math.min(bounds.x, bounds.y) - (!snap_x || !snap_y ? 0.075 : 0)

		// place second object, and repeatedly move it to find minimum good distance
		let spacing = !snap_x || !snap_y ? 0.01 : 1

		const secondBpPos = getSnappedBpPoint(getPointOnLine(lineStartPos, lineDirX, lineDirY, spacing)),
			secondData = { ...firstObjData, x: secondBpPos.x, y: secondBpPos.y }
		if (secondData.config)
			secondData.config = secondData.config.clone()

		const secondObj = await createObject(secondData, false, { bpStr: true, connTxt: true })

		// adjust second object position until no collision					
		while (checkPlacement(editorMap, secondObj.item, secondObj.body, secondObj.x, secondObj.y, buildInfoIndex).can == false) {
			spacing += !snap_x || !snap_y ? 0.01 : 1 // increase spacing more significantly based on the diagonal adjustment TODO
			if (spacing > lineDist) {
				deleteObject(secondObj, false, { all: true })
				break
			}
			moveObject(secondObj, getSnappedBpPoint(getPointOnLine(lineStartPos, lineDirX, lineDirY, spacing)))
		}

		if (DEBUG) {
			const yyy = editorMap.toWorldPoint(getSnappedBpPoint(getPointOnLine(lineStartPos, lineDirX, lineDirY, spacing)))
			dotGraph?.circle(yyy.x, yyy.y, 4).stroke({ color: 0x00FF00, width: 4 })
		}

		if (secondObj.body.system) { // not destroyed
			secondObj.isValid = checkPlacement(editorMap, secondObj.item, secondObj.body, secondObj.x, secondObj.y, buildInfoIndex).can
			linePlacementPreviewObjects.push(secondObj)

			const altKey = isKeyDown("alt"),
				nonSquare = bounds.x != bounds.y,
				firstToSecondDist = (altKey || nonSquare) // only necessary if so
					&& Math.hypot(secondObj.x - firstObj.x, secondObj.y - firstObj.y),
				objDiagonalDist = nonSquare && Math.hypot(bounds.x, bounds.y)

			if (altKey) {
				const firstToSecondAngle = Math.atan2(secondObj.y - firstObj.y, secondObj.x - firstObj.x)
				lineEndPos.x = lineStartPos.x + Math.cos(firstToSecondAngle) * lineDist
				lineEndPos.y = lineStartPos.y + Math.sin(firstToSecondAngle) * lineDist
				if (firstToSecondDist - minBoundary < 0.1) // if second obj is adjacent
					minBoundary = firstToSecondDist - 0.01
			}

			if (DEBUG) {
				const swp = editorMap.toWorldPoint(lineStartPos)
				const ewp = editorMap.toWorldPoint(lineEndPos)
				lineGraph.clear().moveTo(swp.x, swp.y).lineTo(ewp.x, ewp.y).stroke({ color: "red", width: 8 })
			}

			const iterator = new LineIterator(lineStartPos.x, lineStartPos.y, lineEndPos.x, lineEndPos.y, {
				snap_x, snap_y,
				initialStep: 0.01,
				coarseStep: minBoundary
			})
			iterator.success() // prevent unnecessary fails 
			iterator.success() // with first 2 non-snapped objects

			const testBody = editorMap.collisions.createPolygon({}, [{}], { isCentered: true })
				.setAngle(firstObj.body.angle)
				.setPoints((firstObj.body as Polygon).points) as Polygon
			testBody.mapObject = firstObj

			let lastSucc: MapObject
			let i = 0
			while (true) {
				++i
				const { done, pos } = iterator.next(),
					bpPos = getSnappedBpPoint(pos)


				const objData = { ...firstObjData, x: bpPos.x, y: bpPos.y }
				if (objData.config)
					objData.config = objData.config.clone()

				const debugPos = DEBUG ? editorMap.toWorldPoint(bpPos) : null
				dotGraph?.circle(debugPos.x, debugPos.y, 6).stroke({ color: "yellow", width: 4 })

				if (bounds.x != bounds.y // solve corner-to-corner issues with non-square objects
					&& (lastSucc?.y == bpPos.y || lastSucc?.x == bpPos.x)
				) {
					const prev = linePlacementPreviewObjects[linePlacementPreviewObjects.length - 2],
						prevToCurrDist = Math.hypot(prev.x - bpPos.x, prev.y - bpPos.y)
					if (altKey) {
						if (prevToCurrDist == firstToSecondDist) // if moving prev to current point will provide corner-to-corner objects
							moveObject(lastSucc, bpPos, null, { all: true })
					} else {
						if (prevToCurrDist == objDiagonalDist)
							moveObject(lastSucc, bpPos, null, { all: true })
					}
					if (done) break
				}

				if (bounds.x == 1 && bounds.y == 1 && i == 2 && (secondObj.x != objData.x || secondObj.y != objData.y)) {
					const oldPos = secondObj.body.pos.clone(),
						newPos = editorMap.toWorldPoint(objData)
					secondObj.body.setPosition(newPos.x, newPos.y)
					if (checkPlacement(editorMap, secondObj.item, secondObj.body, objData.x, objData.y, buildInfoIndex).can) {
						moveObject(secondObj, objData)
						if (done) break
						continue
					} else {
						secondObj.body.setPosition(oldPos.x, oldPos.y)
					}
				}

				const testPos = editorMap.toWorldPoint(objData)
				testBody.setPosition(testPos.x, testPos.y, true)

				if (checkPlacement(editorMap, objData.item, testBody, objData.x, objData.y, buildInfoIndex).can) {
					firstObj.isDisabled = true
					const obj = lastSucc = await createObject(objData, false, { bpStr: true })
					firstObj.isDisabled = false
					linePlacementPreviewObjects.push(obj)
					dotGraph?.circle(debugPos.x, debugPos.y, 4).stroke({ color: 0x00FF00, width: 4 })
					iterator.success()
				} else {
					lastSucc = null
				}
				if (done) break
			}
			testBody.system.remove(testBody)
			editorMap.updateConnTexAround(secondObj, secondObj)
		}
		if (!checkPlacement(editorMap, firstObj.item, firstObj.body, firstObj.x, firstObj.y, firstObj.buildInfoIndex).can)
			deleteObject(firstObj, false, { bpStr: true })
		isUpdating = false
	}

	return { startLine, updateLine, endLine, get isActive() { return !!linePlacementStartPos } }
}
