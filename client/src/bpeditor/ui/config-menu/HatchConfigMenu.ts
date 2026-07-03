import { ConfigCmd, Item } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { FilterModeInput } from "../FilterModeInput.js"
import { MultiItemInput } from "../MultiItemInput.js"
import { ConfigMenu, HandleInputs } from "./ConfigMenu.js"

const defaults = ConfigCmd.defaults

export class HatchConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
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
	Filter Mode:
	<dt-filter-mode-input name="filter-mode" class="${inputs.filterMode.class}"></dt-filter-mode-input>
</p>
<p>
	<span>Item Filters:</span>
	<dt-multi-item-input class="${inputs.filterItems.class}"></dt-multi-item-input>
</p>`)
		this.handleInputs([
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
		inputs.filterMode.element.value = config.filterMode ?? defaults.filterMode

		for (const [i, item] of (config.filterItems ?? defaults.filterItems).entries())
			inputs.filterItems.element.itemSlots[i].setItem(item)
	}
}
