import { Item } from "dsabp-js"
import { getSettings } from "../managers/webStorage.js"
import { setSelectedItem } from "../util.js"
import * as itemPicker from "./itemPicker.js"
import { ItemSlot } from "./ItemSlot.js"
import { editorMap } from "./uiMain.js"
import { pointerEvent, usesTouch } from "/main.js"

export function initHotbar() {
	const elHotbar = document.getElementById("hotbar"),
		elSlots: ItemSlot[] = [],
		settings = getSettings() as ReturnType<typeof getSettings> & { hotbar: number[] }

	settings.hotbar ??= []

	let touchTimer: number,
		isHoldingTouch = false,
		lastSelectedSlot: ItemSlot,
		itemPickerOpenForSlot: ItemSlot

	for (let i = 0; i < 10; i++) {
		const elSlot = new ItemSlot(null, { noTooltip: true, allowDrag: true, allowDrop: true })
		elSlot.removeAttribute("tabIndex")
		elSlot.dataset.key = "" + (i == 9 ? 0 : i + 1)
		elSlots[i] = elSlot
		settings.hotbar[i] ??= 0
		elSlot.addEventListener("change", () => {
			if (lastSelectedSlot == elSlot)
				setSelectedItem(editorMap, elSlot.item)
			settings.hotbar[i] = elSlot.item?.id ?? 0
			settings.save()
		})

		if (settings.hotbar[i])
			elSlot.setItem(Item.getById(settings.hotbar[i]))
	}

	function openItemPicker(elSlot: ItemSlot) {
		if (!elSlot) return
		elSlot.classList.add("open")
		itemPickerOpenForSlot = elSlot
		itemPicker.open(item => {
			itemPickerOpenForSlot = null
			elSlot.classList.remove("open")
			if (!item) return
			itemPicker.close()
			elSlot.setItem(item)
		})
	}

	function selectSlot(slot: ItemSlot) {
		lastSelectedSlot?.classList.remove("selected")
		lastSelectedSlot = slot
		slot?.classList.add("selected")
		setSelectedItem(editorMap, slot?.item)
	}

	elHotbar.addEventListener("contextmenu", e => e.preventDefault())

	elHotbar.addEventListener(pointerEvent.up, e => {
		const elSlot = e.target
		if (elSlot instanceof ItemSlot) {
			if (itemPickerOpenForSlot == elSlot) // held touch to open
				return
			if ((e as MouseEvent).button == 2) // R
				openItemPicker(elSlot)
			else
				selectSlot(elSlot)
		}
	})

	if (usesTouch) {
		elHotbar.addEventListener("touchstart", e => {
			isHoldingTouch = !isHoldingTouch

			const target = e.changedTouches[0]?.target as HTMLElement
			if (!(target instanceof ItemSlot && elSlots.includes(target)))
				return

			touchTimer = setTimeout(() => {
				if (isHoldingTouch) {
					itemPicker.dialog.style.pointerEvents = "none" // prevent accidental pick
					openItemPicker(target as ItemSlot)
					setTimeout(() => itemPicker.dialog.style.removeProperty("pointer-events"), 300)
				}
			}, 300)
		})

		const end = () => {
			clearTimeout(touchTimer)
			isHoldingTouch = false
		}
		elHotbar.addEventListener("touchend", end)
		elHotbar.addEventListener("scroll", end)

		elHotbar.addEventListener("touchmove", e => {
			const touch = e.changedTouches[0],
				actualTarget = document.elementFromPoint(touch?.clientX, touch?.clientY)
			if (actualTarget != e.target) {
				clearTimeout(touchTimer)
				isHoldingTouch = false
			}
		})
	} else {
		elHotbar.addEventListener("dblclick", e => {
			const elSlot = e.target
			if (elSlot instanceof ItemSlot)
				openItemPicker(elSlot)
		})
	}

	window.addEventListener("keydown", e => {
		if (e.code.startsWith("Digit")) {
			const ctrlMeta = e.ctrlKey || e.metaKey
			if (ctrlMeta)
				e.preventDefault()
			if (document.activeElement == document.body || (ctrlMeta && itemPicker.dialog.contains(document.activeElement))) {
				const digit = parseInt(e.code[5]),
					slot = elSlots[digit == 0 ? 9 : digit - 1]
				if (ctrlMeta) {
					if (itemPickerOpenForSlot == slot)
						itemPicker.close()
					else
						openItemPicker(slot)
				} else {
					selectSlot(slot)
				}
			}
		}
	})

	editorMap.on("itemchange", () => {
		if (lastSelectedSlot && editorMap.info.selectedItem != lastSelectedSlot.item) {
			lastSelectedSlot.classList.remove("selected")
			lastSelectedSlot = null
		}
	})

	elHotbar.append(...elSlots)
}
