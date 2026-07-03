import { Image } from "@napi-rs/canvas"
import { Box, deg2rad, ensurePolygonPoints, Polygon } from "detect-collisions"
import { Item } from "dsabp-js"
import { findBuildInfoIndex, getDrawItemData } from "dsabp-js-img"
import { Assets, Sprite, Texture } from "pixi.js"
import { checkPlacement } from "../checkPlacement.js"
import { MapObject, MapObjectData } from "../MapObject.js"
import { getHullD8Rotation, isBox, isPolygon, scaleVertices, } from "../util.js"

export type UpdateObjectOptions = {
	keepServer?: boolean,
	objectData?: Partial<MapObjectData>,
	keepBody?: boolean,
	checkValidity?: boolean,
	keepBpStr?: boolean,
	keepPusherBeam?: boolean,
	// resetObjectSize?: boolean,
	image?: Image
}

export async function updateObject(obj: MapObject, options: UpdateObjectOptions = {}) {
	if (obj == null) return

	if (options.objectData)
		Object.assign(obj, options.objectData)

	const { editorMap, editorMap: { bpRenderer, squareSize, dependents, pusherBeams }, item, x, y, shape, config, display: dispObj, bgTileType, hullDirection, body } = obj

	if (!options.keepServer)
		editorMap.emit("objectupdate", obj, options)

	if (hullDirection && config.fixedAngle) {
		if (options.checkValidity && config.fixedAngle != hullDirection)
			return false
		config.fixedAngle = hullDirection
	}

	if (!bgTileType) {
		for (
			const [i, { image, size, baseSize, pos, drawPosOff, angle }]
			of (await getDrawItemData(bpRenderer, item, x, y, shape, config, hullDirection, { noPusherBeam: true })).entries()
		) {
			const sprite = dispObj.getChildByLabel(`objectTex-${i}`) as Sprite
			if (!sprite) continue // NOTE: shouldn't happen?
			if (i == 0 && !options.keepBody && bgTileType != "paint") { // base
				const previous = (options.checkValidity ? {} : null) as { points: SAT.Vector[], width: number, height: number, angle: number }

				obj.buildInfoIndex = findBuildInfoIndex(item, hullDirection)

				obj.width = baseSize.w
				obj.height = baseSize.h

				dispObj.position.set(pos.x - squareSize / 2, pos.y - squareSize / 2)

				const isShapedBlock = item?.buildInfo?.[0].block_shaped && shape != null
				if (
					(obj.overridePoly || item?.buildInfo?.[obj.buildInfoIndex].shape?.verts || isShapedBlock)
					&& isPolygon(body)
				) {
					if (options.checkValidity)
						previous.points = body.points
					body.setPoints(obj.overridePoly ?? ensurePolygonPoints(scaleVertices(item, 0, shape, squareSize)))
				} else if (isBox(body)) {
					if (options.checkValidity) {
						previous.width = body.width
						previous.height = body.height
					}
					body.width = obj.width
					body.height = obj.height
					if (body.isCentered) // ADDED DUE TO DC BUG
						body.setPoints(ensurePolygonPoints([{ x: -obj.width / 2, y: -obj.height / 2 }, { x: obj.width / 2, y: -obj.height / 2 }, { x: obj.width / 2, y: obj.height / 2 }, { x: -obj.width / 2, y: obj.height / 2 }]))
				}

				if (angle != null && item != Item.ITEM_LAUNCHER) {
					if (options.checkValidity)
						previous.angle = body.angle
					body.setAngle(deg2rad(angle), false)
				}
				body.updateBody(true)
				pusherBeams.updateHittingPushers(body)

				if (options.checkValidity) {
					if (!checkPlacement(editorMap, obj.item, body, x, y, obj.buildInfoIndex).can) {
						if (previous.points != null)
							(body as Polygon).setPoints(previous.points)
						else if (body.isCentered) // @ts-expect-error: ADDED DUE TO DC BUG
							body.setPoints(ensurePolygonPoints([{ x: -body.width / 2, y: -body.height / 2 }, { x: body.width / 2, y: -body.height / 2 }, { x: body.width / 2, y: body.height / 2 }, { x: -body.width / 2, y: body.height / 2 }]))
						if (previous.width != null)
							(body as Box).width = previous.width
						if (previous.height != null)
							(body as Box).height = previous.height
						if (previous.angle != null)
							body.setAngle(previous.angle, false)
						body.updateBody(true)
						return false
					}
					if (item?.isBlock && dependents[x]?.[y])
						editorMap.updateDependents(x, y)
				}
			}

			if (angle != null)
				sprite.angle = angle

			sprite.setSize(size.w, size.h)

			sprite.x = drawPosOff.x + size.w / 2
			sprite.y = drawPosOff.y + size.h / 2

			let texture = await Assets.load(image)
			texture = new Texture({
				source: texture.source,
				rotate: getHullD8Rotation(hullDirection)
			})
			sprite.texture = texture
		}

		if (!options.keepPusherBeam && obj.item == Item.PUSHER)
			pusherBeams.update(obj)
	} else if (options.image) {
		const sprite = dispObj.getChildByLabel("objectTex-0") as Sprite
		sprite.texture = await Assets.load(options.image)
	}

	if (!options.keepBpStr)
		editorMap.updateBpStr()
	return true
}
