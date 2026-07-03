import { ConfigCmd, Item, Shape } from "dsabp-js"
import { updateObject } from "../actions/updateObject.js"
import { EditorMap } from "../EditorMap.js"
import { MapObject } from "../MapObject.js"
import { AllConds, ConfigMenu, resolveCfgPath } from "../ui/config-menu/ConfigMenu.js"
import { EjectorConfigMenu } from "../ui/config-menu/EjectorConfigMenu.js"
import { ExpandoBoxConfigMenu } from "../ui/config-menu/ExpandoBoxConfigMenu.js"
import { HatchConfigMenu } from "../ui/config-menu/HatchConfigMenu.js"
import { LoaderConfigMenu } from "../ui/config-menu/LoaderConfigMenu.js"
import { PusherConfigMenu } from "../ui/config-menu/PusherConfigMenu.js"
import { ShieldGeneratorConfigMenu } from "../ui/config-menu/ShieldGeneratorConfigMenu.js"
import * as shapePicker from "../ui/shapePicker.js"
import { deepEquals, getUnpackagedName } from "../util.js"
import { shakeElement, switchTriStateCb } from "/main.js"

const canvasContainer = document.getElementById("canvas-container")

const KEY_CONFIG = "KeyR"
const KEY_COPY = "KeyC"
const KEY_PASTE = "KeyV"

export function initConfigs(editorMap: EditorMap) {
	const { info, events, highlight, placement } = editorMap

	const menus = {
		[Item.LOADER_NEW.id]: new LoaderConfigMenu(editorMap),
		[Item.EXPANDO_BOX.id]: new ExpandoBoxConfigMenu(editorMap),
		[Item.SHIELD_GENERATOR.id]: new ShieldGeneratorConfigMenu(editorMap),
		[Item.PUSHER.id]: new PusherConfigMenu(editorMap),
		[Item.ITEM_HATCH.id]: new HatchConfigMenu(editorMap),
		[Item.ITEM_EJECTOR.id]: new EjectorConfigMenu(editorMap),
		[Item.DOOR.id]: new ShieldGeneratorConfigMenu(editorMap),
		[Item.ITEM_LAUNCHER.id]: new ExpandoBoxConfigMenu(editorMap),
		[Item.RCD_FLUX.id]: new ExpandoBoxConfigMenu(editorMap),
	} as Record<string, ConfigMenu>
	menus[Item.ITEM_HATCH_STARTER.id] = menus[Item.ITEM_HATCH.id]
	menus[Item.RCD_SANDBOX.id] = menus[Item.RCD_FLUX.id]

	function getMenuFor(item: Item) {
		return menus[item.id]
	}

	function isShaped(o: MapObject | Item) {
		return (o instanceof MapObject ? o.item : o).buildInfo?.[0].block_shaped
	}

	function isConfigured(o: MapObject | Item) {
		return Object.hasOwn(menus, (o instanceof MapObject ? o.item : o).id)
	}

	function getDefaultConfig(item: Item): ConfigCmd {
		const { angle, filterItems, filterMode, fixedAngle, loader, pusher } = ConfigCmd.defaults
		switch (item) {
			case Item.LOADER_NEW:
				return new ConfigCmd({ loader, filterMode, filterItems })
			case Item.EXPANDO_BOX:
				return new ConfigCmd({ angle })
			case Item.SHIELD_GENERATOR:
				return new ConfigCmd({ fixedAngle })
			case Item.PUSHER:
				return new ConfigCmd({ pusher, filterItems })
			case Item.ITEM_HATCH:
			case Item.ITEM_HATCH_STARTER:
				return new ConfigCmd({ filterMode, filterItems })
			case Item.ITEM_EJECTOR:
				return new ConfigCmd({ fixedAngle })
			case Item.DOOR:
				return new ConfigCmd({ fixedAngle })
			case Item.ITEM_LAUNCHER:
				return new ConfigCmd({ fixedAngle })
			case Item.RCD_FLUX:
			case Item.RCD_SANDBOX:
				return new ConfigCmd({ angle })
		}
	}

	const handler = {
		menu: null as ReturnType<typeof getMenuFor>,
		isShapePickerOpen: false,
		shapePickerMapObject: null as MapObject,
		clipboardConfig: (() => {
			return new Map<Item, Partial<ConfigCmd>>([
				[Item.LOADER_NEW, getDefaultConfig(Item.LOADER_NEW)],
				[Item.EXPANDO_BOX, getDefaultConfig(Item.EXPANDO_BOX)],
				[Item.SHIELD_GENERATOR, getDefaultConfig(Item.SHIELD_GENERATOR)],
				[Item.PUSHER, getDefaultConfig(Item.PUSHER)],
				[Item.ITEM_HATCH, getDefaultConfig(Item.ITEM_HATCH)],
				// [Item.ITEM_HATCH_STARTER, getDefaultConfig(Item.ITEM_HATCH_STARTER)],
				[Item.ITEM_EJECTOR, getDefaultConfig(Item.ITEM_EJECTOR)],
				[Item.DOOR, getDefaultConfig(Item.DOOR)],
				[Item.ITEM_LAUNCHER, getDefaultConfig(Item.ITEM_LAUNCHER)],
				[Item.RCD_FLUX, getDefaultConfig(Item.RCD_FLUX)],
				// [Item.RCD_SANDBOX, getDefaultConfig(Item.RCD_SANDBOX)],
			])
		})(),
		clipboardShape: Shape.BLOCK,
		clipboardConditions: null as AllConds,
		sourceObject: null as { config?: ConfigCmd, shape?: Shape },
		/** Used for history. */
		lastObjectConfig: null as ConfigCmd,
		/** Used for history. */
		lastObjectShape: null as Shape,

		/** @returns The dialog if open. */
		openFor: (item: Item, { mapObject, sourceObject, conditions, addClassToDialog }: { mapObject?: MapObject, sourceObject?: { config?: ConfigCmd, shape?: Shape }, conditions?: AllConds, addClassToDialog?: string } = {}) => {
			if (handler.isShaped(item))
				return handler.openForTile({ mapObject, sourceObject, conditions, addClassToDialog }), shapePicker.dialog

			const menu = getMenuFor(item)
			if (!menu) return

			if (handler.menu)
				handler.menu.dialog.close()
			handler.menu = menu
			if (addClassToDialog)
				menu.dialog.classList.add(addClassToDialog)

			handler.lastObjectConfig = mapObject?.config.clone()

			menu.item = item
			menu.mapObject = mapObject

			if (sourceObject)
				sourceObject.config ??= getDefaultConfig(item)
			menu.sourceObject = handler.sourceObject = sourceObject

			if (conditions) {
				menu.conditions = conditions
				menu.dialog.dataset.conditional = ""
			} else
				delete menu.dialog.dataset.conditional
			menu.dialog.elTitle.textContent = `Config: ${getUnpackagedName(item)}${sourceObject ? "" : ` (${mapObject ? "Editing" : "Clipboard"})`}`
			menu.dialog.classList.toggle("clipboard", !mapObject && !sourceObject)

			menu.dialog.open()
			if (mapObject)
				highlight.showFor("focus", mapObject)

			menu.fill()

			// setTimeout(() => menu.dialog.focus({ preventScroll: true }))

			const onDestroy = () => {
				menu.dialog.close()
				menu.dialog.removeEventListener("close", onClose)
			}
			const onClose = () => {
				highlight.hide("focus")
				handler.menu = null
				mapObject?.off("destroy", onDestroy)
			}
			mapObject?.once("destroy", onDestroy)
			menu.dialog.addEventListener("close", onClose, { once: true })

			return menu.dialog
		},

		openForTile: ({ mapObject, sourceObject, conditions, addClassToDialog }: { mapObject?: MapObject, sourceObject?: { config?: ConfigCmd, shape?: Shape }, conditions?: AllConds, addClassToDialog?: string } = {}) => {
			handler.isShapePickerOpen = true
			handler.lastObjectShape = mapObject?.shape
			if (addClassToDialog)
				shapePicker.dialog.classList.add(addClassToDialog)

			if (mapObject) {
				handler.shapePickerMapObject = mapObject
				highlight.showFor("focus2", mapObject)
			}

			if (sourceObject)
				sourceObject.shape ??= Shape.BLOCK
			handler.sourceObject = sourceObject

			if (conditions) {
				shapePicker.dialog.dataset.conditional = ""
				const lstnr = state => conditions.shape = state
				shapePicker.events.on("condchange", lstnr)
				shapePicker.dialog.addEventListener("close", () => shapePicker.events.off("condchange", lstnr), { once: true })
			} else
				delete shapePicker.dialog.dataset.conditional

			const onDestroy = () => shapePicker.close()
			const onClose = () => {
				highlight.hide("focus")
				handler.menu = null
				mapObject?.off("destroy", onDestroy)
			}
			mapObject?.once("destroy", onDestroy)

			shapePicker.open(
				mapObject?.shape ?? (sourceObject?.shape ?? handler.clipboardShape),
				conditions?.shape ?? true,
				mapObject,
				!sourceObject,
				async shape => {
					onClose()
					if (!shape) { // closed
						highlight.hide("focus2")
						handler.shapePickerMapObject = null
						return handler.isShapePickerOpen = false
					} // selected
					if (sourceObject) {
						sourceObject.shape = shape
					} else if (mapObject) {
						const prev = mapObject.shape
						mapObject.shape = shape
						if (!(await handler.tryUpdate(mapObject)) && prev != null)
							shapePicker.highlight(mapObject.shape = prev)
					} else {
						handler.clipboardShape = shape
						handler.clipboardUpdated()
					}
				},
				copiedShape => {
					if (conditions)
						(handler.clipboardConditions ??= {}).shape = conditions.shape

					handler.clipboardShape = copiedShape
					handler.clipboardUpdated()
					shapePicker.close()
				},
				() => {
					handler.paste(mapObject).then(result =>
						result && (
							shapePicker.highlight(handler.clipboardShape),
							shapePicker.events.emit("shapechange", handler.clipboardShape)
						)
					)

					if (handler.clipboardConditions)
						shapePicker.cbCond.checked = conditions.shape = handler.clipboardConditions.shape
				}
			)
			// setTimeout(() => shapePicker.dialog.focus({ preventScroll: true }))
		},

		tryUpdate: async (obj?: MapObject, history = true) => {
			if (!obj)
				return handler.clipboardUpdated(), true

			const success = await updateObject(obj, { checkValidity: true, keepBpStr: !history })
			if (success) {
				handler.clipboardUpdated(true)
				if (handler.menu?.mapObject == obj)
					highlight.showFor("focus", obj)
				if (history)
					handleHistory(obj)
			} else
				shakeElement(canvasContainer)
			return success
		},

		getClipboardCfg: (item: Item) => {
			return handler.clipboardConfig.get(noStarterHatch(item))
		},

		copy: (mapObj?: MapObject, updatePreview = true) => {
			if (mapObj) {
				if (!isShaped(mapObj) && !isConfigured(mapObj))
					return

				if (mapObj.item.isBlock)
					handler.clipboardShape = mapObj.shape ?? Shape.BLOCK
				else
					Object.assign(handler.getClipboardCfg(mapObj.item), mapObj.config?.clone())
				handler.clipboardConditions = null
				showClipboardEffect(mapObj)
			} else {
				if (handler.sourceObject.shape)
					handler.clipboardShape = handler.sourceObject.shape
				if (handler.sourceObject.config)
					Object.assign(handler.getClipboardCfg(handler.menu.item), handler.sourceObject.config.clone())
				if (handler.menu.conditions?.item)
					(handler.clipboardConditions ??= { item: new Map() }).item.set(handler.menu.item, structuredClone(handler.menu.conditions.item.get(handler.menu.item)))
			}
			handler.clipboardUpdated(updatePreview)
			handler.menu?.fill()
		},

		paste: async (mapObj?: MapObject) => {
			if (mapObj) {
				if (!isShaped(mapObj) && !isConfigured(mapObj))
					return

				const isBlock = mapObj.item.isBlock
				if (isBlock && handler.clipboardShape == null)
					return

				const cfg = handler.getClipboardCfg(mapObj.item)
				if (!isBlock && cfg == null)
					return

				const prevConfig = handler.lastObjectConfig = isBlock ? null : mapObj.config?.clone()
				const prevShape = handler.lastObjectShape = isBlock ? mapObj.shape : null

				if (isBlock)
					mapObj.shape = handler.clipboardShape
				else
					Object.assign(mapObj.config, cfg.clone())

				if (!(await handler.tryUpdate(mapObj))) {
					if (prevConfig)
						Object.assign(mapObj.config, prevConfig)
					if (prevShape)
						mapObj.shape = prevShape
					return false
				}

				if (handler.menu?.mapObject == mapObj)
					handler.menu.fill()
				showClipboardEffect(mapObj)
			} else {
				if (handler.isShapePickerOpen)
					handler.sourceObject.shape = handler.clipboardShape

				if (handler.menu) {
					Object.assign(handler.sourceObject.config ??= new ConfigCmd(), handler.getClipboardCfg(handler.menu.item).clone())

					if (handler.clipboardConditions) {
						handler.menu.conditions.item = new Map()
						if (handler.clipboardConditions.item)
							for (const [k, v] of handler.clipboardConditions.item)
								handler.menu.conditions.item.set(k, structuredClone(v))

						handler.menu.conditions.shape = handler.clipboardConditions.shape
					} else if (handler.menu.conditions) {
						delete handler.menu.conditions.item
						delete handler.menu.conditions.shape

						for (const inputKey in handler.menu.inputs) {
							const input = handler.menu.inputs[inputKey],
								{ class: cls, element, cfgPath, cfgKeys } = input

							if (!deepEquals(
								resolveCfgPath(handler.sourceObject.config, input),
								resolveCfgPath(ConfigCmd.defaults, input)
							)) {
								const cb = element.closest(".body>p:not(.not-config)")?.querySelector<HTMLInputElement>("input.cb-cond")
								const state = switchTriStateCb(cb, true)
								if (cb.dataset.state == undefined || cb.dataset.state == String(state))
									handler.menu.getConfigConds()[inputKey] = { cond: state, input: { class: cls, cfgPath, cfgKeys } }
							}
						}
					}
				}

				handler.menu?.fill()
			}
			return true
		},

		clipboardUpdated: (updatePreview = true) => {
			if (updatePreview)
				placement.update().then(() => placement.check(events.pointer.body))
		},

		close: () => handler.menu ? handler.menu.dialog.close() : handler.isShapePickerOpen && shapePicker.close(),
		isShaped,
		isConfigured,
		getDefaultConfig
	}

	function showClipboardEffect(obj: MapObject) {
		highlight.showFor("clipboard", obj)
		setTimeout(() => highlight.hide("clipboard"), 250)
	}

	const buttonConfig = document.getElementById("button-item-config")
	buttonConfig.addEventListener("click", () => {
		if (handler.isShapePickerOpen) {
			handler.shapePickerMapObject = null
			shapePicker.close()
			return handler.isShapePickerOpen = false
		}

		if (handler.menu && !handler.menu.mapObject) {
			const end = handler.menu.item == info.selectedItem
			handler.close()
			if (end) return
		}

		if (info.selectedItem)
			handler.openFor(info.selectedItem)
	})

	window.addEventListener("keydown", e => {
		if (document.activeElement != document.body)
			return
		if (e.code == KEY_CONFIG && !e.shiftKey
			&& !handler.menu && !handler.isShapePickerOpen
		) {
			buttonConfig.click()
		} else if ((e.ctrlKey || e.metaKey) && (e.code == KEY_COPY || e.code == KEY_PASTE)
			&& events.pointer.target && !events.pointer.target.mapObject?.bgTileType
		) {
			const mapObj = events.pointer.target.mapObject
			if (e.code == KEY_COPY) handler.copy(mapObj)
			else handler.paste(mapObj)
		}
	})

	window.addEventListener("keyup", e => {
		if (e.code == KEY_CONFIG && (handler.isShapePickerOpen || handler.menu)) {
			if (!handler.menu?.dialog.elBody.querySelector("*:focus, dt-item-slot.open"))
				handler.close()
		}
	})

	interface HistoryData {
		undoShape?: Shape
		redoShape?: Shape
		x: number
		y: number
		item: Item
		configDiff?: ConfigDiff
	}
	async function undoredo(isUndo: boolean, hist: HistoryData) {
		const obj = editorMap.getObjectByPos(hist.x, hist.y, o => o.item == hist.item)
		if (!obj) return // ignore invalid

		if (hist.configDiff?.length)
			for (const { path, prev, curr } of hist.configDiff)
				pathToObject(obj.config, path, (isUndo ? prev : curr) ?? pathToObject(ConfigCmd.defaults, path))

		const s = isUndo ? hist.undoShape : hist.redoShape
		if (s) obj.shape = s

		await updateObject(obj)

		if (handler.menu?.mapObject == obj) {
			handler.menu.fill()
			highlight.showFor("focus", obj)
		}
		if (isConfigured(obj))
			handler.lastObjectConfig = obj.config.clone()
		if (isShaped(obj))
			handler.lastObjectShape = obj.shape
	}
	function handleHistory(obj: MapObject) {
		const isShapeDifferent = isShaped(obj) && obj.shape != handler.lastObjectShape
		const configDiff = !isShapeDifferent && isConfigured(obj) && getConfigDiff(handler.lastObjectConfig ?? {}, obj.config)
		if (isShapeDifferent || configDiff.length) {
			const hist: HistoryData = { x: obj.x, y: obj.y, item: obj.item }
			if (configDiff.length)
				hist.configDiff = configDiff
			if (isShapeDifferent) {
				hist.undoShape = handler.lastObjectShape ?? Shape.BLOCK
				hist.redoShape = obj.shape
			}
			editorMap.history.add({
				type: "configObject",
				undo: () => undoredo(true, hist),
				redo: () => undoredo(false, hist)
			})
			if (isConfigured(obj))
				handler.lastObjectConfig = obj.config.clone()
			if (isShaped(obj))
				handler.lastObjectShape = obj.shape
		}
	}

	return handler
}

export type ConfigDiff = { path: string, prev: unknown, curr: unknown }[]
export function getConfigDiff(prev: object, curr: object, parentPath = ""): ConfigDiff {
	let out = []
	for (const key in curr) {
		const path = parentPath ? `${parentPath}.${key}` : key
		if (
			prev[key] && curr[key]
			&& (
				(Object.getPrototypeOf(prev[key]) == Object.prototype && Object.getPrototypeOf(curr[key]) == Object.prototype)
				|| (Array.isArray(prev[key]) && Array.isArray(curr[key]))
			)
		)
			out = out.concat(getConfigDiff(prev[key], curr[key], path))
		else if (prev[key] !== curr[key])
			out.push({ path, prev: prev[key], curr: curr[key] })
	}
	return out
}

export function pathToObject(obj: object, path: string, setValue?: unknown): unknown {
	const keys = path.split(".")
	while (keys.length > 1 && obj[keys[0]])
		obj = obj[keys.shift()]
	if (setValue != null)
		obj[keys[0]] = setValue
	return obj[keys[0]]
}

export function noStarterHatch(item: Item) {
	return item == Item.ITEM_HATCH_STARTER ? Item.ITEM_HATCH : (item == Item.RCD_SANDBOX ? Item.RCD_FLUX : item)
}
