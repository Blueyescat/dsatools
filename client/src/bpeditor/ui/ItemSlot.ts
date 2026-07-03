import { Item } from "dsabp-js"
import { getImage } from "dsabp-js-img"
import { getUnpackagedName } from "../util.js"
import { addTooltip, elByCls, forceCloseTooltip, removeTooltipListener, trigger } from "/main.js"

const rarityColor = {
	"-1": "0 255 255",
	0: "64 64 64",
	1: "255 255 255",
	2: "0 255 0",
	9: "255 255 0"
}

export class ItemSlot extends HTMLElement {
	static localName = "dt-item-slot"

	// don't forget cloneNode
	item: Item
	declare allowDrag: boolean | "infinite"
	declare allowDrop: boolean | "infinite"
	declare noTooltip: boolean

	constructor(item?: Item, options?: { allowDrag?: boolean | "infinite", allowDrop?: boolean | "infinite", noTooltip?: boolean }) {
		super()
		this.tabIndex = 0
		if (options?.allowDrag)
			this.allowDrag = options.allowDrag
		if (options?.allowDrop)
			this.allowDrop = options.allowDrop
		if (options?.noTooltip)
			this.noTooltip = options.noTooltip
		if (item)
			this.setItem(item)
	}

	setItem(item: Item) {
		if (item == null || item == Item.NULL) {
			if (this.item) {
				this.item = undefined
				this.style.removeProperty("background-image")
				this.style.removeProperty("--slot-rgb")
				elByCls(this, "tooltip-content")?.remove()
				this.classList.remove("tooltip-ref")
				trigger(this, "change")
				this.removeAttribute("draggable")
			}
			return
		}

		this.item = item

		const imageUrl = `${location.origin}/p?https://test.drednot.io/img/${item.image}.png`		
		getImage(imageUrl).then(img => {
			if (item.enumName.includes("STARTER"))
				this.style.backgroundSize = img.width + "px"
			else
				this.style.removeProperty("background-size")
			this.style.backgroundImage = `url(${img.src})`
		})

		this.style.setProperty("--slot-rgb", rarityColor[item.rarity])

		if (this.allowDrag)
			this.draggable = true

		const hasTtp = this.classList.contains("tooltip-ref")
		let elTooltipContent = elByCls(this, "tooltip-content")
		if (this.noTooltip) {
			if (hasTtp) {
				elTooltipContent?.remove()
				removeTooltipListener(this)
				this.classList.remove("tooltip-ref")
				delete this.dataset.showAbove
				delete this.dataset.onlyLongT
				delete this.dataset.longTouch
				delete this.dataset.clone
			}
		} else {
			if (!hasTtp) {
				this.classList.add("tooltip-ref")
				this.dataset.showAbove = ""
				this.dataset.onlyLongT = ""
				this.dataset.clone = ""
			}

			if (!elTooltipContent) {
				elTooltipContent = document.createElement("div")
				elTooltipContent.className = "tooltip-content"
				this.appendChild(elTooltipContent)
			}

			elTooltipContent.innerHTML = /*html*/`
	<h4>${this.name} <small style="font-weight: normal">#${this.item.id}</small></h4>${this.item.description}`
			addTooltip(this)
		}
		trigger(this, "change")
		return this
	}

	get name() {
		return this.item.name.includes("Packaged") ? getUnpackagedName(this.item) : this.item.name
	}

	// override
	cloneNode() {
		const clone = super.cloneNode(true) as ItemSlot
		clone.item = this.item
		if (this.allowDrag)
			clone.allowDrag = this.allowDrag
		if (this.allowDrop)
			clone.allowDrop = this.allowDrop
		if (this.noTooltip)
			clone.noTooltip = this.noTooltip
		if (clone.classList.contains("tooltip-ref"))
			addTooltip(clone)
		return clone
	}
}

customElements.define(ItemSlot.localName, ItemSlot)

/* DRAGGING */
const elDragImage = document.createElement("img")
let draggingSlot: ItemSlot

window.addEventListener("dragstart", e => {
	const slot = e.target
	if (slot instanceof ItemSlot && slot.allowDrag) {
		if (!slot.draggable)
			return e.preventDefault()
		elDragImage.src = slot.style.backgroundImage.slice(5, -2)
		e.dataTransfer.setDragImage(elDragImage, e.offsetX, e.offsetY)
		slot.classList.add("dragging")
		draggingSlot = slot
		forceCloseTooltip(slot)
	}
})

const handleDragEnter = (e: DragEvent) => {
	if (draggingSlot) {
		const slot = e.target
		if (slot instanceof ItemSlot && slot.allowDrop) {
			slot.classList.add("dragover")
			e.preventDefault()
		}
	}
}
window.addEventListener("dragenter", handleDragEnter)
window.addEventListener("dragover", handleDragEnter)

window.addEventListener("dragleave", ({ target }) => {
	if (draggingSlot && target instanceof ItemSlot && target.allowDrop) {
		target.classList.remove("dragover")
		forceCloseTooltip(target)
	}
})

window.addEventListener("dragend", ({ target }) =>
	target instanceof ItemSlot && target.allowDrag
	&& target.classList.remove("dragging")
)

window.addEventListener("drop", e => {
	const slot = e.target
	if (draggingSlot && slot instanceof ItemSlot && slot.allowDrop) {
		if (slot != draggingSlot) {
			const slotOldItem = slot.item,
				slotInfiniteDrop = slot.allowDrop == "infinite",
				bothDropInfinite = draggingSlot.allowDrop == "infinite" && slotInfiniteDrop
			slot.setItem(draggingSlot.item)
			if (slotOldItem && bothDropInfinite)
				draggingSlot.setItem(slotOldItem) // if both drop inf, switch items
			if ((draggingSlot.allowDrag != "infinite" && !slotInfiniteDrop) || (!slotOldItem && bothDropInfinite)) // if both drop inf and target slot is empty, act like not inf
				draggingSlot.setItem(null)
		}
		slot.classList.remove("dragover")
		draggingSlot = null
	}
})
