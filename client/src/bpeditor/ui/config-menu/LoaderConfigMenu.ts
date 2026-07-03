import { ConfigCmd, Item } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { addBetterInputEvent, handleNumberInput } from "../../util.js"
import { FilterModeInput } from "../FilterModeInput.js"
import { LoaderPointsInput } from "../LoaderPointsInput.js"
import { LoaderPriorityInput } from "../LoaderPriorityInput.js"
import { MultiItemInput } from "../MultiItemInput.js"
import { CfgPath, ConfigMenu, HandleInputs, InputObject } from "./ConfigMenu.js"
import { addTooltip } from "/main.js"

const defaults = ConfigCmd.defaults

export class LoaderConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
		points: {
			cfgPath: "loader" as CfgPath,
			cfgKeys: ["pickupPoint", "dropPoint"] as InputObject["cfgKeys"],
			class: "points",
			element: null as LoaderPointsInput
		},
		requireOutputInventory: {
			cfgPath: "loader" as CfgPath,
			class: "requireOutputInventory",
			element: null as HTMLInputElement
		},
		priority: {
			cfgPath: "loader" as CfgPath,
			class: "priority",
			element: null as LoaderPriorityInput
		},
		cycleTime: {
			cfgPath: "loader" as CfgPath,
			class: "cycleTime",
			element: null as HTMLInputElement
		},
		stackLimit: {
			cfgPath: "loader" as CfgPath,
			class: "stackLimit",
			element: null as HTMLInputElement
		},
		waitForStackLimit: {
			cfgPath: "loader" as CfgPath,
			class: "waitForStackLimit",
			element: null as HTMLInputElement
		},
		filterMode: {
			class: "filterMode",
			element: null as FilterModeInput
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
	<span style="text-align: right; display: inline-block; vertical-align: middle;">Grab and Drop<br>Squares:</span>
	<span>
		<dt-loader-points-input class="${inputs.points.class}"></dt-loader-points-input>
		<span class="tooltip-ref" data-clone>
			<span class="help-circle"></span>
			<span class="tooltip-content">
				Click a square to set the loader to grab from there and drop in the one opposite it.
				<br><br>Click & drag from one square to another to define a non-straight path.
			</span>
		</span>
	</span>
</p>
<p>
	Require Output Inventory:
	<input type="checkbox" class="${inputs.requireOutputInventory.class}">
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			If enabled, the loader will never drop items; it can still load them into a machine/container.
		</span>
	</span>
</p>
<p>
	Priority:
	<dt-loader-priority-input name="loader-priority" class="${inputs.priority.class}"></dt-loader-priority-input>
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			Priority for the loader to pickup items.
		</span>
	</span>
</p>
<p>
	Cycle Time:
	<input type="number" class="${inputs.cycleTime.class}" min="1" max="60">
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			Time in seconds for the loader to complete one operation. It always takes (cycle_time - 0.5)
			seconds to move the item, and 0.5 seconds to reset after dropping.
			<br><br>
			Decimal values can be entered because it uses ticks (1s = 20t).
		</span>
	</span>
</p>
<p>
	Stack Limit:
	<input type="number" class="${inputs.stackLimit.class}" min="1" max="16">
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			The loader will only take this amount of items.
		</span>
	</span>
</p>
<p>
	Wait for Stack Limit:
	<input type="checkbox" class="${inputs.waitForStackLimit.class}">
	<span class="tooltip-ref" data-clone>
		<span class="help-circle"></span>
		<span class="tooltip-content">
			If enabled, the loader will not move until it has an item stack that reaches the stack limit. It will still hold an item stack regardless of the amount.
		</span>
	</span>
</p>
<p>
	Filter Mode:
	<dt-filter-mode-input name="filter-mode" class="${inputs.filterMode.class}"></dt-filter-mode-input>
</p>
<p>
	<span>Item Filters:</span>
	<dt-multi-item-input class="${inputs.filterItems.class}"></dt-multi-item-input>
</p>`)
		for (const el of this.dialog.getElementsByClassName("tooltip-ref"))
			addTooltip(el)

		this.handleInputs([
			"points", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					const cfg = getCfg()
					cfg.pickupPoint = element.valuePickup ?? defaults.loader.pickupPoint
					cfg.dropPoint = element.valueDrop ?? defaults.loader.dropPoint
					update()
				})
		], [
			"requireOutputInventory", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.checked
					update()
				})
		], [
			"priority", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.value
					update()
				})
		], [
			"cycleTime", (key, element, getCfg, update) => {
				addBetterInputEvent(element)
				element.addEventListener("c-input", (e: CustomEvent) => {
					const num = handleNumberInput(element)
					if (num == null) return
					getCfg()[key] = num * 20
					update(e.detail.end)
				})
			}
		], [
			"stackLimit", (key, element, getCfg, update) => {
				addBetterInputEvent(element)
				element.addEventListener("c-input", (e: CustomEvent) => {
					const num = handleNumberInput(element)
					if (num == null) return
					getCfg()[key] = num
					update(e.detail.end)
				})
			}
		], [
			"waitForStackLimit", (key, element, cfg, update) =>
				element.addEventListener("change", () => {
					cfg()[key] = element.checked
					update()
				})
		], [
			"filterMode", (key, element, getCfg, update) =>
				element.addEventListener("change", () => {
					getCfg()[key] = element.value
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
		inputs.points.element.valuePickup = config.loader?.pickupPoint ?? defaults.loader.pickupPoint
		inputs.points.element.valueDrop = config.loader?.dropPoint ?? defaults.loader.dropPoint

		inputs.requireOutputInventory.element.checked = (config.loader.requireOutputInventory ?? defaults.loader.requireOutputInventory)

		inputs.priority.element.value = config.loader?.priority ?? defaults.loader.priority

		inputs.cycleTime.element.value = ((config.loader?.cycleTime ?? defaults.loader.cycleTime) / 20).toString()

		inputs.stackLimit.element.value = (config.loader?.stackLimit ?? defaults.loader.stackLimit).toString()

		inputs.waitForStackLimit.element.checked = (config.loader?.waitForStackLimit ?? defaults.loader.waitForStackLimit)

		inputs.filterMode.element.value = config.filterMode ?? defaults.filterMode

		for (const [i, item] of (config.filterItems ?? defaults.filterItems).entries())
			inputs.filterItems.element.itemSlots[i].setItem(item)
	}
}
