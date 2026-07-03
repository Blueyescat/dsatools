import { Item } from "dsabp-js"
import { connectedTileTypes } from "dsabp-js-img"
import { PointData } from "pixi.js"
import { NoUpdateOptions } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"
import { fixPoint } from "../util.js"

export function moveObject(obj: MapObject, bpPoint?: PointData, wPoint?: PointData, noUpdate?: NoUpdateOptions) {
	const { editorMap, editorMap: { squareSize, dependents, configs, highlight, pusherBeams }, item, x, y, isDisabled } = obj

	if (!noUpdate?.server)
		editorMap.emit("objectmove", obj, bpPoint, wPoint, noUpdate)

	bpPoint ??= editorMap.toBpPoint(wPoint)
	fixPoint(bpPoint)

	const { x: dx, y: dy } = bpPoint
	wPoint ??= editorMap.toWorldPoint({ x: dx, y: dy })
	fixPoint(wPoint)

	if (!isDisabled) {
		obj.dependencies?.forEach(coordStr => {
			const [x, y] = coordStr.split(",")
			dependents[x]?.[y]?.delete(obj)
			obj.dependencies.delete(coordStr)
		})
	}

	if (!isDisabled)
		editorMap.removeObjectPos(obj)

	obj.x = dx
	obj.y = dy

	if (!isDisabled)
		editorMap.addObjectPos(obj)

	obj.body.setPosition(wPoint.x, wPoint.y, !isDisabled)

	obj.display.x = wPoint.x - squareSize / 2
	obj.display.y = wPoint.y - squareSize / 2

	if (!isDisabled && item) {
		if (item.isBlock) {
			if (dependents[x]?.[y])
				editorMap.updateDependents(x, y)
			if (dependents[dx]?.[dy])
				editorMap.updateDependents(dx, dy)
		}

		if (!noUpdate?.all && !noUpdate?.connTxt && connectedTileTypes.has(item)) {
			editorMap.updateConnTexAround({ x, y })
			editorMap.updateConnTexAround({ x: dx, y: dy }, obj)
		}

		const buildInfo = item.buildInfo[obj.buildInfoIndex]
		if (buildInfo.require_blocks) {
			const reqInfo = editorMap.findRequiredBlocks(item.buildInfo[obj.buildInfoIndex], dx, dy)
			if (
				(obj.isValid = obj.isValid && reqInfo.meets)
			)
				reqInfo.found.forEach(pos => {
					((dependents[pos.x] ??= [])[pos.y] ??= new Set()).add(obj);
					(obj.dependencies ??= new Set()).add(`${pos.x},${pos.y}`)
				})
		}
	}

	if (configs.menu?.mapObject == obj)
		highlight.showFor("focus", obj)
	if (configs.shapePickerMapObject == obj)
		highlight.showFor("focus2", obj)

	if (obj.item == Item.PUSHER)
		pusherBeams.update(obj)
	if (!obj.isDisabled)
		pusherBeams.updateHittingPushers(obj.body)
}
