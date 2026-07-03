import { ConfigCmd } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { FixedAngleInput } from "../FixedAngleInput.js"
import { ConfigMenu, HandleInputs } from "./ConfigMenu.js"
import { elByCls, switchTriStateCb } from "/main.js"

const defaults = ConfigCmd.defaults

export class EjectorConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
		fixedAngle: {
			class: "fixedAngle",
			element: null as FixedAngleInput
		}
	}

	cbHull: HTMLInputElement

	constructor(editorMap: EditorMap) {
		super(editorMap)
		const inputs = this.inputs
		this.init(/*html*/`
<p>
	Angle:
	<dt-fixed-angle-input class="${inputs.fixedAngle.class}"></dt-fixed-angle-input>
</p>
<p class="cond-only not-config find-only">
	<span style="display: list-item; list-style-position: inside;"></span>Hull Mounted: <input type="checkbox" class="tricb cb-hull" data-state="null" title="State: Ignore">
</p>`)
		this.handleInputs([
			"fixedAngle", (key, element, getCfg, update) =>
				element.addEventListener("change", async () => {
					const cfg = getCfg(),
						prev = cfg[key] ?? defaults[key]
					cfg[key] = element.value
					if (!(await update()) && prev != null)
						element.value = cfg[key] = prev
				})
		]);

		(this.cbHull = elByCls<HTMLInputElement>(this.dialog.elBody, "cb-hull"))
			.addEventListener("c-change", (e: CustomEvent) =>
				this.setOtherCond("ejectorHull", e.detail.state)
			)
	}

	fill() {
		super.fill()

		this.inputs.fixedAngle.element.value = this.config.fixedAngle ?? defaults.fixedAngle

		if (this.conditions)
			switchTriStateCb(this.cbHull, this.getOtherCond("ejectorHull"), true)
	}
}
