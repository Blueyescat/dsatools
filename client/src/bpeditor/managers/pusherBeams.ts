import { Body, BodyGroup, deg2rad, distance, intersectLineCircle, intersectLinePolygon, Line } from "detect-collisions"
import { Item, PusherMode } from "dsabp-js"
import { getImage } from "dsabp-js-img"
import { Assets, ColorMatrixFilter, PointData, Sprite, Texture, TilingSprite } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"

const allowPusherBeamTiles = new Set([Item.BLOCK_ITEM_NET, Item.BLOCK_LADDER, Item.BLOCK_ICE_GLASS, Item.BLOCK_WALKWAY, Item.BLOCK_ANNIHILATOR, Item.BLOCK_LOGISTICS_RAIL])

export async function initPusherBeams(editorMap: EditorMap) {
	const { squareSize, collisions, viewport, app: { renderer }, objects } = editorMap

	let texPush: Texture, texPull: Texture, texIdle: Texture

	async function generateTextures() {
		const baseTexBeam = await Assets.load((await getImage("pusher_beam")).src)
		const lineTextureSrc = "./assets/pusher_beam_idle.png"
		const baseTexLine = await Assets.load(lineTextureSrc)

		const filter = new ColorMatrixFilter()
		const s = new Sprite({ texture: baseTexBeam, alpha: 0.251 })
		s.filters = filter

		filter.brightness(1.8, true)
		filter.tint(0x00ff00, true)
		texPush = renderer.generateTexture(s)

		filter.reset()
		filter.brightness(1.8, true)
		filter.tint(0xff00ff, true)
		texPull = renderer.generateTexture(s)

		filter.reset()
		filter.brightness(0, true)
		s.texture = baseTexLine
		texIdle = renderer.generateTexture(s)

		filter.destroy()
		Assets.unload(lineTextureSrc).then(() => s.destroy(true))
	}
	await generateTextures()

	async function update(obj: MapObject, ignoreBody?: Body) {
		const isNew = !obj.pusherBeam

		if (isNew) {
			obj.pusherBeam = {
				sprite: new TilingSprite({
					label: "pusherBeam",
					width: 0,
					height: texIdle.height,
					anchor: { x: 0, y: 0.5 },
					x: obj.body.x,
					y: obj.body.y,
					zIndex: 10
				})
			}
			viewport.addChild(obj.pusherBeam.sprite)

			obj.on("transform", () => {
				sprite.x = obj.body.x
				sprite.y = obj.body.y
			})
		}

		const sprite = obj.pusherBeam.sprite,
			body = obj.body,
			defaultMode = obj.config.pusher.defaultMode,
			isPush = defaultMode == PusherMode.PUSH

		sprite.texture = isPush ? texPush : (defaultMode == PusherMode.PULL ? texPull : texIdle)
		sprite.anchor.x = isPush ? 1 : 0
		sprite.scale.x = isPush ? -1 : 1

		const rotationRAD = deg2rad(-obj.config.pusher.angle)

		sprite.rotation = rotationRAD

		const maxBeamLength = obj.config.pusher.maxBeamLength * squareSize,
			startPoint = body.pos.clone(),
			endPoint = {
				x: body.x + (Math.cos(rotationRAD) * maxBeamLength),
				y: body.y + (Math.sin(rotationRAD) * maxBeamLength)
			}

		let line: Line
		if (isNew) {
			obj.pusherBeam.body = line = collisions.createLine(startPoint, endPoint)
			line.pusher = obj
		} else {
			line = obj.pusherBeam.body
			line.start = startPoint
			line.end = endPoint
			line.updateBody()
		}

		let minDistance = Infinity,
			rayHit: { point: PointData, body: Body, distance: number }

		collisions.checkOne(line, ({ b: testBody }) => {
			if (testBody == body || testBody == ignoreBody) return

			const mapObject = (testBody as Body).mapObject
			if (!mapObject || mapObject.isDisabled || !mapObject.isValid) return

			const item = mapObject?.item
			if (item?.isBlock && allowPusherBeamTiles.has(item)
				|| item?.buildInfo?.[mapObject.buildInfoIndex]?.allow_solids
				|| item == Item.ITEM_LAUNCHER
			)
				return

			const points = body.typeGroup == BodyGroup.Circle ? intersectLineCircle(line, testBody) : intersectLinePolygon(line, testBody)

			points.forEach(point => {
				const pointDistance: number = distance(startPoint, point)
				if (pointDistance < minDistance) {
					minDistance = pointDistance
					rayHit = { point, body: testBody, distance: minDistance }
				}
			})
		})

		// if (rayHit) line.end = rayHit.point

		sprite.width = rayHit?.distance ?? maxBeamLength

		if (isNew)
			obj.once("destroy", () => {
				sprite.destroy({ context: true })
				collisions.remove(line)
			})
	}

	setInterval(() => {
		for (const obj of objects) {
			if (obj.item == Item.PUSHER && obj.pusherBeam && obj.config.pusher.defaultMode != PusherMode.DO_NOTHING) {
				const sprite = obj.pusherBeam.sprite,
					spriteWidth = sprite.texture.width,
					speed = Math.min(8, obj.config.pusher.targetSpeed) / 1.5

				sprite.tilePosition.x = (sprite.tilePosition.x - speed + spriteWidth) % spriteWidth
			}
		}
	}, 18)

	function updateHittingPushers(body: Body, ignoreBody?: boolean) {
		collisions.checkOne(body, ({ b }) => {
			if ((b as Line).pusher)
				update(b.pusher, ignoreBody ? body : null)
		})
	}

	return { update, updateHittingPushers, generateTextures }
}
