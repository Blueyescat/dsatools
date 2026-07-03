import { Item } from "dsabp-js"
import { usesTouch } from "../main.js"
import { ItemSlot } from "./ItemSlot.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"

// setup the picker
const divItems = document.createElement("div")
divItems.className = "items"

async function init() {
	for (const item of Item.getMap().values()) {
		if (item == Item.NULL)
			continue
		const itemSlot = new ItemSlot(item, { allowDrag: "infinite" })
		itemSlot.classList.add("tooltip-ref")
		divItems.appendChild(itemSlot)
		await new Promise(r => setTimeout(r, location.hostname == "localhost" ? 200 : 1))
	}
}

const itemPicker = new Dialog({
	className: "item-picker",
	title: "Item Picker",
	draggable: { key: "item-picker" },
	defaultPos: { left: "23%", top: "15%" },
	body: [
		/*html*/`
<p>
	<input class="input-search"autocomplete="off" placeholder="Search items by name, description or ID" style="width: 70%">
	<button class="button-clear" tabindex="-1"><i class="i x"></i></button>
</p>`,
		divItems,
		/*html*/`
<p style="display: flex; align-items: center; gap: 0.3em;">
	History: <span class="history"></span>
	<button class="button-null" tabindex="-1" style="margin-left: auto;"><img src="/assets/game-images/silk/cross.png" style="vertical-align: middle;"> None</button>
</p>`
	]
})

const inputSearch = elByCls<HTMLInputElement>(itemPicker, "input-search"),
	elSlots = divItems.children as HTMLCollectionOf<ItemSlot>,
	elHistory = elByCls(itemPicker, "history"),
	btnNull = elByCls<HTMLButtonElement>(itemPicker, "button-null")

// search
function onSearchInput() {
	const query = inputSearch.value.toLowerCase().trim().replace(/ +/, " ")
	for (const slot of elSlots) {
		slot.classList.toggle("hidden", !(
			query == ""
			|| slot.item.name.toLowerCase().includes(query)
			|| slot.item.id.toString() == query
			|| slot.item.description.toLowerCase().includes(query)
		))
	}
}

inputSearch.addEventListener("input", onSearchInput)

itemPicker.addEventListener("close", () => (inputSearch.value = "", onSearchInput()))

elByCls(itemPicker, "button-clear").addEventListener("click", () =>
	(inputSearch.value = "", inputSearch.focus(), onSearchInput())
)

// history
function saveToHistory(item: Item | ItemSlot) {
	// return if last slot is same
	if (elHistory.firstElementChild instanceof ItemSlot && elHistory.firstElementChild.item == (item instanceof ItemSlot ? item.item : item))
		return
	if (elHistory.childElementCount == 10)
		elHistory.lastElementChild.remove()
	// the item slot may have clone tooltip open
	if (item instanceof HTMLElement && item.dataset.clone == "1")
		item.dataset.clone = ""

	elHistory.prepend(item instanceof ItemSlot ? item : new ItemSlot(item))
}

// handle selection/closing
let onComplete: (item?: Item) => any

itemPicker.addEventListener("click", e => {
	const target = e.target as ItemSlot
	if (target?.localName != ItemSlot.localName)
		return

	if (target && ("longTouch" in target.dataset))
		return

	saveToHistory(target.cloneNode())
	onComplete?.(target.item)
})

itemPicker.addEventListener("keypress", e => {
	if (e.code == "Enter") {
		for (const slot of elSlots) {
			if (document.activeElement.localName == ItemSlot.localName
				? document.activeElement == slot
				: !slot.classList.contains("hidden")
			) {
				saveToHistory(slot.cloneNode())
				onComplete?.(slot.item)
				return
			}
		}
	}
})

btnNull.addEventListener("click", () => onComplete?.(Item.NULL))

itemPicker.addEventListener("close", () => onComplete?.())

itemPicker.addEventListener("contextmenu", e => e.preventDefault())

/**
 * @param completeCallback.item is undefined if the picker was closed
 */
function open(completeCb?: (selected?: Item) => any, noFocus?: boolean) {
	if (itemPicker.isOpen)
		itemPicker.close()
	onComplete = completeCb
	itemPicker.open(true)
	if (!usesTouch && !noFocus)
		inputSearch.focus({ preventScroll: true })
}

const close = () => itemPicker.close(),
	dialog = itemPicker

export { close, dialog, init, open, saveToHistory }

