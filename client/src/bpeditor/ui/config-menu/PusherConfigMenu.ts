import { ConfigCmd, Item } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { addBetterInputEvent, handleNumberInput } from "../../util.js"
import { AngleInput } from "../AngleInput.js"
import { MultiItemInput } from "../MultiItemInput.js"
import { PusherModeInput } from "../PusherModeInput.js"
import { CfgPath, ConfigMenu, HandleInputs } from "./ConfigMenu.js"
import { addTooltip } from "/main.js"

const defaults = ConfigCmd.defaults

export class PusherConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
		angle: {
			cfgPath: "pusher" as CfgPath,
			class: "angle",
			element: null as AngleInput
		},
		maxBeamLength: {
			cfgPath: "pusher" as CfgPath,
			class: "maxBeamLength",
			element: null as HTMLInputElement
		},
		targetSpeed: {
			cfgPath: "pusher" as CfgPath,
			class: "targetSpeed",
			element: null as HTMLInputElement
		},
		defaultMode: {
			cfgPath: "pusher" as CfgPath,
			class: "defaultMode",
			element: null as PusherModeInput
		},
		filteredMode: {
			cfgPath: "pusher" as CfgPath,
			class: "filteredMode",
			element: null as PusherModeInput
		},
		filterByInventory: {
			cfgPath: "pusher" as CfgPath,
			class: "filterByInventory",
			element: null as HTMLInputElement
		},
		filterItems: {
			class: "filterItems",
			element: null as MultiItemInput
		}
	}

	constructor(editorMap: EditorMap) {
		super(editorMap)
		const inputs = this.inputs
		this.init(/*html*/`
<p>
	Angle:
	<dt-angle-input class="${inputs.angle.class}" style="position: relative;">
		<span class="tooltip-ref" data-clone style="position: absolute; left: calc(90px + 0.4em);">
			<span class="help-circle"></span>
			<span class="tooltip-content">
				Drag the middle square to easily rotate it in the desired direction. Click an outer square to select a preset angle.
			</span>
		</span>
	</dt-angle-input>
</p>
<p>
	Max. Beam Length:
	<input type="number" class="${inputs.maxBeamLength.class}" min="0" max="1000">
</p>
<p>
	Target Speed:
	<input type="number" class="${inputs.targetSpeed.class}" min="0" max="20">
</p>
<p>
	Default Mode:
	<dt-pusher-mode-input name="default-mode" class="${inputs.defaultMode.class}"></dt-pusher-mode-input>
</p>
<p>
	Filtered Mode:
	<dt-pusher-mode-input name="filtered-mode" class="${inputs.filteredMode.class}"></dt-pusher-mode-input>
	<span class="tooltip-ref" data-clone style="margin-left: 0.2em;">
		<span class="help-circle"></span>
		<span class="tooltip-content">
			This mode will activate when the beam hits an object that meets the filter.
		</span>
	</span>
</p>
<p>
	Filter by Inventory:
	<input type="checkbox" class="${inputs.filterByInventory.class}">
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			If enabled, the beam will <i>also</i> check the inventory of the hit object to see if it meets the filter criteria. This works for players, expando boxes, and loaders.
		</span>
	</span>
</p>
<p>
	<span>Item Filters:</span>
	<dt-multi-item-input class="${inputs.filterItems.class}"></dt-multi-item-input>
</p>`)
		for (const el of this.dialog.getElementsByClassName("tooltip-ref"))
			addTooltip(el)

		let angleInputTimer: number

		this.handleInputs([
			"angle", (key, element, getCfg, update) => {
				element.addEventListener("c-angle-input", (e: CustomEvent) => {
					clearTimeout(angleInputTimer)
					angleInputTimer = setTimeout(() => {
						getCfg()[key] = element.value
						update(e.detail.end)
					})
				})
			}
		], [
			"maxBeamLength", (key, element, getCfg, update) => {
				addBetterInputEvent(element)
				element.addEventListener("c-input", (e: CustomEvent) => {
					const num = handleNumberInput(element)
					if (num == null) return
					getCfg()[key] = num
					update(e.detail.end)
				})
			}
		], [
			"targetSpeed", (key, element, getCfg, update) => {
				addBetterInputEvent(element)
				element.addEventListener("c-input", (e: CustomEvent) => {
					const num = handleNumberInput(element)
					if (num == null) return
					getCfg()[key] = num
					update(e.detail.end)
				})
			}
		], [
			"defaultMode", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.value
					update()
				})
		], [
			"filteredMode", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.value
					update()
				})
		], [
			"filterByInventory", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.checked
					update()
				})
		], [
			"filterItems", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = [
						element.itemSlots[0].item ?? Item.NULL,
						element.itemSlots[1].item ?? Item.NULL,
						element.itemSlots[2].item ?? Item.NULL
					]
					update()
				})
		])
	}

	fill() {
		super.fill()

		const { inputs, config } = this
		inputs.angle.element.value = config.pusher?.angle ?? defaults.pusher.angle

		inputs.maxBeamLength.element.value = (config.pusher?.maxBeamLength ?? defaults.pusher.maxBeamLength).toString()

		inputs.targetSpeed.element.value = (config.pusher?.targetSpeed ?? defaults.pusher.targetSpeed).toString()

		inputs.defaultMode.element.value = config.pusher?.defaultMode ?? defaults.pusher.defaultMode

		inputs.filteredMode.element.value = config.pusher?.filteredMode ?? defaults.pusher.filteredMode

		inputs.filterByInventory.element.checked = (config.pusher?.filterByInventory ?? defaults.pusher.filterByInventory)

		for (const [i, item] of (config.filterItems ?? defaults.filterItems).entries())
			inputs.filterItems.element.itemSlots[i].setItem(item)
	}
}
