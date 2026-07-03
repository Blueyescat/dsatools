import { Body, Line } from "detect-collisions"
import { ConfigCmd, FixedAngle, Item, Shape } from "dsabp-js"
import { getShipBackgroundData } from "dsabp-js-img"
import { Assets, ColorSource, Container, EventEmitter, Graphics, Sprite, TextureSourceLike, TilingSprite } from "pixi.js"
import { EditorMap } from "./EditorMap.js"

export interface MapObjectData {
	editorMap: EditorMap,
	x: number,
	y: number,
	bgTileType?: Awaited<ReturnType<typeof getShipBackgroundData>>["tiles"][0][0]["type"],
	item?: Item,
	buildInfoIndex?: number
	shape?: Shape,
	config?: ConfigCmd,
	hullDirection?: FixedAngle
}

const outlines = [
	{
		label: "find",
		width: 5,
		color: 0xFF5733,
		crossed: true
	},
	{
		label: "select",
		width: 2,
		color: 0x0099FF,
		crossed: false
	}
] as const

type OutlineLabel = (typeof outlines)[number]["label"]

export class MapObject extends EventEmitter<{ transform: [], destroy: [] }> implements MapObjectData {
	editorMap: MapObjectData["editorMap"]
	x: MapObjectData["x"]
	y: MapObjectData["y"]
	bgTileType: MapObjectData["bgTileType"]
	item: MapObjectData["item"]
	buildInfoIndex: MapObjectData["buildInfoIndex"]
	shape: MapObjectData["shape"]
	config: MapObjectData["config"]
	declare hullDirection?: MapObjectData["hullDirection"]

	width: number
	height: number
	body: Body
	display: Container
	isDisabled = false
	/** Positions of dependencies of this object. */
	dependencies: Set<`${number},${number}`>
	private _isValid = true

	declare outline: { graph?: Graphics, labels: Set<OutlineLabel>, updateHandler?: () => void }
	declare pusherBeam?: { sprite?: TilingSprite, body?: Line }
	declare overridePoly?: SAT.Vector[]
	declare private _isSelected: boolean
	declare private _boostedZIndex: boolean

	constructor(data: MapObjectData) {
		super()
		const editorMap = data.editorMap

		if (Object.getPrototypeOf(data) != Object.prototype)
			throw new TypeError("data must be an object literal")
		Object.assign(this, data)

		editorMap.objects.add(this)
		editorMap.addObjectPos(this)
		this.config ??= new ConfigCmd()
		editorMap.viewport.addChild(this.display = new Container())

		const contOrigOnUpdate = this.display._onUpdate
		this.display._onUpdate = point => {
			this.emit("transform")
			contOrigOnUpdate.call(this.display, point)
		}
	}

	async addSprite(image: TextureSourceLike) {
		const sprite = this.display.addChild(Sprite.from(await Assets.load(image)))
		sprite.label = `objectTex-${this.display.children.length - 1}`
		sprite.anchor.set(0.5)

		const spriteOrigOnUpdate = sprite._onUpdate
		sprite._onUpdate = point => {
			this.emit("transform")
			spriteOrigOnUpdate.call(sprite, point)
		}

		return sprite
	}

	destroy() {
		this.removeOutline()
		this.editorMap.selection.selectedObjects.delete(this)
		this.editorMap.removeObjectPos(this)
		this.editorMap.objects.delete(this)

		if (this.body)
			this.body.system.remove(this.body)
		this.display.destroy()
		this.emit("destroy")
		this.removeAllListeners()
	}

	get isValid() {
		return this._isValid
	}
	set isValid(v: boolean) {
		if (v != this._isValid) {
			if (!v && !this._boostedZIndex) {
				this._boostedZIndex = true
				this.display.zIndex += 2
			} else if (this._boostedZIndex) {
				delete this._boostedZIndex
				this.display.zIndex -= 2
			}
			this.display.tint = v ? 0xFFFFFF : 0xFF0000
			this.display.alpha = v ? 1 : 0.65
			this._isValid = !!v
		}
	}

	hasOutline(label?: OutlineLabel) {
		return label ? !!this.outline?.labels.has(label) : !!this.outline?.graph.parent
	}

	setOutline(color: ColorSource, label?: OutlineLabel) {
		const outline = this.outline
		if (outline?.graph.parent) {
			//outline.graph.strokeStyle.color = Color.shared.setValue(color).toNumber()
			if (label)
				outline.labels.add(label)
			outline.updateHandler()
		} else {
			const outline = this.outline ??= { labels: new Set() },
				g = outline.graph ??= new Graphics({ zIndex: 20 }),
				sprite = this.display.children[0]

			this.editorMap.viewport.addChild(g)

			let left: number, top: number

			this.on("transform", outline.updateHandler = () => {
				g.clear()
				left = -this.width / 4
				top = -this.height / 4

				for (const o of outlines) {
					if (outline.labels.has(o.label))
						g.rect(left, top, this.width, this.height).stroke({
							width: o.width,
							color: o.color
						})
				}

				g.rotation = sprite?.rotation ?? 0 // in case no sprite when spamming blocks

				const cos = Math.cos(g.rotation),
					sin = Math.sin(g.rotation)
				g.position.set(
					(this.body ?? this.display).x + (left * cos - top * sin),
					(this.body ?? this.display).y + (left * sin + top * cos)
				)
			})

			if (label)
				outline.labels.add(label)

			outline.updateHandler()
		}
	}

	removeOutline(label?: OutlineLabel) {
		const outline = this.outline
		if (outline?.graph.parent) {
			if (label) {
				outline.labels.delete(label)
				if (outline.labels.size)
					return outline.updateHandler()
			}
			outline.graph.clear().removeFromParent()
			this.off("transform", outline.updateHandler)
			delete outline.updateHandler
			outline.labels.clear()
		}
	}

	get isSelected() {
		return this._isSelected
	}
	set isSelected(v: boolean) {
		if (v) {
			if (!this._isSelected) {
				this._isSelected = v
				this.setOutline(0x0099ff, "select")
			}
		} else if (this._isSelected) {
			this._isSelected = v
			this.removeOutline("select")
		}
	}

	get isRcdSupported() {
		return !(this.item.blacklist_autobuild || this.x < -0.5 || this.x > this.editorMap.bp.width - 0.5 || this.y < -0.5 || this.y > this.editorMap.bp.height - 0.5)
	}
}
