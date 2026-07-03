import { deg2rad } from "detect-collisions"
import { getImage } from "dsabp-js-img"
import { Assets, ColorSource, Sprite, Texture } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"

const cornerAngles = [0, 90, -90, -180].map(deg2rad)

const types = {
	focus: 0x00FFFF,
	focus2: 0x00FFFF,
	clipboard: 0xFF00FF
}
type Types = keyof typeof types

export async function initHighlight(editorMap: EditorMap) {
	const imgCorner = await getImage("corner")
	await Assets.load(imgCorner.src)
	const texture = Texture.from(imgCorner.src)

	function create(tint?: ColorSource) {
		const sprites: Sprite[] = []
		for (let i = 0; i < 4; i++) {
			const sprite = new Sprite({
				texture,
				visible: false,
				eventMode: "none",
				anchor: 0.26,
				tint,
				zIndex: 21
			})
			sprites[i] = sprite
			editorMap.viewport.addChild(sprite)
		}
		return sprites
	}

	function show(sprites: Sprite[], cX: number, cY: number, w: number, h: number, radians?: number) {
		const tL = -w / 2
		const tR = -h / 2
		if (radians) {
			const cos = Math.cos(radians)
			const sin = Math.sin(radians)
			sprites.forEach((sprite, i) => { // TL TR BL BR
				sprite.visible = true
				sprite.rotation = radians + cornerAngles[i]
				const difX = (tL + (i % 2 && w)) // right ? +w
				const difY = (tR + (i >= 2 && h)) // bottom ? +h
				sprite.position.set(
					cX + difX * cos - difY * sin,
					cY + difX * sin + difY * cos
				)
			})
		} else {
			sprites.forEach((sprite, i) => {
				sprite.visible = true
				sprite.rotation = cornerAngles[i]
				sprite.position.set(
					(cX + tL) + (i % 2 && w),
					(cY + tR) + (i >= 2 && h)
				)
			})
		}
	}

	function showFor(sprites: Sprite[], obj: MapObject) {
		show(sprites,
			obj.body.x, obj.body.y,
			obj.width, obj.height,
			obj.body.angle)
	}

	function hide(sprites: Sprite[]) {
		sprites.forEach(s => s.visible = false)
	}

	// HOVER HIGHLIGHT
	const hoverSprites = create()

	editorMap.on("coll-pointerover", e => {
		const mapObject = e.target?.mapObject, info = editorMap.info
		if (!mapObject || mapObject.bgTileType || info.dragging || info.selectedTool == "crop" || info.selectedTool == "bpexport")
			return hide(hoverSprites)
		hoverSprites.forEach(s => s.tint = info.selectedTool == "eraser" ? 0xFF0000 : 0x00FF00)
		showFor(hoverSprites, mapObject)
	})

	editorMap.on("coll-pointerout", () => hide(hoverSprites))

	editorMap.on("toolchange", () => editorMap.events.pointer.check(true))

	// OTHER HIGHLIGHTS
	const otherSprites = {} as Record<Types, Sprite[]>
	for (const type in types)
		otherSprites[type] = create(types[type])

	return {
		showFor: (type: Types, obj: MapObject) =>
			showFor(otherSprites[type], obj)
		,
		hide: (type: Types) =>
			hide(otherSprites[type])
	}
}
