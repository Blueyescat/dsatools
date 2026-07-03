import { Shape } from "dsabp-js"
import { EventEmitter } from "pixi.js"
import { MapObject } from "../MapObject.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"
const S = Shape,
	title = "Shape Picker",
	layout = [
		[S.BLOCK],
		[S.RAMP_UL, S.RAMP_UR, S.RAMP_DL, S.RAMP_DR, S.SLAB_U, S.SLAB_D, S.SLAB_L, S.SLAB_R],
		[S.HALF_RAMP_1_UI, S.HALF_RAMP_2_UI, S.HALF_RAMP_2_U, S.HALF_RAMP_1_U, S.HALF_RAMP_2_L, S.HALF_RAMP_1_L, S.HALF_RAMP_1_RI, S.HALF_RAMP_2_RI],
		[S.HALF_RAMP_1_D, S.HALF_RAMP_2_D, S.HALF_RAMP_2_DI, S.HALF_RAMP_1_DI, S.HALF_RAMP_2_LI, S.HALF_RAMP_1_LI, S.HALF_RAMP_1_R, S.HALF_RAMP_2_R],
		[S.HALF_RAMP_3_UI, S.HALF_RAMP_3_U, S.HALF_RAMP_3_L, S.HALF_RAMP_3_RI, S.QUARTER_UL, S.QUARTER_UR, S.QUARTER_RAMP_UL, S.QUARTER_RAMP_UR],
		[S.HALF_RAMP_3_D, S.HALF_RAMP_3_DI, S.HALF_RAMP_3_LI, S.HALF_RAMP_3_R, S.QUARTER_DL, S.QUARTER_DR, S.QUARTER_RAMP_DL, S.QUARTER_RAMP_DR],
		[S.BEVEL_UL, S.BEVEL_UR],
		[S.BEVEL_DL, S.BEVEL_DR]
	],
	events = new EventEmitter<{ "shapechange": (shape?: Shape) => void, "condchange": (state?: boolean) => void }>()

let highlightedShape: Shape,
	cbCond: HTMLInputElement

// setup the picker
const divShapes = document.createElement("div")
divShapes.className = "shapes"

for (const row of layout) {
	for (const shape of row) {
		const shapeSlot = document.createElement("div")
		shapeSlot.dataset.shape = shape.enumValue.toString()
		shapeSlot.style.setProperty("--v", shape.vertices.map(v => `${(0.5 + v.x) * 30}px ${(-v.y + 0.5) * 30}px`).join(", "))
		shapeSlot.tabIndex = 0
		divShapes.appendChild(shapeSlot)
	}
	if (row != layout[layout.length - 1])
		divShapes.appendChild(document.createElement("br"))
}

const dialog = new Dialog({
	className: "shape-picker",
	title,
	draggable: { key: "shape-picker" },
	defaultPos: { left: "10%", top: "15%" },
	body: [/*html*/`
<p class="cond-only find-only">
	Match: <input type="checkbox" class="cb-cond" checked title="Whether to match a block with this shape.">
</p>
	`, divShapes],
	footer: {
		html: /*html*/`
<button class="button-remove-config">Remove Config</button>
<button class="button-paste">Paste</button><button class="button-copy">Copy</button>`,
		closeButton: { html: "OK", right: true }
	},
	onCreate(dialog) {
		cbCond = elByCls<HTMLInputElement>(dialog.elBody, "cb-cond")
		cbCond.addEventListener("click", () => events.emit("condchange", cbCond.checked))
	}
})

const elSlots = divShapes.children as HTMLCollectionOf<HTMLElement>

// handle clipboard button clicks
let onClickCopy: (shape: Shape) => void
(elByCls<HTMLButtonElement>(dialog.elFooter, "button-copy"))
	.addEventListener("click", () => onClickCopy?.(highlightedShape))

let onClickPaste: () => void
(elByCls<HTMLButtonElement>(dialog.elFooter, "button-paste"))
	.addEventListener("click", () => onClickPaste?.())

// handle selection/closing
let onComplete: (shape?: Shape) => void

function handleSlotClick(slot: HTMLElement) {
	const val = slot.dataset.shape
	if (val == null) return
	highlight(slot)
	const shape = Shape.getByValue(Number(val))
	onComplete?.(shape)
	events.emit("shapechange", shape)
}

dialog.addEventListener("click", e => {
	const target = e.target as HTMLElement
	handleSlotClick(target)
})

dialog.addEventListener("keypress", e => {
	if (e.code == "Enter") {
		for (const slot of elSlots) {
			if (document.activeElement == slot) {
				handleSlotClick(slot)
				return
			}
		}
	}
})

dialog.addEventListener("close", () => onComplete?.())

/**
 * @param highlightShape a shape to initially highlight
 * @param mapObject the map object this shape picker is meant to edit, if any
 * @param isConfig true if editing a map object or the clipboard
 * @param completeCb 'selected' is undefined if the picker was closed
 */
function open(
	highlightShape?: Shape,
	matchCond?: boolean,
	mapObject?: MapObject,
	isConfig = false,
	completeCb?: (selected?: Shape) => void,
	onCopyCb?: (copied?: Shape) => void,
	onPasteCb?: () => void
) {
	highlight(highlightShape)
	cbCond.checked = matchCond

	dialog.elTitle.textContent = title + (isConfig ? ` (${mapObject ? "Editing " + mapObject.item.name : "Clipboard"})` : "")
	dialog.classList.toggle("clipboard", isConfig && !mapObject)

	onComplete = completeCb
	onClickCopy = onCopyCb
	onClickPaste = onPasteCb
	dialog.open()
}

function highlight(shapeOrSlot: Shape | HTMLElement) {
	highlightedShape = shapeOrSlot == null ? Shape.BLOCK
		: shapeOrSlot instanceof Shape
			? shapeOrSlot
			: Shape.getByValue(Number(shapeOrSlot.dataset.shape))
	for (const slot of elSlots)
		slot.classList.toggle("selected", slot.dataset.shape == highlightedShape.enumValue.toString())
}

const close = () => dialog.close()

export { cbCond, close, dialog, events, highlight, open }

