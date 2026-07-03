import { ConfigCmd, ConfigCmdOptions, Enum, Item, Shape } from "dsabp-js"
import { EventEmitter } from "pixi.js"
import { EditorMap } from "../../EditorMap.js"
import { MapObject } from "../../MapObject.js"
import { Dialog, DialogOptions } from "/Dialog.js"
import { elByCls, switchTriStateCb, triggerCustom } from "/main.js"

const cbCond = document.createElement("input")
cbCond.type = "checkbox"
cbCond.className = "cond-only tricb cb-cond"
cbCond.title = "State: Ignore"

export type TriState = boolean | null

export interface InputObject {
	/** Use if this input is about a config property of a nested config object. */
	cfgPath?: CfgPath,
	/**
	 * Use if the key of this input object or {@link class} is not the key of the config value to manage,
	 * and refer to the config value manually in the handleInput callback, not using its 'key' param.
	 */
	cfgKeys?: (keyof NestedCfgObject)[]
	/** Should equal to the key of the config value to manage, or use {@link cfgKeys}. */
	class: string,
	element: HTMLElement
}

export type ConfigConds = Record<string, { cond?: TriState, input: Omit<Partial<InputObject>, "element"> }>

// LoaderConfig | PusherConfig
type GetNestedCfgObjects<T, R extends "keys" | void = void> = {
	[K in keyof T]: T[K] extends object ? (T[K] extends Enum<any> | { length: number } ? never : (R extends "keys" ? K : T[K])) : never
}[keyof T]

// LoaderConfig & PusherConfig
type Intersect<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never

type NestedCfgObject = Intersect<GetNestedCfgObjects<ConfigCmdOptions>>

export type CfgPath = GetNestedCfgObjects<ConfigCmdOptions, "keys"> | GetNestedCfgObjects<ConfigCmdOptions, "keys">[]

export type HandleInputs<Inputs extends Record<string, InputObject>> =
	<K extends (keyof Inputs)[]>(
		...args: { [I in keyof K]: [key: K[I], fn: (k: K[I], element: Inputs[K[I]]["element"], getCfg: () => ConfigCmdOptions & NestedCfgObject, update: (history?: boolean) => Promise<boolean>) => void] }
	) => void

export interface OtherItemConds {
	ejectorHull?: TriState
}

export type AllConds = { item?: Map<Item, { config?: ConfigConds, other?: OtherItemConds }>, shape?: boolean } // & Conds

export abstract class ConfigMenu extends EventEmitter<{ "configchange": (end?: boolean) => void, "condchange": (causedByConfigChange?: boolean) => void }> {
	dialog: Dialog
	editorMap: EditorMap
	item: Item
	declare mapObject?: MapObject
	/* If isn't bound to a MapObject */
	declare sourceObject?: { config?: ConfigCmd, shape?: Shape }
	declare conditions?: AllConds

	declare inputs?: Record<string, InputObject>

	constructor(editorMap: EditorMap) {
		super()
		this.editorMap = editorMap
	}

	init(body: DialogOptions["body"]) {
		this.dialog = new Dialog({
			className: "config",
			draggable: { key: "config" },
			defaultPos: { left: "5%", top: "15%" },
			body,
			footer: {
				html: /*html*/`
<button class="button-remove-config">Remove Config</button>
<button class="button-paste">Paste</button><button class="button-copy">Copy</button>`,
				closeButton: { html: "OK", right: true }
			},
		})

		for (const p of this.dialog.elBody.querySelectorAll(":scope>p:not(.not-config)"))
			p.insertAdjacentElement("afterbegin", cbCond.cloneNode() as HTMLElement)

		this.dialog.elBody.addEventListener("click", e => {
			const target = e.target as HTMLElement
			if (!target) return

			if (this.conditions && target.classList.contains("tricb") && target instanceof HTMLInputElement) {
				const state = switchTriStateCb(target)
				triggerCustom(target, "c-change", { detail: { state } })

				const p = target.closest(".body>p:not(.not-config)")
				if (p) for (const inputKey in this.inputs) {
					const input = this.inputs[inputKey],
						{ class: cls, element, cfgPath, cfgKeys } = input
					if (elByCls(p, cls) == element) {
						this.getConfigConds()[inputKey] = { cond: state, input: { class: cls, cfgPath: cfgPath, cfgKeys } }

						if (state == true)
							resolveCfgPath(this.config, input, null, { valueOnlyIfUndefined: () => resolveCfgPath(ConfigCmd.defaults, input) })

						this.emit("condchange")
						break
					}
				}
			}
		});

		(elByCls<HTMLButtonElement>(this.dialog.elFooter, "button-copy"))
			.addEventListener("click", () => {
				this.editorMap.configs.copy(this.mapObject)
				this.dialog.close()
			});

		(elByCls<HTMLButtonElement>(this.dialog.elFooter, "button-paste"))
			.addEventListener("click", async () =>
				this.editorMap.configs.paste(this.mapObject)
					.then(res => res && this.emit("configchange"))
			)
	}

	fill() {
		if (this.conditions)
			for (const inputKey in this.inputs) {
				const cond = this.getConfigConds(true)?.[inputKey]?.cond
				switchTriStateCb(
					(this.inputs[inputKey] as InputObject).element
						.closest(".body>p:not(.not-config)")
						.getElementsByClassName("cb-cond")[0] as HTMLInputElement,
					cond === undefined ? "clear" : cond
				)
			}
	}

	tryUpdate(history = true) {
		return this.editorMap.configs.tryUpdate(this.mapObject, history)
	}

	get config() {
		if (this.sourceObject)
			return this.sourceObject.config

		if (this.mapObject)
			return this.mapObject.config

		let cfg = this.editorMap.configs.getClipboardCfg(this.item)
		if (!cfg)
			this.editorMap.configs.clipboardConfig.set(this.item == Item.ITEM_HATCH_STARTER ? Item.ITEM_HATCH : this.item, cfg = new ConfigCmd())
		return cfg
	}

	/** Helper method. Includes caching the html element. */
	handleInputs(...args: [string, (k: string, element: HTMLElement, getCfg: () => ConfigCmdOptions & NestedCfgObject, update: (history?: boolean) => Promise<boolean>) => void][]) {
		for (const [inputKey, fn] of args) {
			const input = this.inputs[inputKey]

			fn(
				inputKey,
				input.element = elByCls(this.dialog, input.class),

				() => resolveCfgPath(this.config, input, true) as ConfigCmdOptions & NestedCfgObject,

				(history?: boolean) => {
					// handle conditional checkboxes
					if (this.conditions) {
						const cb = input.element.closest(".body>p:not(.not-config)")?.querySelector<HTMLInputElement>("input.cb-cond")
						if (cb?.dataset.state == undefined) {
							this.getConfigConds()[inputKey] = { cond: switchTriStateCb(cb, true), input: { class: input.class, cfgPath: input.cfgPath, cfgKeys: input.cfgKeys } }
							this.emit("condchange", true)
						}
					}

					this.emit("configchange", history != false)
					return this.tryUpdate(history)
				}
			)
		}
	}

	#getItemConds(noSet?: boolean) {
		if (!noSet)
			this.conditions.item ??= new Map()

		const item = this.item == Item.ITEM_HATCH_STARTER ? Item.ITEM_HATCH : this.item
		let itemConds = this.conditions.item?.get(item)
		if (!noSet && !itemConds)
			this.conditions.item.set(item, itemConds = {})
		return itemConds
	}

	getConfigConds(noSet?: boolean) {
		const itemConds = this.#getItemConds(noSet)
		if (!noSet && !itemConds.config)
			itemConds.config = {}
		return itemConds?.config
	}

	getOtherCond<K extends keyof OtherItemConds>(key: K): OtherItemConds[K] {
		return (this.#getItemConds().other ??= {})[key]
	}

	setOtherCond<K extends keyof OtherItemConds>(key: K, value: OtherItemConds[K]) {
		(this.#getItemConds().other ??= {})[key] = value
		this.emit("condchange")
	}
}

type CfgValue = ConfigCmd | ConfigCmd[keyof ConfigCmdOptions] | NestedCfgObject[keyof NestedCfgObject]

export function resolveCfgPath(cmd: Partial<ConfigCmd>, input: Omit<Partial<InputObject>, "element">, returnObject?: boolean): CfgValue
export function resolveCfgPath(cmd: Partial<ConfigCmd>, input: Omit<Partial<InputObject>, "element">, returnObject: boolean, set: { value?: CfgValue, valueOnlyIfUndefined?: () => CfgValue }): boolean
export function resolveCfgPath(cmd: Partial<ConfigCmd>, input: Omit<Partial<InputObject>, "element">, returnObject?: boolean, set?: { value?: CfgValue, valueOnlyIfUndefined?: () => CfgValue }): CfgValue | boolean {
	const cfgKey = input.cfgKeys ?? input.class
	const path = input.cfgPath

	const obj = path ? (
		Array.isArray(path)
			? path.reduce((obj, key) => obj[key] as NestedCfgObject, cmd)
			: cmd[path] as NestedCfgObject
	) : cmd

	if (set) {
		let anyChange: boolean
		if (cfgKey) {
			if (Array.isArray(cfgKey)) {
				if (set.valueOnlyIfUndefined) {
					const val = set.valueOnlyIfUndefined()
					for (const key of cfgKey) {
						if (obj[key] == undefined) {
							obj[key] = val[key]
							anyChange ??= obj[key] != undefined
						}
					}
				} else {
					for (const key of cfgKey) {
						const old = obj[key]
						obj[key] = set.value[key]
						if (obj[key] !== old)
							anyChange ??= true
					}
				}
			} else {
				const old = obj[cfgKey]
				if (set.valueOnlyIfUndefined)
					obj[cfgKey] ??= set.valueOnlyIfUndefined()
				else
					obj[cfgKey] = set.value
				if (obj[cfgKey] !== old)
					anyChange ??= true
			}
		} else
			throw "cfgKey is null"
		return anyChange ?? false
	}

	return cfgKey && !returnObject ? (Array.isArray(cfgKey) ? (
		!Object.keys(obj).length ? undefined // obj is empty e.g. cmd.loader
			: cfgKey.reduce((o, key) => (o[key] = obj[key], o), {}) as NestedCfgObject
	) : obj[cfgKey]) : obj
}
