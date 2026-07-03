/* eslint-disable @typescript-eslint/ban-ts-comment */
import { EditorMap } from "../EditorMap.js"
import { winMan } from "../ui/uiMain.js"

import { Image } from "@napi-rs/canvas"
import { Item } from "dsabp-js"
import { createObject } from "../actions/createObject.js"
import { deleteObject } from "../actions/deleteObject.js"
import { importBlueprint } from "../actions/importBlueprint.js"
import { MapObjectData } from "../MapObject.js"
import { deserializeMapObjectData, serializeMapObjectData } from "../util.js"

export interface CommandMain {
	desc?: string
	undo: () => any
	redo: () => any
	/** Whether to block un/redo calls. Use for async operations. */
	isLocked?: boolean
}

export interface Command extends CommandMain {
	type: `createObject` | `deleteObject${"s" | ""}` | `moveObject${"s" | ""}`
	| `duplicateObject${"s" | ""}` | `flip${"Objects" | "Map"}` | `rotate${"Objects" | "Map"}` | `configObject`
	| `crop` | `importBlueprint` | `replace` | `lineObjects` | `focusPushers`
}
type LockedCommand = Command & { isLocked: true }

export function initHistory(editorMap: EditorMap, buttons?: { undo?: HTMLElement[], redo?: HTMLElement[] }) {
	const commands = [] as Command[]

	const preset = {
		createObject: {
			add(data: MapObjectData, image?: Image) {
				const { placement, events } = editorMap
				return {
					command: m.add({
						type: "createObject",
						undo: () => {
							deleteObject(editorMap.getObjectByPos(data.x, data.y, o => o.item == data.item), false)
							placement.update()
								.then(() => placement.check(events.pointer.body))
							events.pointer.check()
						},
						redo: () => createObject(data, false, null, image).then(() => {
							placement.update()
								.then(() => placement.check(events.pointer.body))
							events.pointer.check()
						}),
						isLocked: true
					}),
					serialize() {
						return [serializeMapObjectData(data)] as const
					}
				}
			}, // @ts-ignore: it may randomly decide not to error.
			deserialize([mapObjectData]: ReturnType<ReturnType<typeof this["add"]>["serialize"]>): Parameters<typeof this["add"]> {
				return [deserializeMapObjectData(mapObjectData)]
			}
		},
		deleteObject: {
			add(createData: MapObjectData, x: number, y: number, item: Item) {
				const { placement, events } = editorMap
				return {
					command: m.add({
						type: "deleteObject",
						undo: () => createObject(createData, false).then(() => {
							placement.update()
								.then(() => placement.check(events.pointer.body))
							events.pointer.check()
						}),
						redo: () => {
							deleteObject(editorMap.getObjectByPos(x, y, o => o.item == item), false)
							placement.update()
								.then(() => placement.check(events.pointer.body))
							events.pointer.check()
						}
					}),
					serialize() {
						return [serializeMapObjectData(createData), x, y, item?.id] as const
					}
				}
			}, // @ts-ignore
			deserialize([createData, x, y, item]: ReturnType<ReturnType<typeof this["add"]>["serialize"]>): Parameters<typeof this["add"]> {
				return [deserializeMapObjectData(createData), x, y, Item.getById(item)]
			}
		},
		importBlueprint: {
			add(bpStr: string, placeInfo: [x: number, y: number, item: Item][]) {
				return {
					command: m.add({
						type: "importBlueprint",
						undo: () => {
							for (const info of placeInfo)
								deleteObject(editorMap.getObjectByPos(info[0], info[1], o => !o.bgTileType && o.item == info[2]), false)
							editorMap.events.pointer.check()
							editorMap.updateBpStr()
						},
						redo: () => importBlueprint(editorMap, null, bpStr, true)
					}),
					serialize() {
						return [bpStr, placeInfo.map(([x, y, item]) => [x, y, item?.id])] as const
					}
				}
			}, // @ts-ignore
			deserialize([bpStr, placeInfo]: ReturnType<ReturnType<typeof this["add"]>["serialize"]>): Parameters<typeof this["add"]> {
				return [bpStr, placeInfo.map(([x, y, item]) => [x, y, Item.getById(item)])]
			}
		},
		/* x: {
			add() {
				const { placement, events } = editorMap
				return {
					command: m.add({
						
					}),
					serialize() {
						return [] as const
					}
				}
			}, // @ts-expect-error
			deserialize([mapObjectData, x, y, itemId]: ReturnType<ReturnType<typeof this["add"]>["serialize"]>): Parameters<typeof this["add"]> {
				return []
			}
		}, */
	}

	const m = {
		commands,
		index: -1,

		add: <C extends Command>(command: C) => {
			// clear further commands if adding new command after undoing
			if (m.index != commands.length - 1)
				commands.splice(m.index + 1, commands.length - m.index)

			m.index = commands.push(command) - 1
			m.updateButtons()
			return command as unknown as (C extends { isLocked: true } ? LockedCommand : Command)
		},

		undo: async () => {
			const command = commands[m.index]
			if (!command || command.isLocked) return false

			command.isLocked = true
			await command.undo()
			--m.index
			m.updateButtons()
			delete command.isLocked
			return true
		},

		redo: async () => {
			const command = commands[m.index + 1]
			if (!command || command.isLocked) return false

			const currIndex = m.index
			command.isLocked = true
			await command.redo()
			if (m.index == currIndex) // redo may increment it by adding another command
				++m.index
			m.updateButtons()
			delete command.isLocked
			return true
		},

		clear: () => (m.index = -1, commands.length = 0, m.updateButtons()),

		updateButtons: () => {
			if (!buttons) return
			const du = m.index == -1, dr = m.index == commands.length - 1
			buttons.undo?.forEach(el => el.classList.toggle("disabled", du))
			buttons.redo?.forEach(el => el.classList.toggle("disabled", dr))
		},

		addPreset: <K extends keyof typeof preset>(key: K, ...args: Parameters<typeof preset[K]["add"]>) => {
			/* if (args[args.length - 1] == null)
				args.pop() */
			// editorMap.emit("historyadd", key, serialized)
			// @ts-expect-error: .
			return preset[key].add(...args).command
		},
		preset
	}

	window.addEventListener("keydown", e => {
		if (document.activeElement != document.body && !(winMan.findReplace.win.isOpen && winMan.findReplace.win.contains(document.activeElement)))
			return
		const Z = e.code == "KeyZ",
			Y = e.code == "KeyY"
		if ((e.ctrlKey || e.metaKey) && (Z || Y)) {
			if (editorMap.configs.menu?.dialog.querySelector("*:focus, dt-item-slot.open"))
				return
			e.preventDefault() // prevents unredoing non-focused elements
			if (e.shiftKey && Z || Y) m.redo()
			else m.undo()
		}
	})

	buttons?.undo?.forEach(el => el.addEventListener("click", () => !el.classList.contains("disabled") && m.undo()))
	buttons?.redo?.forEach(el => el.addEventListener("click", () => !el.classList.contains("disabled") && m.redo()))
	m.updateButtons()
	return m
}
