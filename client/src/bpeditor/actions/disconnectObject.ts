import { connectedTileTypes } from "dsabp-js-img"
import { MapObject } from "../MapObject.js"
import { some } from "../util.js"

export function disconnectObject(obj: MapObject, multipleObjs?: MapObject[]) {
	const { editorMap, editorMap: { pusherBeams, dependents }, item, x, y, dependencies, body } = obj

	pusherBeams.updateHittingPushers(body)

	dependencies?.forEach(coordStr => {
		const [x, y] = coordStr.split(",")
		dependents[x]?.[y]?.delete(obj)
		dependencies.delete(coordStr)
	})

	editorMap.removeObjectPos(obj)

	if (item.isBlock)
		editorMap.updateDependents(x, y, !multipleObjs?.length ? null : dep =>
			!some(multipleObjs, o => o == dep)
		)

	if (connectedTileTypes.has(item))
		editorMap.updateConnTexAround({ x, y }, false, !multipleObjs?.length ? null : (tx, ty) =>
			!some(multipleObjs, o => o.isValid && o.x == tx && o.y == ty)
		)
}
