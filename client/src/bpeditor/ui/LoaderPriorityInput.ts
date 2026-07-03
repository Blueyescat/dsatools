import { LoaderPriority } from "dsabp-js"
import { addTooltip, updateChips } from "/main.js"

const data = new Map([
	[LoaderPriority.LOW, {
		color: [0, 100, 33.33]
	}],
	[LoaderPriority.NORMAL, {
		color: [60, 100, 33.33]
	}],
	[LoaderPriority.HIGH, {
		color: [120, 100, 33.33]
	}],
])

export class LoaderPriorityInput extends HTMLElement {
	static localName = "dt-loader-priority-input"
	elRadios: HTMLInputElement[] = []
	private _value: LoaderPriority

	constructor() {
		super()
		this.classList.add("radio-chips", "config-chips")

		let i = 0
		for (const mode of LoaderPriority.getMap().values()) {
			const { color } = data.get(mode)

			const label = document.createElement("label")
			label.style.setProperty("--a", `hsl(${color[0]} ${color[1]}% ${color[2]}%)`)

			const radio = this.elRadios[i] = document.createElement("input")
			radio.type = "radio"
			radio.name = this.getAttribute("name")
			radio.value = mode.enumName
			radio.addEventListener("change", () =>
				this.value = LoaderPriority.getByName(radio.value)
				// this event bubbles to LoaderPriorityInput
			)

			label.append(radio, document.createTextNode(mode.enumName.toLowerCase()))
			addTooltip(label)

			this.appendChild(label)
			++i
		}
	}

	get value() {
		return this._value
	}

	set value(mode: LoaderPriority) {
		this._value = mode
		for (const radio of this.elRadios) {
			if (radio.value == mode.enumName) {
				radio.checked = true
				updateChips(this, radio)
				break
			}
		}
	}
}

customElements.define(LoaderPriorityInput.localName, LoaderPriorityInput)
