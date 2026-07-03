import { BitmapText, PointData } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"
import { app } from "../main.js"
import { getUnpackagedName } from "../util.js"

const textFps = new BitmapText({
	style: {
		fontSize: 18,
		fontWeight: "bolder",
		fill: 0x00FF00,
		stroke: {
			color: 0,
			width: 4
		}
	},
	visible: false,
	position: {
		x: 87,
		y: -4
	},
	zIndex: 100
})

const textPos = new BitmapText({
	style: {
		fontSize: 16,
		fontWeight: "bolder",
		fill: 0x00FF00,
		stroke: {
			color: 0,
			width: 3
		}
	},
	anchor: { x: 0.5, y: -1 },
	visible: false,
	zIndex: 100
})

const textTargetInfo = new BitmapText({
	style: {
		fontSize: 14,
		fontWeight: "bolder",
		fill: 0x00FF00,
		stroke: {
			color: 0,
			width: 3
		},
		align: "left"
	},
	visible: false,
	zIndex: 100
})

export function initDebug(editorMap: EditorMap) {
	const { squareSize, events, viewport, placement } = editorMap

	app.stage.addChild(textFps)
	app.stage.addChild(textPos)
	app.stage.addChild(textTargetInfo)

	let lastObj: MapObject, lastObjectInterval: number

	const tick = () => {
		const worldPos = events.pointer.body.pos.clone() as PointData
		const screenPos = viewport.toGlobal(worldPos)
		const mapObject = events.pointer.target?.mapObject
		const squarePos = editorMap.toBpPoint(placement.calc(worldPos, true, true))

		// fps
		textFps.text = app.ticker.FPS.toFixed(1) + " FPS"

		// target pos
		textPos.position.set(screenPos.x, screenPos.y)
		textPos.text = squarePos.x + ", " + squarePos.y

		// target info
		if (mapObject && (!lastObj || mapObject == lastObj)) {
			textTargetInfo.visible = true
			textTargetInfo.position.set(screenPos.x + squareSize * 1.1, screenPos.y - squareSize)
			textTargetInfo.text = `Object: ${mapObject.bgTileType ? `${mapObject.bgTileType} ` : ""}${mapObject.x}, ${mapObject.y} | ${mapObject.display.children[0]?.angle}°`
				+ ` | zIndex ${mapObject.display.zIndex}\n`
				+ "Dependencies:\n"
				+ (mapObject.dependencies?.size
					? Array.from(mapObject.dependencies).map(coordStr => {
						const [x, y] = coordStr.split(",").map(Number)
						const o = editorMap.getObjectByPos(x, y, o => o.bgTileType != "paint")
						return `${x}, ${y} ${o?.item ? getUnpackagedName(o.item) : o?.bgTileType}`
					}).join("\n")
					: "--")
				+ "\nDependents:\n"
				+ (editorMap.dependents[squarePos.x]?.[squarePos.y]?.size
					? Array.from(editorMap.dependents[squarePos.x]?.[squarePos.y]).map(o => {
						return `${o.x}, ${o.y} ${o.item ? getUnpackagedName(o.item) : o?.bgTileType}`
					}).join("\n")
					: "--")
			lastObj = mapObject
		} else {
			textTargetInfo.visible = false
		}
		/* if (events.pointer.target)
			editorMap.collisions.checkOne(events.pointer.target, res => {
				if (res.b != events.pointer.body)
					console.info(res.a.mapObject?.item?.name, "-", res.b.type, res.b.mapObject?.item?.name ?? res.b.mapObject?.bgTileType, "o", res.overlap, "V", res.overlapV, "N", res.overlapN, "fa", res.b.mapObject?.config?.fixedAngle)
			}) */
	}

	return new (class DebugSystem {
		enabled: boolean

		enable() {
			textPos.visible = textFps.visible = this.enabled = true
			app.ticker.add(tick)
			lastObjectInterval = setInterval(() => lastObj = null, 100)
		}

		disable() {
			textTargetInfo.visible = textPos.visible = textFps.visible = this.enabled = false
			app.ticker.remove(tick)
			clearInterval(lastObjectInterval)
		}

		constructor() {
			window.addEventListener("keydown", e => document.activeElement == document.body && e.code == "Slash" && !this.enabled && this.enable())
			window.addEventListener("keyup", e => e.code == "Slash" && this.enabled && this.disable())
		}
	})
}
