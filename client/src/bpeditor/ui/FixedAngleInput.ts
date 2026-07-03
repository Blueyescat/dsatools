import { FixedAngle } from "dsabp-js"
import { trigger } from "/main.js"

const presetValues = [FixedAngle.UP, FixedAngle.LEFT, FixedAngle.RIGHT, FixedAngle.DOWN]

export class FixedAngleInput extends HTMLElement {
	static localName = "dt-fixed-angle-input"
	private _value: FixedAngle
	imgArrow: HTMLImageElement

	constructor() {
		super()
		const grid = document.createElement("span")
		grid.className = "config-grid"

		// setup grid
		let ai = 0
		for (let i = 0; i < 8; i++) {
			const square = document.createElement("div")
			square.className = "square"
			if (i % 2 == 0)
				square.classList.add("empty")
			else
				square.dataset.value = presetValues[ai++].enumValue.toString()
			grid.appendChild(square)
		}

		// setup arrow
		this.imgArrow = document.createElement("img")
		this.imgArrow.className = "arrow"
		this.imgArrow.src = "../assets/game-images/immui/arrow_angle.png"
		grid.appendChild(this.imgArrow)

		this.appendChild(grid)

		grid.addEventListener("click", e => {
			const value = (e.target as HTMLElement).dataset.value
			if (value) {
				this._value = FixedAngle.getByValue(Number(value))
				this.updateArrow()
				trigger(this, "change")
			}
		})
	}

	private updateArrow() {
		this.imgArrow.style.transform = `rotate(${360 - this._value.enumValue * 90}deg)`
	}

	get value() {
		return this._value
	}

	set value(angle: FixedAngle) {
		this._value = angle
		this.updateArrow()
	}
}

customElements.define(FixedAngleInput.localName, FixedAngleInput)
