import { ConfigCmd } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { FixedAngleInput } from "../FixedAngleInput.js"
import { ConfigMenu, HandleInputs } from "./ConfigMenu.js"

const defaults = ConfigCmd.defaults

export class ShieldGeneratorConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
		fixedAngle: {
			class: "fixedAngle",
			element: null as FixedAngleInput
		}
	}

	constructor(editorMap: EditorMap) {
		super(editorMap)
		const inputs = this.inputs
		this.init(/*html*/` 
<p>
	Angle:
	<dt-fixed-angle-input class="${inputs.fixedAngle.class}"></dt-fixed-angle-input>
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
		])
	}

	fill() {
		super.fill()

		this.inputs.fixedAngle.element.value = this.config.fixedAngle ?? defaults.fixedAngle
	}
}
