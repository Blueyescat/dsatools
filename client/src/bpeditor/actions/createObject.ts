import { Image } from "@napi-rs/canvas"
import { BodyOptions, deg2rad } from "detect-collisions"
import { Item, Shape } from "dsabp-js"
import { connectedTileTypes, findBuildInfoIndex, getDrawItemData } from "dsabp-js-img"
import { PointData, Rectangle, Texture } from "pixi.js"
import { NoUpdateOptions } from "../EditorMap.js"
import { MapObject, MapObjectData } from "../MapObject.js"
import { fixPoint, getHullD8Rotation, scaleVertices } from "../util.js"

export async function createObject(data: MapObjectData, saveToHistory: boolean, noUpdate?: NoUpdateOptions, image?: Image) {
	const { editorMap, editorMap: { bp, bpRenderer, squareSize, collisions, history, dependents, pusherBeams }, item, bgTileType, x, y, shape, config } = data

	if (!noUpdate?.server && !bgTileType)
		editorMap.emit("objectcreate", data, noUpdate)

	fixPoint(data)
	let hullDirection = data.hullDirection

	if (bgTileType)
		data.y = bp.height - 1 - data.y

	const obj = new MapObject(data)
	const dispObj = obj.display

	if (!hullDirection && item?.buildInfo[0].allow_world)
		obj.hullDirection = hullDirection = editorMap.getHullDirection(x, y)

	if (hullDirection && obj.config.fixedAngle) // ejector
		obj.config.fixedAngle = hullDirection

	const historyCommand = saveToHistory && history.addPreset("createObject", data, image)

	let bodyPos: PointData, bodyAngle: number
	if (!bgTileType) {
		for (
			const { image, pos, drawPosOff, size, baseSize, sx, sy, sw, sh, angle, layer }
			of await getDrawItemData(bpRenderer, item, x, y, shape, config, hullDirection, { noPusherBeam: true })
		) {
			const isBase = !dispObj.children.length
			const sprite = await obj.addSprite(image)

			const needFrame = sx != null || sy != null || sw != null || sh != null
			if (needFrame || hullDirection)
				sprite.texture = new Texture({
					source: sprite.texture.source,
					frame: needFrame ? new Rectangle(sx ?? 0, sy ?? 0, sw ?? image.width, sh ?? image.height) : null,
					rotate: getHullD8Rotation(hullDirection)
				})

			if (angle != null)
				sprite.angle = angle

			sprite.setSize(size.w, size.h)

			sprite.position.set(drawPosOff.x + size.w / 2, drawPosOff.y + size.h / 2)

			const zI = (bpRenderer.zIndexMap.get(item) ?? 0) + (item.buildInfo[0].allow_world ? 3 : 0)
			sprite.zIndex = zI + (layer == "top" ? 1 : 0)

			if (isBase) {
				bodyAngle = angle
				dispObj.zIndex = sprite.zIndex
				dispObj.position.set(pos.x - squareSize / 2, pos.y - squareSize / 2)

				bodyPos = { x: pos.x, y: pos.y }

				obj.width = baseSize.w
				obj.height = baseSize.h
			}
		}
	} else {
		const sprite = await obj.addSprite(image)
		dispObj.eventMode = "none"
		dispObj.position.set(x * squareSize, y * squareSize)
		bodyPos = dispObj.position
		sprite.setSize(squareSize)
		obj.width = squareSize
		obj.height = squareSize
		dispObj.zIndex = -1
	}

	if (bgTileType != "paint") {
		const isShapedBlock = item?.buildInfo?.[0].block_shaped && shape != null && shape != Shape.BLOCK		
		const bodyOpts = { isCentered: !isShapedBlock, angle: !bodyAngle ? 0 : deg2rad(bodyAngle) } as BodyOptions
		if (item == Item.ITEM_LAUNCHER)
			bodyOpts.angle = 0

		if (item?.buildInfo?.[0].shape?.verts || isShapedBlock)
			obj.body = collisions.createPolygon(bodyPos, scaleVertices(item, 0, isShapedBlock ? shape : null, squareSize), bodyOpts)
		else
			obj.body = collisions.createBox(bodyPos, obj.width, obj.height, bodyOpts)

		obj.body.mapObject = obj
	}

	if (item) {
		if (!noUpdate?.all && !noUpdate?.connTxt && connectedTileTypes.has(item))
			await editorMap.updateConnTexAround(data, obj)

		if (item.isBlock)
			editorMap.updateDependents(x, y)

		const buildInfoIndex = data.buildInfoIndex
			?? (obj.buildInfoIndex = data.buildInfoIndex = findBuildInfoIndex(item, hullDirection))

		if (item.buildInfo[buildInfoIndex].require_blocks) {
			const reqInfo = editorMap.findRequiredBlocks(item.buildInfo[buildInfoIndex], x, y)
			if (
				(obj.isValid = reqInfo.meets)
			)
				reqInfo.found.forEach(pos => {
					const s = (dependents[pos.x] ??= [])[pos.y] ??= new Set()
					for (const dep of s)
						if (!dep.body.system)
							s.delete(dep)
					s.add(obj);
					(obj.dependencies ??= new Set()).add(`${pos.x},${pos.y}`)
				})
		}
	}

	if (!noUpdate?.all && !noUpdate?.bpStr)
		editorMap.updateBpStr()

	if (!noUpdate?.all && !noUpdate?.pushers) {
		if (item == Item.PUSHER)
			pusherBeams.update(obj)
		pusherBeams.updateHittingPushers(obj.body)
	}

	if (historyCommand)
		delete historyCommand.isLocked
	return obj
}
