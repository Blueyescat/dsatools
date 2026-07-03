import { FilterMode } from "dsabp-js"
import { getImage } from "dsabp-js-img"
import { addTooltip, updateChips } from "/main.js"

const data = new Map([
	[FilterMode.ALLOW_ALL, {
		tooltip: "<h5>Allow All</h5>Allows anything, ignores the filter.",
		img: "silk/asterisk_green",
		color: [120, 100, 50]
	}],
	[FilterMode.BLOCK_FILTER_ONLY, {
		tooltip: "<h5>Blacklist</h5>Does not allow items that are in the filter.",
		img: "silk/page_dark",
		color: [60, 100, 50]
	}],
	[FilterMode.ALLOW_FILTER_ONLY, {
		tooltip: "<h5>Whitelist</h5>Only allows items that are in the filter.",
		img: "silk/page_light",
		color: [30.12, 100, 50]
	}],
	[FilterMode.BLOCK_ALL, {
		tooltip: "<h5>Block All</h5>Does not allow anything, ignores the filter.",
		img: "silk/cross",
		color: [0, 100, 50]
	}],
])

export class FilterModeInput extends HTMLElement {
	static localName = "dt-filter-mode-input"
	elRadios: HTMLInputElement[] = []
	private _value: FilterMode

	constructor() {
		super()
		this.classList.add("radio-chips", "config-chips")

		let i = 0
		for (const mode of FilterMode.getMap().values()) {
			const { color, img, tooltip } = data.get(mode)

			const label = document.createElement("label")
			label.className = "tooltip-ref"
			label.dataset.clone = ""
			label.dataset.onlyLongT = ""
			label.style.setProperty("--a", `hsl(${color[0]} ${color[1]}% ${color[2]}%)`)
			label.style.setProperty("--d", `hsl(${color[0]} ${color[1]}% ${color[2] - 10}%)`)

			const radio = this.elRadios[i] = document.createElement("input")
			radio.type = "radio"
			radio.name = this.getAttribute("name")
			radio.value = mode.enumName
			radio.addEventListener("change", () =>
				this.value = FilterMode.getByName(radio.value)
				// this event bubbles to LoaderPriorityInput
			)

			const ttp = document.createElement("span")
			ttp.className = "tooltip-content"
			ttp.innerHTML = tooltip

			const elImg = document.createElement("img")
			getImage(img).then(image => elImg.src = image.src)

			label.append(radio, elImg, ttp)
			addTooltip(label)

			this.appendChild(label)
			++i
		}
	}

	get value() {
		return this._value
	}

	set value(mode: FilterMode) {
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

customElements.define(FilterModeInput.localName, FilterModeInput)
