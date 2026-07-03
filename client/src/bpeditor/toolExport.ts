import { Body } from "detect-collisions"
import { Blueprint, BuildCmd, ConfigCmd, encode, Shape } from "dsabp-js"
import { Graphics } from "pixi.js"
import { editorMap } from "./main.js"
import { MapObject } from "./MapObject.js"
import { SelectBox } from "./SelectBox.js"
import { winMan } from "./ui/uiMain.js"
import { processBuildCommands } from "/bptools/operations.js"
import { usesTouch } from "/main.js"

const { squareSize, info, events, placement, bp: mapBp, collisions } = editorMap,

	square = new Graphics({ pivot: squareSize / 2, zIndex: 100, visible: false })
		.rect(0, 0, squareSize, squareSize)
		.fill({ color: "blue", alpha: 0.5 }),

	objects: MapObject[] = [],

	selectBox = new SelectBox({
		editorMap,
		lineWidth: 3,
		color: "blue",
		enableSnapping: { outer: true },
		limitToWithinShip: true,
		enableSizeIndicator: true,
		onSelectionStarted(e) {
			if (usesTouch) {
				square.visible = true
				updateSquarePos()
			}
			selectBox.updateSelection(e) // let down without move select a square
		},
		onSelectionEnding(esc) {
			const sb = this as SelectBox
			if (esc || !sb.body.width) return

			const bp = new Blueprint({
				width: Math.floor(sb.body.width / squareSize),
				height: Math.floor(sb.body.height / squareSize)
			})

			objects.length = 0
			const bbox = sb.bbox
			let lastCfg: ConfigCmd
			collisions.checkOne(sb.body, res => {
				const obj = (res.b as Body).mapObject
				if (!obj || obj.bgTileType || !obj.isValid || (editorMap.onlyRcdItems && obj.item.blacklist_autobuild))
					return

				const objMid = (res.b as Body).pos
				if (objMid.x >= bbox.minX && objMid.x <= bbox.maxX
					&& objMid.y >= bbox.minY && objMid.y <= bbox.maxY
				) {
					objects.push(obj)
					if (!obj.config?.equals(lastCfg)) {
						lastCfg = obj.config
						bp.commands.push(obj.config ?? new ConfigCmd())
					}
					bp.commands.push(new BuildCmd({
						x: (objMid.x - bbox.minX) / squareSize - 0.5,
						y: bp.height - ((objMid.y - bbox.minY)) / squareSize - 0.5,
						item: obj.item,
						shape: obj.shape == Shape.BLOCK ? undefined : obj.shape
					}))
				}
			})

			processBuildCommands(bp)

			encode(bp).then(str => {
				winMan.itemMatList
					.setType("export-tool")
					.setSource(objects)
				winMan.buildOrder
					.setType("export-tool")
				winMan.bpStr
					.setType("export-tool")
					.setBlueprint(bp, str)
					.setObjectsSource(objects)
					.open()

				winMan.bpStr.win.addEventListener("close", () => {
					if (winMan.itemMatList.type == "export-tool")
						winMan.itemMatList.win.close()
					if (winMan.buildOrder.type == "export-tool")
						winMan.buildOrder.win.close()
				}, { once: true })
			})

			if (usesTouch)
				square.visible = false
		}
	})

let interval: number
editorMap.on("toolchange", () => {
	const enable = info.selectedTool == "bpexport"
	selectBox.toggle(enable)
	square.visible = !usesTouch && enable

	if (!enable) {
		if (winMan.bpStr.type == "export-tool")
			winMan.bpStr.win.close()
		return clearInterval(interval)
	}

	interval = setInterval(updateSquarePos, 8)
})

editorMap.viewport.addChild(square)

function updateSquarePos() {
	if (!events.pointer.lastPointerPoint)
		return
	square.visible = !info.dragging

	const pos = placement.calc(editorMap.events.pointer.body.pos.clone(), true, true),
		maxX = (mapBp.width - 1) * squareSize,
		maxY = (mapBp.height - 1) * squareSize

	if (pos.x < 0) pos.x = 0
	else if (pos.x > maxX) pos.x = maxX
	if (pos.y < 0) pos.y = 0
	else if (pos.y > maxY) pos.y = maxY
	square.position.copyFrom(pos)
}
