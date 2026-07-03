import { ConfigCmd, Item } from "dsabp-js"
import { EditorMap } from "../../EditorMap.js"
import { addBetterInputEvent } from "../../util.js"
import { AngleInput } from "../AngleInput.js"
import { ConfigMenu, HandleInputs } from "./ConfigMenu.js"
import { initBoxExpander } from "/bpeditor/managers/boxExpander.js"
import { MapObject } from "/bpeditor/MapObject.js"
import { addTooltip, elByCls } from "/main.js"

const defaults = ConfigCmd.defaults

export class ExpandoBoxConfigMenu extends ConfigMenu {
	declare handleInputs: HandleInputs<typeof this.inputs>

	inputs = {
		angle: {
			class: "angle",
			element: null as AngleInput
		}
	}

	constructor(editorMap: EditorMap) {
		super(editorMap)
		const inputs = this.inputs
		this.init(/*html*/`
<p>
	Angle:
	<dt-angle-input class="${inputs.angle.class}"></dt-angle-input>
</p>
<div class="box-test" style="display: none;">
	<hr>
	<h4 style="margin-bottom: 0.5em;">
		Expansion Tester
		<span class="tooltip-ref" style="font-weight: normal;">
			<span class="help-circle"></span>
			<span class="tooltip-content">
				<p>Before expanding, position the box where it would be in the game when empty.</p>
				<p>The expanded box area, box movement and calculated capacity may not match the game in most cases but will be fairly close.</p>
			</span>
		</span>
	</h4>
	<ul style="padding-inline-start: 1.5em;">
		<li>Area: <b class="w"></b>x<b class="h"></b> squares</li>
		<li>Capacity: ~<b class="c"></b> stacks (x16 = <span class="c16"></span>)</li>
	</ul>
	<p><button class="btn-expand"></button></p>
</div>
`)
		for (const el of this.dialog.getElementsByClassName("tooltip-ref"))
			addTooltip(el)

		let angleInputTimer: number
		this.handleInputs([
			"angle", (key, element, getCfg, update) => {
				addBetterInputEvent(element)

				element.addEventListener("c-angle-input", async (e: CustomEvent) => {
					clearTimeout(angleInputTimer)
					angleInputTimer = setTimeout(async () => {
						const cfg = getCfg(),
							prev = cfg[key] ?? defaults[key]
						cfg[key] = element.value
						if (!(await update(e.detail.end)) && prev != null)
							element.value = cfg[key] = prev
					})
				})
			}
		])

		const { squareSize, highlight, history, selection } = editorMap

		// expansion tester
		let boxExpander: ReturnType<typeof initBoxExpander>
		const DEF_W = 2, DEF_H = 2, DEF_CAP = 12

		const elBoxTest = elByCls(this.dialog, "box-test"),
			btnExpand = elByCls(this.dialog, "btn-expand"),
			elWidth = elByCls(this.dialog, "w"),
			elHeight = elByCls(this.dialog, "h"),
			elCap = elByCls(this.dialog, "c"),
			elCap16 = elByCls(this.dialog, "c16")

		this.dialog.addEventListener("open", () => {
			elBoxTest.style.display = this.mapObject?.isValid
				&& this.item == Item.EXPANDO_BOX
				&& !this.dialog.classList.contains("clipboard")
				&& !this.conditions
				? "" : "none"
			loadInfo(this.mapObject)
		})

		function loadInfo(o: MapObject) {
			boxExpander ??= initBoxExpander()
			const result = o ? boxExpander.getResult(o) : null
			elWidth.textContent = "" + (result ? +(result.width / squareSize).toFixed(2) : DEF_W)
			elHeight.textContent = "" + (result ? +(result.height / squareSize).toFixed(2) : DEF_H)
			elCap.textContent = "" + (result ? result.capacity : DEF_CAP)
			elCap16.textContent = "" + (result ? result.capacity * 16 : DEF_CAP * 16)
			btnExpand.textContent = result ? "Shrink" : "Expand"
		}

		btnExpand.addEventListener("click", async () => {
			boxExpander ??= initBoxExpander()

			const obj = this.mapObject,
				origPos = { x: obj.x, y: obj.y },
				isExpanded = boxExpander.isActive(obj)

			btnExpand.textContent = isExpanded ? "Shrinking..." : "Expanding..."
			if (isExpanded) {
				await boxExpander.shrink(obj)
				highlight.showFor("focus", obj)
			} else {
				await boxExpander.expand(obj)
			}

			const currPos = { x: obj.x, y: obj.y }
			if (currPos.x != origPos.x || currPos.y != origPos.y)
				history.add({
					type: "moveObject",
					undo: async () => {
						await boxExpander.shrink(obj)
						await selection.movingUndoRedo(currPos, origPos, obj.item, null)
						editorMap.updateBpStr()
						loadInfo(obj)
					},
					redo: async () => {
						await boxExpander.expand(obj)
						currPos.x = obj.x
						currPos.y = obj.y
						editorMap.updateBpStr()
						loadInfo(obj)
					}
				})

			loadInfo(obj)
		})
	}

	fill() {
		super.fill()

		this.inputs.angle.element.value = this.config.angle ?? defaults.angle
	}
}
