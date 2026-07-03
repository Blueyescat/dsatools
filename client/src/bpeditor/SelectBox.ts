import { Box } from "detect-collisions"
import { Item } from "dsabp-js"
import { BitmapText, ColorSource, Graphics, PointData, StrokeInput } from "pixi.js"
import { filterInvertBack } from "./assets/InvertBackFilter.js"
import { EditorMap } from "./EditorMap.js"
import { app, editorMap } from "./main.js"
import { InteractionType } from "./managers/pointer.js"
import { MapObject } from "./MapObject.js"
import { isKeyDown, updateCursor } from "./util.js"
import { pointerEvent, usesTouch } from "/main.js"

interface SelectBoxOptions {
	editorMap: EditorMap
	lineWidth: number
	color?: ColorSource
	sticky?: boolean
	enableSnapping?: boolean | { objects?: Set<MapObject>, outer?: boolean }
	limitToWithinShip?: boolean
	enableSizeIndicator?: boolean
	disablePointerControl?: boolean
	preventStartingOnObjects?: boolean
	onSelectionStarted?: (e: pointerEvent) => void
	onSelectionUpdated?: (e: MouseEvent | TouchEvent, pointerCoords: { clientX: number, clientY: number }, onlyVisual: boolean) => void | { newRect?: { minX: number, minY: number, maxX: number, maxY: number } }
	onSelectionStartedByTouch?: () => void
	onSelectionEnding?: (esc: boolean) => void
	onSelectionEnded?: (esc: boolean) => void
}

interface BoxEdges { any: boolean, top: boolean, right: boolean, bottom: boolean, left: boolean, middle: boolean }

const BOX_HOVER_DIST_TH = usesTouch ? 19 : 13

export class SelectBox implements Required<SelectBoxOptions> {
	static selectBoxes: SelectBox[] = []

	enabled: boolean
	editorMap: EditorMap
	sizeIndicatorBmpTxts: BitmapText[]

	graph: Graphics
	body: Box
	hoverState: BoxEdges
	holdState: BoxEdges
	/** distance of pointer to each edge, only if inside sticky box */
	pointerDist: { top: number; right: number; bottom: number; left: number }

	lineWidth: number
	color: ColorSource
	sticky: boolean
	enableSizeIndicator: boolean
	enableSnapping: boolean | { objects?: Set<MapObject>, outer?: boolean }
	limitToWithinShip: boolean
	disablePointerControl: boolean
	preventStartingOnObjects: boolean

	/** whether the box is active, from mouse down to up unless sticky */
	isActive: boolean
	/** whether the sticky box is active, after mouse up */
	isStickyActive: boolean
	/** world point */
	startPoint: PointData
	/** world point */
	lastMinPoint: PointData
	/** world point */
	lastMaxPoint: PointData
	/** world point */
	bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
	touchStartedSelecting: boolean
	selectedWhileDrag: boolean
	lastPointerPoint: { clientX: number; clientY: number }
	declare startOnMove: boolean

	onSelectionStarted: (e: pointerEvent) => void
	onSelectionUpdated: (e: MouseEvent | TouchEvent, pointerCoords: { clientX: number; clientY: number }, onlyVisual: boolean) => void | { newRect?: { minX: number; minY: number; maxX: number; maxY: number } }
	onSelectionStartedByTouch: () => void
	onSelectionEnding: (esc: boolean) => void
	onSelectionEnded: (esc: boolean) => void

	constructor({ editorMap, onSelectionStarted, onSelectionUpdated, onSelectionStartedByTouch, onSelectionEnding, onSelectionEnded,
		lineWidth, color, sticky, enableSnapping, limitToWithinShip, enableSizeIndicator, disablePointerControl, preventStartingOnObjects
	}: SelectBoxOptions) {
		SelectBox.selectBoxes.push(this)

		const { collisions, viewport } = editorMap
		this.editorMap = editorMap

		this.graph = new Graphics({ zIndex: 30 })
		this.body = collisions.createBox({ x: 0, y: 0 }, 0, 0)
		this.hoverState = {} as any
		this.holdState = {} as any
		this.pointerDist = { top: 0, right: 0, bottom: 0, left: 0 }
		this.sizeIndicatorBmpTxts = Array.from({ length: 4 }, () => new BitmapText({ // creates only one bitmap font
			style: {
				fontWeight: "bold",
				fill: 0x00FFFF,
				fontSize: 17,
				stroke: { color: 0, width: 2.5 },
				align: "center"
			},
			anchor: 0.5,
			visible: false,
			zIndex: 30
		}))

		this.isActive = this.isStickyActive = false

		this.lineWidth = lineWidth
		this.color = color
		this.sticky = sticky
		this.enableSizeIndicator = enableSizeIndicator
		this.enableSnapping = enableSnapping
		this.limitToWithinShip = limitToWithinShip
		this.disablePointerControl = disablePointerControl
		this.preventStartingOnObjects = preventStartingOnObjects

		this.onSelectionStarted = onSelectionStarted
		this.onSelectionUpdated = onSelectionUpdated
		this.onSelectionStartedByTouch = onSelectionStartedByTouch
		this.onSelectionEnding = onSelectionEnding
		this.onSelectionEnded = onSelectionEnded

		//

		if (color == undefined)
			this.graph.filters = filterInvertBack
		viewport.addChild(this.graph, ...this.sizeIndicatorBmpTxts)

		const origOnUpdate: () => void = viewport.scale["_observer"]._onUpdate
		viewport.scale["_observer"]._onUpdate = scale => {
			origOnUpdate.call(viewport.scale["_observer"], scale)
			if (usesTouch && this.holdState.any)
				for (const key in this.holdState)
					this.holdState[key] = false
			if ((this.isActive && this.touchStartedSelecting != false) || this.isStickyActive)
				this.updateSelection(null, null, true)
		}
	}

	toggle(enabled: boolean) {
		if (!enabled)
			this.endSelection(true)
		this.enabled = enabled
	}

	startSelection(e: pointerEvent) {
		this.editorMap.collisions.insert(this.body)
		this.startPoint = this.editorMap.vwToWorld((e as TouchEvent).touches?.[0] ?? e as MouseEvent)
		this.isActive = true

		this.isStickyActive = false
		this.graph.visible = true

		this.touchStartedSelecting = !usesTouch // ?
		this.onSelectionStarted?.(e)
	}

	drawSizeIndicator() {
		const { viewport, squareSize } = this.editorMap,
			{ minX, minY, maxX, maxY } = this.bbox,
			width = maxX - minX,
			height = maxY - minY,
			scale = 1 / viewport.scaled,
			w = Math.max(0, width),
			h = Math.max(0, height),
			T = this.sizeIndicatorBmpTxts[0],
			R = this.sizeIndicatorBmpTxts[1],
			B = this.sizeIndicatorBmpTxts[2],
			L = this.sizeIndicatorBmpTxts[3]

		if (width >= 1 && scale < (width / squareSize) * 3) {
			B.x = T.x = minX + width / 2
			B.y = (T.y = minY) + h
			B.text = T.text = w / squareSize
			B.visible = T.visible = true
			B.scale = T.scale = scale
		} else
			B.visible = T.visible = false

		if (height >= 1 && scale < (height / squareSize) * 3) {
			L.x = (R.x = minX) + w
			L.y = R.y = minY + height / 2
			L.text = R.text = h / squareSize
			L.visible = R.visible = true
			L.scale = R.scale = scale
		} else
			L.visible = R.visible = false
	}

	updateSelection(e?: MouseEvent | TouchEvent, pointerCoords?: { clientX: number, clientY: number }, onlyVisual = false) {
		if ((!this.isActive && !this.isStickyActive && !this.holdState.any) || !this.startPoint)
			return

		const { viewport, app, placement, bp, squareSize } = this.editorMap,
			ctrlMeta = isKeyDown("ctrl|meta"),
			canvasRect = app.canvas.getBoundingClientRect(),
			bbox = this.bbox

		pointerCoords ??= e ? (e as TouchEvent).changedTouches?.[0] ?? e as MouseEvent : this.lastPointerPoint

		if (e) this.lastMinPoint = this.startPoint
		else if (this.lastMinPoint) this.startPoint = this.lastMinPoint

		let currentPoint = this.isStickyActive && !this.holdState.any ? this.lastMaxPoint
			: this.editorMap.vwToWorld({
				clientX: Math.max(canvasRect.left, Math.min(pointerCoords?.clientX, canvasRect.right)),
				clientY: Math.max(canvasRect.top, Math.min(pointerCoords?.clientY, canvasRect.bottom))
			}, canvasRect)

		if (this.holdState.any || !this.isActive) {
			if (this.holdState.middle && !ctrlMeta) {
				bbox.minY = currentPoint.y - this.pointerDist.top
				bbox.maxY = currentPoint.y + this.pointerDist.bottom
				bbox.minX = currentPoint.x - this.pointerDist.left
				bbox.maxX = currentPoint.x + this.pointerDist.right
			} else {
				if (this.holdState.top)
					bbox.minY = Math.min(bbox.maxY - 10, currentPoint.y)
				else if (this.holdState.bottom)
					bbox.maxY = Math.max(bbox.minY + 10, currentPoint.y)
				if (this.holdState.right)
					bbox.maxX = Math.max(bbox.minX + 10, currentPoint.x)
				else if (this.holdState.left)
					bbox.minX = Math.min(bbox.maxX - 10, currentPoint.x)
			}
			if (!onlyVisual)
				this.startPoint = { x: bbox.minX, y: bbox.minY }
			currentPoint = { x: bbox.maxX, y: bbox.maxY }
		} else {
			bbox.minX = Math.min(this.startPoint.x, currentPoint.x)
			bbox.minY = Math.min(this.startPoint.y, currentPoint.y)
			bbox.maxX = Math.max(this.startPoint.x, currentPoint.x)
			bbox.maxY = Math.max(this.startPoint.y, currentPoint.y)

			if (this.enableSnapping) {
				const snapOpts = typeof this.enableSnapping != "boolean" && this.enableSnapping

				let [minX, minY] = Object.values(placement.calc({ x: bbox.minX, y: bbox.minY }, true, true, { x: 0.5, y: 0.5 }, snapOpts?.outer ? null : { x: -1, y: -1 })),
					[maxX, maxY] = Object.values(placement.calc({ x: bbox.maxX, y: bbox.maxY }, true, true, { x: 0.5, y: 0.5 }, snapOpts?.outer ? null : { x: 1, y: 1 }, true))

				if (snapOpts?.objects?.size) {
					let minObjX = Infinity, minObjY = Infinity,
						maxObjX = -Infinity, maxObjY = -Infinity,
						minXobj: MapObject, minYobj: MapObject,
						maxXobj: MapObject, maxYobj: MapObject

					for (const obj of snapOpts.objects) {
						const { minX, minY, maxX, maxY } = obj.body
						if (minX < minObjX) { minObjX = minX; minXobj = obj }
						if (minY < minObjY) { minObjY = minY; minYobj = obj }
						if (maxX > maxObjX) { maxObjX = maxX; maxXobj = obj }
						if (maxY > maxObjY) { maxObjY = maxY; maxYobj = obj }
					}

					minObjX += getAllowedOverlap(minXobj)
					minObjY += getAllowedOverlap(minYobj)
					maxObjX -= getAllowedOverlap(maxXobj)
					maxObjY -= getAllowedOverlap(maxYobj)

					if (minObjX < minX || minObjY < minY)
						[minX, minY] = Object.values(placement.calc({ x: Math.min(minObjX, minX), y: Math.min(minObjY, minY) }, true, true, { x: 0.5, y: 0.5 }))

					if (maxObjX > maxX || maxObjY > maxY)
						[maxX, maxY] = Object.values(placement.calc({ x: Math.max(maxObjX, maxX), y: Math.max(maxObjY, maxY) }, true, true, { x: 0.5, y: 0.5 }, null, true))
				}

				bbox.minX = minX
				bbox.minY = minY
				bbox.maxX = maxX
				bbox.maxY = maxY
			}

			if (this.limitToWithinShip) {
				const min = -squareSize / 2,
					maxX = (bp.width - 0.5) * squareSize,
					maxY = (bp.height - 0.5) * squareSize

				bbox.minX = Math.max(bbox.minX, min)
				bbox.minY = Math.max(bbox.minY, min)
				bbox.maxX = Math.min(bbox.maxX, maxX)
				bbox.maxY = Math.min(bbox.maxY, maxY)

				if (this.enableSnapping) {
					if (bbox.maxX - bbox.minX < squareSize) { // if current width is smaller than a square
						bbox.maxX = Math.min(bbox.minX + squareSize, maxX) // make maxX a square greater than minX, but less than ship width
						bbox.minX = bbox.maxX - squareSize
					}

					if (bbox.maxY - bbox.minY < squareSize) {
						bbox.maxY = Math.min(bbox.minY + squareSize, maxY)
						bbox.minY = bbox.maxY - squareSize
					}
				}
			}
		}
		this.lastMaxPoint = currentPoint

		const width = bbox.maxX - bbox.minX, height = bbox.maxY - bbox.minY

		const strokeOpts: StrokeInput = { width: this.lineWidth / viewport.scaled }
		if (this.color) strokeOpts.color = this.color
		this.graph.clear().rect(bbox.minX, bbox.minY, width, height).stroke(strokeOpts)

		if (this.enableSizeIndicator && !e && (this.isActive || this.isStickyActive))
			this.drawSizeIndicator()

		if (onlyVisual) return this.onSelectionUpdated?.(e, pointerCoords, onlyVisual)

		if (this.touchStartedSelecting == false && width * height > 0) {
			this.touchStartedSelecting = true
			this.onSelectionStartedByTouch?.()
		}

		this.body.setPosition(bbox.minX, bbox.minY, false)
		this.body.width = bbox.maxX - bbox.minX
		this.body.height = bbox.maxY - bbox.minY
		this.body.updateBody()

		if (this.enableSizeIndicator)
			this.drawSizeIndicator()

		if (this.onSelectionUpdated) {
			const res = this.onSelectionUpdated(e, pointerCoords, onlyVisual)
			if (res && res.newRect) {
				const { minX, minY, maxX, maxY } = res.newRect
				Object.assign(this, { minX, minY, maxX, maxY })
			}
		}
	}

	endSelection(esc?: boolean) {
		if (!this.isActive && !this.isStickyActive)
			return

		this.onSelectionEnding?.(esc)
		this.selectedWhileDrag = false
		if (!esc && this.sticky && this.graph.width) {
			this.isStickyActive = true
			this.isActive = false
			return
		}

		this.isActive = false
		this.editorMap.collisions.remove(this.body)
		this.graph.clear().visible = false
		this.bbox.minX = this.bbox.minY = this.bbox.maxX = this.bbox.maxY = 0

		for (const key in this.hoverState)
			this.hoverState[key] = this.holdState[key] = false

		updateCursor(this.editorMap)
		if (this.enableSizeIndicator)
			this.sizeIndicatorBmpTxts.forEach(t => t.visible = false)
		if (esc) {
			this.body.width = this.body.height = 0
			this.isStickyActive = false
		}
		this.onSelectionEnded?.(esc)
	}

	static handlePointerEvent(e: pointerEvent, type: InteractionType, isInterval: boolean, targetEl: HTMLElement, lastMoveTouch: Touch) {
		const coords = isInterval && e.type == "touchstart" && lastMoveTouch ? lastMoveTouch : pointerEvent.getValues(e),
			ctrlMeta = isKeyDown("ctrl|meta"),
			{ info, events, selection } = editorMap

		for (const sb of this.selectBoxes) {
			if (sb.disablePointerControl || !sb.enabled) continue

			const dragging = info.dragging

			if (type == "move" && (!usesTouch || !dragging))
				sb.lastPointerPoint = { clientX: coords.clientX, clientY: coords.clientY }
			if (type == "down" && sb.isActive && dragging && !usesTouch)
				sb.selectedWhileDrag = true

			if (!dragging && type == "down" && targetEl == app.canvas
				&& (!isInterval || (usesTouch && !sb.isActive))
				&& (
					ctrlMeta
					|| !(sb.isStickyActive && !sb.hoverState.any)
					|| (!sb.hoverState.any && (!usesTouch || isInterval))
				)
			) {
				if (sb.hoverState.any && !ctrlMeta)
					for (const key in sb.hoverState)
						sb.holdState[key] = sb.hoverState[key]
				else {
					if (!selection.isMoving && !sb.selectedWhileDrag) {
						if (sb.sticky && sb.isStickyActive && !ctrlMeta) {
							sb.startOnMove = true
						} else if ((!sb.preventStartingOnObjects || !selection.downObject) || e.shiftKey || ctrlMeta) {
							sb.startSelection(e)
						}
					}
				}
			} else if ((!usesTouch || !dragging) && ((type == "move" || (usesTouch && type == "down")) || isInterval)) {
				if ((!isInterval || usesTouch) && sb.isStickyActive && sb.body.width) {
					const point = events.pointer.body, bbox = sb.body.bbox,
						TH = BOX_HOVER_DIST_TH / sb.editorMap.viewport.scaled, N_TH = -TH,
						L = point.x - bbox.minX,
						R = bbox.maxX - point.x,
						T = point.y - bbox.minY,
						B = bbox.maxY - point.y

					let noEdge: boolean, any = true
					if (T < N_TH || R < N_TH || B < N_TH || L < N_TH) { // any of the points is too far
						noEdge = true
						sb.hoverState.middle = false
						any = false
					} else if (T > TH && R > TH && B > TH && L > TH) {
						noEdge = true
						sb.hoverState.middle = true
					} else {
						sb.hoverState.top = Math.abs(T) <= TH
						sb.hoverState.right = Math.abs(R) <= TH
						sb.hoverState.bottom = Math.abs(B) <= TH
						sb.hoverState.left = Math.abs(L) <= TH
						sb.hoverState.middle = false
					}
					if (noEdge)
						sb.hoverState.top = sb.hoverState.right = sb.hoverState.bottom = sb.hoverState.left = false
					sb.hoverState.any = any

					if (sb.hoverState.middle && !sb.holdState.middle) {
						sb.pointerDist.top = T
						sb.pointerDist.right = R
						sb.pointerDist.bottom = B
						sb.pointerDist.left = L
					}

					updateCursor(editorMap)
					if (sb.startOnMove) {
						delete sb.startOnMove
						sb.startSelection(e)
					} else if (sb.holdState.any)
						sb.updateSelection(e, coords)
				} else if (!sb.isStickyActive) {
					if (type == "move") {
						sb.updateSelection(e, coords)
					}
				}
			} else if (type == "up" || type == "cancel") {
				delete sb.startOnMove
				if (usesTouch)
					for (const key in sb.hoverState)
						sb.hoverState[key] = false
				if (sb.holdState.any)
					for (const key in sb.holdState)
						sb.holdState[key] = false
				else if (!dragging || usesTouch) {
					if (!selection.isMoving && type != "cancel") {
						sb.endSelection()
					}
				}
			}
		}
	}
}

window.addEventListener("keydown", e => {
	for (const sb of SelectBox.selectBoxes) {
		if (!(sb.disablePointerControl || !sb.enabled)
			&& (sb.isActive || sb.isStickyActive) && e.key == "Escape" && document.activeElement == document.body
		)
			sb.endSelection(true)
	}
})

// Same logic with checkPlacement
function getAllowedOverlap(o: MapObject) {
	if (!o) return 0
	if (o.item == Item.EXPANDO_BOX)
		return 0.7003376
	else if (o.item != Item.RCD_FLUX && o.item != Item.RCD_SANDBOX)
		return 2
	return 0
}
