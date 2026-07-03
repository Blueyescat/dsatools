import { connectedTileTypes, findBuildInfoIndex } from "dsabp-js-img"
import { checkPlacement } from "../checkPlacement.js"
import { MapObject } from "../MapObject.js"
import { some } from "../util.js"
import { updateObject } from "./updateObject.js"

export function connectObject(obj: MapObject, multipleObjs?: MapObject[], keepServer?: boolean) {
	const { editorMap, editorMap: { pusherBeams, dependents }, item, x, y, body } = obj

	pusherBeams.updateHittingPushers(body)

	if (obj.isValid && connectedTileTypes.has(item))
		editorMap.updateConnTexAround({ x, y }, true)

	if (item.isBlock)
		editorMap.updateDependents(x, y, !multipleObjs?.length ? null : dep =>
			!some(multipleObjs, o => o == dep)
		)

	const hullDirection = obj.hullDirection ? editorMap.getHullDirection(x, y) : null

	if (hullDirection && hullDirection != obj.hullDirection) {
		obj.hullDirection = hullDirection
		updateObject(obj, { keepBpStr: true, keepServer })
		obj.buildInfoIndex = findBuildInfoIndex(item, hullDirection)
	}

	const buildInfoIndex = obj.buildInfoIndex
		?? (obj.buildInfoIndex = findBuildInfoIndex(item, hullDirection))

	editorMap.addObjectPos(obj)
	const res = checkPlacement(editorMap, item, body, x, y, buildInfoIndex)
	obj.isValid = res.can

	if (item.buildInfo[buildInfoIndex].require_blocks) {
		const reqInfo = editorMap.findRequiredBlocks(item.buildInfo[buildInfoIndex], x, y)
		if (
			(obj.isValid = obj.isValid && reqInfo.meets)
		)
			reqInfo.found.forEach(pos => {
				((dependents[pos.x] ??= [])[pos.y] ??= new Set()).add(obj);
				(obj.dependencies ??= new Set()).add(`${pos.x},${pos.y}`)
			})
	}
}
