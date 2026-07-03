import { LoaderPoint } from "dsabp-js"
import { elByCls, pointerEvent, trigger, usesTouch } from "/main.js"

const squareRadius = 15

document.getElementById("svg-defs").insertAdjacentHTML("beforeend", /*html*/`
	<marker id="loader-config-arrow" markerWidth="8" markerHeight="8" refX="5" refY="5" orient="auto" markerUnits="strokeWidth">
		<path d="M1,2 L6,5 L1,8 L3,5 Z" style="fill: #43D336;" />
	</marker>`
)

export class LoaderPointsInput extends HTMLElement {
	static localName = "dt-loader-points-input"
	private _valuePickup: LoaderPoint
	private _valueDrop: LoaderPoint
	squares: Record<number, HTMLElement> = {}
	pathArrowLine: SVGPathElement

	constructor() {
		super()
		const grid = document.createElement("span")
		grid.className = "config-grid"

		// setup grid
		let pi = 0
		for (let i = 0; i < 9; i++) {
			const square = document.createElement("div")
			square.className = "square"
			grid.appendChild(square)
			if (i == 4)
				square.classList.add("empty")
			else {
				square.dataset.value = (pi).toString()
				this.squares[pi++] = square
			}
		}

		// setup svg
		const svgContainer = document.createElement("span")
		svgContainer.style.position = "absolute"
		svgContainer.style.pointerEvents = "none"
		svgContainer.innerHTML = /*html*/`
<svg width="90px" height="90px" xmlns="http://www.w3.org/2000/svg">
	<path class="arrow-line" stroke="#43D336" stroke-width="2" marker-end="url(#loader-config-arrow)" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>`
		this.pathArrowLine = elByCls<SVGPathElement>(svgContainer, "arrow-line")
		grid.appendChild(svgContainer)
		this.appendChild(grid)

		let pickupValue: number

		const up = (e: pointerEvent) => {
			if (pickupValue == null)
				return
			const thing = pointerEvent.getValues(e)
			const target = (usesTouch ? document.elementFromPoint(thing.clientX, thing.clientY) : thing.target) as HTMLElement

			let dropValue = grid.contains(target) ? Number(target.dataset.value) : null
			if (dropValue == null)
				return pickupValue = null

			if (dropValue == pickupValue) // if same, make drop opposite
				dropValue = 7 - dropValue

			this._valuePickup = LoaderPoint.getByValue(pickupValue)
			this._valueDrop = LoaderPoint.getByValue(dropValue)
			this.updateArrow()
			trigger(this, "change")
		}

		grid.addEventListener(pointerEvent.down, e => {
			const value = (e.target as HTMLElement).dataset.value
			if (value)
				pickupValue = Number(value)
		})

		window.addEventListener(pointerEvent.up, up)
		window.addEventListener("blur", () => pickupValue = null)
	}

	private updateArrow() {
		if (!this._valuePickup || !this._valueDrop)
			return
		const pickupSquare = this.squares[this._valuePickup.enumValue]
		const dropSquare = this.squares[this._valueDrop.enumValue]
		const begin = `${pickupSquare.offsetLeft + squareRadius},${pickupSquare.offsetTop + squareRadius}`
		const end = `${dropSquare.offsetLeft + squareRadius},${dropSquare.offsetTop + squareRadius}`
		this.pathArrowLine.setAttribute("d", `M ${begin} L ${squareRadius * 3},${squareRadius * 3} L ${end}`)
	}

	get valuePickup() {
		return this._valuePickup
	}
	set valuePickup(point: LoaderPoint) {
		this._valuePickup = point
		this.updateArrow()
	}

	get valueDrop() {
		return this._valueDrop
	}
	set valueDrop(point: LoaderPoint) {
		this._valueDrop = point
		this.updateArrow()
	}
}

customElements.define(LoaderPointsInput.localName, LoaderPointsInput)
