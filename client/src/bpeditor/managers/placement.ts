import { Body, Box, deg2rad, ensurePolygonPoints } from "detect-collisions"
import { FixedAngle, Item, Shape } from "dsabp-js"
import { findBuildInfoIndex, getDrawItemData } from "dsabp-js-img"
import { Assets, ColorMatrixFilter, Container, PointData, Rectangle, Sprite, Texture } from "pixi.js"
import { checkPlacement } from "../checkPlacement.js"
import { EditorMap } from "../EditorMap.js"
import { lastMultiTouchTime, usesTouch } from "../main.js"
import { getHullD8Rotation, scaleVertices } from "../util.js"
import { pointerEvent } from "/main.js"

/* const debugCanvas = new OffscreenCanvas(1000, 1000)
const debugCtx = debugCanvas.getContext("2d") as unknown as CanvasRenderingContext2D
const debugCanvasSrc = new CanvasSource({ resource: debugCanvas })
const debugSprite = new Sprite({ zIndex: 1000, anchor: 0 }) */

const dispObj = new Container({
	zIndex: 4,
	eventMode: "none",
	tint: 0x00FF00,
	alpha: 0.4,
	visible: false
})
const filter = new ColorMatrixFilter()
filter.contrast(1.02, true)
dispObj.filters = filter

export function initPlacement(editorMap: EditorMap) {
	const { collisions, viewport, bpRenderer, info, squareSize, app } = editorMap
	viewport.addChild(dispObj)
	// display.addChild(debugSprite)

	let hullDirection: FixedAngle,
		drawItemData: Awaited<ReturnType<typeof getDrawItemData>>,
		previewBody: Body,
		rotateVertical: boolean // is this a good idea

	const bodies = {
		box: collisions.createBox({}, 0, 0, { isCentered: true }),
		polygon: collisions.createPolygon({}, [{}], { isCentered: true })
	}

	let currentUpdateId = 0
	async function update() {
		const thisUpdateId = ++currentUpdateId

		if (info.selectedTool != "place" || !info.selectedItem)
			return dispObj.visible = false

		const item = info.selectedItem,
			isItemNotSupported = !item.buildInfo || item == Item.PAINT, // TODO
			shape = editorMap.configs.clipboardShape,
			config = editorMap.configs.getClipboardCfg(item)

		dispObj.children.forEach(s => s.visible = false)

		if (!isItemNotSupported) {
			rotateVertical = item.buildInfo[0].build_angle == "Fixed" && (config.fixedAngle == FixedAngle.UP || config.fixedAngle == FixedAngle.DOWN)
			drawItemData = await getDrawItemData(bpRenderer, item, 0, 0, shape, config, hullDirection)
			if (thisUpdateId != currentUpdateId) return
			for (
				const [i, { image, drawPosOff, size, baseSize, sx, sy, sw, sh, angle, layer }]
				of drawItemData.entries()
			) {
				if (thisUpdateId != currentUpdateId) return

				let sprite = dispObj.children[i] as Sprite
				if (!sprite)
					dispObj.addChild(sprite = new Sprite({ anchor: 0.5 }))
				sprite.texture = await Assets.load(image)
				sprite.visible = true

				const needFrame = sx != null || sy != null || sw != null || sh != null
				if (needFrame || hullDirection)
					sprite.texture = new Texture({
						source: sprite.texture.source,
						frame: needFrame ? new Rectangle(sx ?? 0, sy ?? 0, sw ?? image.width, sh ?? image.height) : null,
						rotate: getHullD8Rotation(hullDirection)
					})

				sprite.angle = angle ?? 0

				sprite.setSize(size.w, size.h)

				sprite.x = drawPosOff.x + size.w / 2
				sprite.y = drawPosOff.y + size.h / 2

				sprite.zIndex = dispObj.zIndex + (layer == "top" ? 1 : 0)

				if (i == 0) {
					const isShapedBlock = item.buildInfo?.[0].block_shaped && shape != null && shape != Shape.BLOCK
					if (item.buildInfo?.[0].shape?.verts || isShapedBlock) {
						previewBody = bodies.polygon
						previewBody.setPoints(ensurePolygonPoints(scaleVertices(item, 0, isShapedBlock ? shape : null, squareSize)))
					} else {
						previewBody = bodies.box; // TS thinks previewBody may also be Polygon
						(previewBody as Box).width = baseSize.w;
						(previewBody as Box).height = baseSize.h
						if (previewBody.isCentered) // ADDED DUE TO DC BUG
							previewBody.setPoints(ensurePolygonPoints([{ x: -baseSize.w / 2, y: -baseSize.h / 2 }, { x: baseSize.w / 2, y: -baseSize.h / 2 }, { x: baseSize.w / 2, y: baseSize.h / 2 }, { x: -baseSize.w / 2, y: baseSize.h / 2 }]))
					}
					if (item != Item.ITEM_LAUNCHER)
						previewBody.setAngle(angle != null ? deg2rad(angle) : 0, false)
					previewBody.updateBody(true)
				}
			}
		} else {
			drawItemData = null
			previewBody = bodies.box;
			(previewBody as Box).width = (previewBody as Box).height = 0
		}
	}

	const moveHandler = (e: pointerEvent) => {
		if (!previewBody)
			return
		const touches = (e as TouchEvent).touches
		// hide if multi touch or in 500ms after a multi touch
		if (touches?.length > 1 || (touches?.length && Date.now() - lastMultiTouchTime < 500))
			return dispObj.visible = false
		check(editorMap.vwToWorld(touches?.[0] ?? e as MouseEvent))
	}

	// Note: pixi events give a different position that is bad for precision
	if (usesTouch)
		app.canvas.addEventListener("touchstart", moveHandler)
	app.canvas.addEventListener(pointerEvent.move, moveHandler)

	// rounding, similar to game - this doesn't make everything perfect but pretty close
	const roundFactor = 1

	function calc(wPoint: PointData, snap_x: boolean, snap_y: boolean, offset?: PointData, offset2?: PointData, ceil?: boolean) {
		if (!snap_x)
			wPoint.x = Math.round(wPoint.x * roundFactor) / roundFactor
		if (!snap_y)
			wPoint.y = Math.round(wPoint.y * roundFactor) / roundFactor

		wPoint.x -= squareSize / 2
		wPoint.y -= squareSize / 2

		if (offset2) {
			wPoint.x -= (rotateVertical ? -offset2.y : offset2.x) * squareSize
			wPoint.y -= (rotateVertical ? -offset2.x : offset2.y) * squareSize
		}

		// round as positive to avoid bad negative rounding behavior
		const betterRound = (n: number) => {
			n = Math.abs(n % 1) <= roundFactor ? Math.trunc(n) : n // precision issues but should be ok TODO
			return (ceil ? Math.ceil : Math.floor)(n / squareSize) * squareSize
			// return Math.sign(n) * (ceil ? Math.ceil : Math.floor)(Math.abs(n) / squareSize) * squareSize
		}

		wPoint.x = snap_x ? betterRound(wPoint.x) : wPoint.x - squareSize / 2
		wPoint.y = snap_y ? betterRound(wPoint.y) : wPoint.y - squareSize / 2

		wPoint.x += squareSize
		wPoint.y += squareSize

		if (offset) {
			wPoint.x -= (rotateVertical ? -offset.y : offset.x) * squareSize
			wPoint.y -= (rotateVertical ? -offset.x : offset.y) * squareSize
		}

		if ((info.selectedItem)?.buildInfo?.[0].allow_world) { // TODO
			const bpPoint = editorMap.toBpPoint(wPoint)
			const direction = editorMap.getHullDirection(bpPoint.x, bpPoint.y)
			if ((info.selectedItem?.buildInfo.length > 2 || direction) && hullDirection != direction) {
				hullDirection = direction
				update()
			}
		} else if (hullDirection) {
			hullDirection = null
			update()
		}

		return wPoint
	}

	/** Should be run after {@link update} */
	function check(point: PointData) {
		if (!previewBody) return // ran before update, ignore

		const selectedItem = info.selectedItem
		if (info.selectedTool != "place" || !selectedItem?.isBuildable || !drawItemData || editorMap.info.dragging)
			return info.placementCheckResult.can = false
		dispObj.visible = true

		const buildInfoIndex = findBuildInfoIndex(selectedItem, hullDirection)

		const { snap_x, snap_y, offset, offset2 } = selectedItem.buildInfo[buildInfoIndex]

		point = calc(point, snap_x, snap_y, offset, offset2)

		info.placementPos = editorMap.toBpPoint(point)
		previewBody.setPosition(point.x, point.y)

		dispObj.position.copyFrom({
			x: point.x - squareSize / 2,
			y: point.y - squareSize / 2
		})

		info.placementCheckResult = checkPlacement(editorMap, selectedItem, previewBody, info.placementPos.x, info.placementPos.y, buildInfoIndex)

		dispObj.tint = info.placementCheckResult.can ? 0x00FF00 : 0xFF0000
	}

	/* void (async () => {
		while (true) { // eslint-disable-line
			await new Promise(r => setTimeout(r))
			debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height)
			debugCtx.strokeStyle = "#00FF00"
			debugCtx.lineWidth = 1
			debugCtx.beginPath()
			collisions.draw(debugCtx)
			debugCtx.stroke()

			// debugCtx.lineWidth = 1
			// debugCtx.strokeStyle = "#0000FF"
			// debugCtx.beginPath()
			// collisions.drawBVH(debugCtx)
			// debugCtx.stroke()

			debugCanvasSrc.update()
			debugSprite.texture = Texture.from(debugCanvasSrc)
		}
	})() */

	return { check, calc, dispObj, update }
}
