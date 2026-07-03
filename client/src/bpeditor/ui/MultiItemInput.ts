import { isKeyDown } from "../util.js"
import { ItemSlot } from "./ItemSlot.js"
import { trigger } from "/main.js"

let itemPicker: typeof import("./itemPicker.js")
import("./itemPicker.js").then(x => itemPicker = x)

const amount = 3

export class MultiItemInput extends HTMLElement {
	static localName = "dt-multi-item-input"
	itemSlots: ItemSlot[] = []

	constructor() {
		super()
		for (let i = 0; i < amount; i++) {
			const slot = document.createElement("span")
			const itemSlot = this.itemSlots[i] = new ItemSlot(null, { allowDrag: true, allowDrop: "infinite" })
			itemSlot.addEventListener("click", () => {
				if ("longTouch" in itemSlot.dataset)
					return

				for (const slot of this.itemSlots) {
					if (slot == itemSlot && slot.classList.contains("open")) {
						slot.classList.remove("open")
						return itemPicker.close()
					}
					slot.classList.toggle("open", slot == itemSlot)
				}

				itemPicker?.open(item => {
					itemSlot.classList.remove("open")
					if (!item) return

					itemPicker.close()
					itemSlot.setItem(item)
				}, isKeyDown("r")) // don't focus search if holding R to open clipboard menu
			})
			itemSlot.addEventListener("change", () => trigger(this, "change"))
			slot.appendChild(itemSlot)
			slot.insertAdjacentHTML("beforeend", /*html*/`
<button tabindex="-1"><i class="i x no-pointer"></i></button>`)

			this.appendChild(slot)
		}

		this.addEventListener("click", e => {
			const target = e.target as HTMLElement
			if (target.tagName == "BUTTON") {
				const slot = target.previousElementSibling as ItemSlot
				if (slot.item) {
					slot.setItem(null)
					trigger(this, "change")
				}
			}
		})
	}
}

customElements.define(MultiItemInput.localName, MultiItemInput)
