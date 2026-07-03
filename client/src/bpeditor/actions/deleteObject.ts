import { connectedTileTypes } from "dsabp-js-img"
import { NoUpdateOptions } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"

export function deleteObject(obj: MapObject, saveToHistory: boolean, noUpdate?: NoUpdateOptions) {
	if (!obj?.body?.system) return
	const { editorMap, editorMap: { dependents, history }, item, x, y, dependencies, body } = obj

	if (!noUpdate?.server)
		editorMap.emit("objectsdelete", [obj], noUpdate)

	editorMap.pusherBeams.updateHittingPushers(body, true)
	obj.destroy()

	dependencies?.forEach(coordStr => {
		const [x, y] = coordStr.split(",")
		dependents[x]?.[y]?.delete(obj)
	})

	if (item) {
		if (item.isBlock && dependents[x]?.[y])
			editorMap.updateDependents(x, y)
		if (!noUpdate?.all && !noUpdate?.connTxt && connectedTileTypes.has(item))
			editorMap.updateConnTexAround(obj)
	}

	if (!noUpdate?.all && !noUpdate?.bpStr)
		editorMap.updateBpStr()

	if (saveToHistory)
		history.addPreset("deleteObject", {
			editorMap, x, y, item,
			bgTileType: obj.bgTileType,
			shape: obj.shape,
			config: obj.config,
			buildInfoIndex: obj.buildInfoIndex
		}, x, y, item)
}
