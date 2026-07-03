import { distance } from "detect-collisions"
import { ConfigCmd, Item } from "dsabp-js"
import { PointData } from "pixi.js"
import { editorMap } from "../uiMain.js"
import { updateObject } from "/bpeditor/actions/updateObject.js"
import { EditorMapEvents } from "/bpeditor/EditorMap.js"
import { getConfigDiff } from "/bpeditor/managers/configs.js"
import { MovingConfiguringUndoRedoData } from "/bpeditor/managers/selection.js"
import { MapObject } from "/bpeditor/MapObject.js"
import { setSelectedTool } from "/bpeditor/util.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"

const angle = (a: PointData, b: PointData) => Math.atan2(-(b.y - a.y), (b.x - a.x)) * (180 / Math.PI)

export function initPusherFocuser() {
	new Dialog({
		title: "Pusher Focuser",
		draggable: { key: "pusherfocuser" },
		defaultPos: { left: "60%", top: "10%" },
		body: /*html*/`
			<p class="smaller">Select some pushers, enable it, click/hold to focus the beams.</p>
			<p class="smaller">Disable or close to update the pushers, which also adds to history.</p>
			<p>Enable: <input type="checkbox" class="cb-enable"></p>
			<p>Change max beam length: <input type="number" class="input-length"></p>
			<p class="smaller" style="margin-block: -0.8em 0;">(0 = distance to pusher, >0 = leave space)</p>
			<p class="info" style="display: none; margin-top: 0.9em;"></p>
		`,
		onCreate(dialog) {
			const { info, events, selection, pusherBeams, app, squareSize, history } = editorMap

			document.getElementById("button-menu-pusherfocuser").addEventListener("click", () => dialog.toggle())

			let pointerEvtHandler: EditorMapEvents["pointeraction"]

			dialog.addEventListener("open", () => {
				let enabled: boolean,
					maxLength: number,
					needsUpdate: boolean,
					objects: MapObject[]

				const elInfo = elByCls<HTMLInputElement>(dialog, "info"),
					undoRedoData: MovingConfiguringUndoRedoData[] = [],
					origConfig: ConfigCmd[] = []

				dialog.addListener({
					target: elByCls<HTMLInputElement>(dialog, "cb-enable"),
					type: "change",
					fn: function () {
						enabled = this.checked
						setSelectedTool(editorMap, enabled ? "special" : "select")
						if (enabled) {
							objects = Array.from(selection.selectedObjects).filter(o => o.item == Item.PUSHER)
							for (let i = 0; i < objects.length; i++) {
								undoRedoData[i] = { item: objects[i].item, currPos: { x: objects[i].x, y: objects[i].y }, fromPos: { x: objects[i].x, y: objects[i].y } } as MovingConfiguringUndoRedoData
								origConfig[i] = objects[i].config.clone()
							}
						} else {
							updatePushers()
						}
					}
				})

				dialog.addListener({
					target: elByCls<HTMLInputElement>(dialog, "input-length"),
					type: "input",
					fn: function () {
						if (this.value.trim() == "")
							maxLength = null
						else {
							maxLength = this.valueAsNumber
							if (isNaN(maxLength))
								maxLength = null
						}
					}
				})

				async function updatePushers() {
					if (!needsUpdate) return
					elInfo.textContent = "/!\\ Updating objects..."
					elInfo.style.display = ""
					for (const [i, pusher] of objects.entries()) {
						let a = pusher.config.pusher.angle % 360
						if (a < 0)
							a += 360
						pusher.config.pusher.angle = a

						updateObject(pusher, { keepBpStr: true, keepPusherBeam: true })
						if (Math.random() > 0.5)
							await new Promise(r => setTimeout(r))
						undoRedoData[i].configDiff = getConfigDiff(origConfig[i], pusher.config)
					}


					const undoRedoDataClone = undoRedoData.slice()
					history.add({
						type: `focusPushers`,
						undo: async () => {
							await selection.movingConfiguringMultipleUndoRedo(undoRedoDataClone, true)
							editorMap.updateBpStr()
						},
						redo: async () => {
							await selection.movingConfiguringMultipleUndoRedo(undoRedoDataClone, false)
							editorMap.updateBpStr()
						}
					})

					editorMap.updateBpStr()
					elInfo.textContent = "Done."
					setTimeout(() => elInfo.style.display = "none", 4000)

					needsUpdate = false
					undoRedoData.length = origConfig.length = 0
				}

				let cooldown: boolean
				editorMap.on("pointeraction", pointerEvtHandler = async ({ type, target }) => {
					if (enabled && !cooldown && type == "down" && target == app.canvas) {
						cooldown = true
						const c = events.pointer.body.pos
						for (const pusher of selection.selectedObjects) {
							if (pusher.item != Item.PUSHER) continue
							const p = pusher.body.pos
							pusher.config.pusher.angle = angle(p, c)
							if (maxLength != null) {
								const dis = distance(p, c) / squareSize
								pusher.config.pusher.maxBeamLength = Math.min(1000, dis - maxLength)
							}

							await pusherBeams.update(pusher)
						}
						needsUpdate = true
						cooldown = false
					}
				})

				dialog.addEventListener("close", () => {
					if (info.selectedTool == "special")
						setSelectedTool(editorMap, "select")
					updatePushers()
					editorMap.off("pointeraction", pointerEvtHandler)
				}, { once: true })
			})
		}
	})
}
