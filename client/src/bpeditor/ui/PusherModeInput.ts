import { PusherMode } from "dsabp-js"
import { addTooltip, trigger, updateChips } from "/main.js"

const data = new Map([
	[PusherMode.PUSH, {
		tooltip: "<h5>Push</h5>Pushes things hit by the beam.",
		img: "/silk/arrow_out.png",
		color: [120, 100, 50]
	}],
	[PusherMode.PULL, {
		tooltip: "<h5>Pull</h5>Pulls things hit by the beam.",
		img: "/silk/arrow_in.png",
		color: [300, 100, 50]
	}],
	[PusherMode.DO_NOTHING, {
		tooltip: "<h5>Do Nothing</h5>",
		img: "/silk/cross.png",
		color: [0, 0, 50.2]
	}],
])

export class PusherModeInput extends HTMLElement {
	static localName = "dt-pusher-mode-input"
	elRadios: HTMLInputElement[] = []
	private _value: PusherMode

	constructor() {
		super()
		this.classList.add("radio-chips", "config-chips")

		let i = 0
		for (const mode of PusherMode.getMap().values()) {
			const { color, img, tooltip } = data.get(mode)

			const label = document.createElement("label")
			label.className = "tooltip-ref"
			label.dataset.clone = ""
			label.dataset.onlyLongT = ""
			label.style.setProperty("--a", `hsl(${color[0]} ${color[1]}% ${color[2]}%)`)
			label.style.setProperty("--d", `hsl(${color[0]} ${color[1]}% ${color[2] - 10}%)`)
			// label.style.outlineColor = `var(--d)`

			const radio = this.elRadios[i] = document.createElement("input")
			radio.type = "radio"
			radio.name = this.getAttribute("name")
			radio.value = mode.enumName
			radio.addEventListener("change", () => {
				this.value = PusherMode.getByName(radio.value)
				trigger(this, "change")
				/* label.style.outlineColor = "var(--a)"
				for (const other of this.elRadios)
					if (other != radio)
						other.parentElement.style.outlineColor = "var(--d)" */
			})

			const ttp = document.createElement("span")
			ttp.className = "tooltip-content"
			ttp.innerHTML = tooltip

			const elImg = document.createElement("img")
			elImg.src = "../assets/game-images" + img

			label.append(radio, elImg, ttp)
			addTooltip(label)

			this.appendChild(label)
			++i
		}
	}

	get value() {
		return this._value
	}

	set value(mode: PusherMode) {
		this._value = mode
		for (const radio of this.elRadios) {
			if (radio.value == mode.enumName) {
				radio.checked = true
				// radio.parentElement.style.outlineColor = "var(--a)"
				updateChips(this, radio)
				break
			}
		}
	}
}

customElements.define(PusherModeInput.localName, PusherModeInput)
