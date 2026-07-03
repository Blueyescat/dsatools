import { addBetterInputEvent } from "../util.js"
import { pointerEvent, triggerCustom } from "/main.js"

const presetAngles = [135, 90, 45, 180, -1, 0, 225, 270, 315]

export class AngleInput extends HTMLElement {
	static localName = "dt-angle-input"
	private _value: number
	imgArrow: HTMLImageElement
	inputNumber: HTMLInputElement

	constructor() {
		super()
		const grid = document.createElement("span")
		grid.className = "config-grid"

		// setup grid
		let middleSquare: HTMLElement
		for (let i = 0; i < 9; i++) {
			const square = document.createElement("div")
			square.className = "square"
			grid.appendChild(square)
			if (i == 4)
				middleSquare = square
			else
				square.dataset.angle = presetAngles[i].toString()
		}

		// setup number input
		this.inputNumber = document.createElement("input")
		this.inputNumber.type = "number"
		this.inputNumber.style.marginLeft = "0.4em"
		addBetterInputEvent(this.inputNumber)

		// setup arrow
		this.imgArrow = document.createElement("img")
		this.imgArrow.className = "arrow"
		this.imgArrow.src = "../assets/game-images/immui/arrow_angle.png"
		grid.appendChild(this.imgArrow)

		this.append(grid, this.inputNumber)


		const updated = (end = false) => {
			this.updateArrow()
			triggerCustom(this, "c-angle-input", { detail: { end } })
		}

		// handle number input
		this.inputNumber.addEventListener("c-input", (e: CustomEvent) => {
			this._value = Number(this.inputNumber.value) % 360
			if (this._value < 0)
				this._value += 360
			updated(e.detail.end)
		})

		// handle mouse drag input
		let isDown: boolean, didChange: boolean

		const pointerUpHandler = () => {
			if (didChange)
				updated(true)
			isDown = didChange = false
		}

		const moveHandler = (e: pointerEvent) => {
			const coords = pointerEvent.getValues(e)
			if (!isDown)
				return
			const midRect = middleSquare.getBoundingClientRect()
			const midPos = { x: midRect.x + midRect.width / 2, y: midRect.y + midRect.height / 2 }
			this._value = (180 - Math.atan2(midPos.y - coords.clientY, midPos.x - coords.clientX) * 180 / Math.PI) % 360
			if (this._value < 0)
				this._value += 360
			this.inputNumber.value = fixed(this._value)
			didChange = true
			updated()
		}

		middleSquare.addEventListener("pointerdown", () => isDown = true)

		window.addEventListener(pointerEvent.move, moveHandler)
		window.addEventListener(pointerEvent.up, pointerUpHandler)

		window.addEventListener("blur", pointerUpHandler)

		// handle preset square clicks
		grid.addEventListener("click", e => {
			const degrees = (e.target as HTMLElement).dataset.angle
			if (degrees) {
				this._value = Number(degrees)
				this.inputNumber.value = fixed(this._value)
				updated(true)
			}
		})
	}

	private updateArrow() {
		this.imgArrow.style.transform = `rotate(${360 - this._value}deg)`
	}

	get value() {
		return this._value
	}

	set value(degrees: number) {
		this._value = degrees
		this.inputNumber.value = fixed(degrees)
		this.updateArrow()
	}
}

function fixed(n: number) {
	return n.toFixed(4).replace(/\.?0+$/, "")
}

customElements.define(AngleInput.localName, AngleInput)
