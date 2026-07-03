import { Polygon } from "detect-collisions"
import { Item } from "dsabp-js"
import { Graphics } from "pixi.js"
import { updateObject } from "../actions/updateObject.js"
import { editorMap } from "../ui/uiMain.js"
import { MapObject } from "/bpeditor/MapObject.js"
import { moveObject } from "/bpeditor/actions/moveObject.js"
import { checkPlacement } from "/bpeditor/checkPlacement.js"
import { resizeVertices } from "/bpeditor/util.js"

export function initBoxExpander() {
	type Result = { width: number, height: number, capacity: number }

	const { viewport, squareSize } = editorMap,
		activeObjects = new Map<MapObject, { g: Graphics, updateHandler: () => void, destroyHandler: () => void, result: Result }>(),
		expansionFactor = 6.31,
		halfFactor = expansionFactor / 2,
		maxDimension = squareSize * 240,
		stacksPerSquare = 3.125

	async function expand(o: MapObject) {
		if (o.item != Item.EXPANDO_BOX || !o.isValid || activeObjects.has(o))
			return

		const g = new Graphics({ zIndex: o.display.zIndex - 1, alpha: 0.4 }),
			body = o.body as Polygon,
			sprite = o.display.children[0],
			result = {} as Result

		viewport.addChild(g)

		let lastTestDir: "U" | "R" | "D" | "L",
			updateHandler: () => void,
			destroyHandler: () => void

		o.on("transform", updateHandler = () => {
			if (g.destroyed) return

			g.rotation = sprite?.rotation ?? 0

			g.position.set(
				(o.body ?? o.display).x,
				(o.body ?? o.display).y
			)

			g.clear().poly(body.points).fill("blue")
		})

		o.once("destroy", destroyHandler = () =>
			shrink(o, true)
		)

		let prevPoints = body.points,
			prevPos = body.pos.clone(),
			prevW = o.width,
			prevH = o.height

		activeObjects.set(o, { g, updateHandler, destroyHandler, result })

		const fails = {} as Record<typeof lastTestDir, boolean>
		for (let i = 0; i < 10000; i++) {
			if (g.destroyed)
				break

			let vertsToGetCenter: SAT.Vector[]
			if (lastTestDir == "U") {
				vertsToGetCenter = resizeVertices(prevPoints, 0, expansionFactor, 0, 0)
				o.overridePoly = resizeVertices(prevPoints, 0, halfFactor, 0, halfFactor)
				o.width += expansionFactor
				lastTestDir = "R"
			} else if (lastTestDir == "R") {
				vertsToGetCenter = resizeVertices(prevPoints, 0, 0, expansionFactor, 0)
				o.overridePoly = resizeVertices(prevPoints, halfFactor, 0, halfFactor, 0)
				o.height += expansionFactor
				lastTestDir = "D"
			} else if (lastTestDir == "D") {
				vertsToGetCenter = resizeVertices(prevPoints, 0, 0, 0, expansionFactor)
				o.overridePoly = resizeVertices(prevPoints, 0, halfFactor, 0, halfFactor)
				o.width += expansionFactor
				lastTestDir = "L"
			} else { // ?L
				vertsToGetCenter = resizeVertices(prevPoints, expansionFactor, 0, 0, 0)
				o.overridePoly = resizeVertices(prevPoints, halfFactor, 0, halfFactor, 0)
				o.height += expansionFactor
				lastTestDir = "U"
			}

			body.pos.add(body.setPoints(vertsToGetCenter).getCentroid())

			body.setPoints(o.overridePoly).updateBody(true)

			const check = checkPlacement(editorMap, o.item, body, o.x, o.y, o.buildInfoIndex)

			if (!check.can || prevH / prevW >= 2 || prevW / prevH >= 2 || o.width >= maxDimension || o.height >= maxDimension) {
				body.setPoints(o.overridePoly = prevPoints).setPosition(prevPos.x, prevPos.y, true)
				o.height = prevH
				o.width = prevW
				fails[lastTestDir] = true
			} else {
				fails[lastTestDir] = false
			}

			if (check.can || fails[lastTestDir])
				moveObject(o, null, body.pos)
			updateHandler()

			if (fails.U && fails.R && fails.D && fails.L)
				break

			prevPoints = body.points
			prevPos = body.pos.clone()
			prevW = o.width
			prevH = o.height

			if (i % 8 == 0)
				await new Promise(r => setTimeout(r))
		}

		o.emit("transform")
		editorMap.updateBpStr()
		result.width = o.width
		result.height = o.height
		result.capacity = Math.floor(stacksPerSquare * (o.width / squareSize) * (o.height / squareSize))
	}

	function isActive(o: MapObject) {
		return activeObjects.has(o)
	}

	async function shrink(o: MapObject, objDestroyed?: boolean) {
		const data = activeObjects.get(o)
		if (!data) return
		const { g, updateHandler, destroyHandler } = data

		g.destroy()
		delete o.overridePoly
		if (!objDestroyed) {
			o.off("transform", updateHandler)
			o.off("destroy", destroyHandler)
			await updateObject(o)
			o.emit("transform")
		}

		activeObjects.delete(o)
	}

	function getResult(o: MapObject) {
		return activeObjects.get(o)?.result
	}

	return { expand, isActive, shrink, getResult }
}
