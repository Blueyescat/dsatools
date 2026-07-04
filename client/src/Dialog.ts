import { pointerEvent, triggerCustom, usesTouch } from "./main.js"

export interface DialogOptions {
	id?: string
	parent?: HTMLElement
	title?: string
	body?: string | HTMLElement | Array<string | HTMLElement>
	footer?: {
		html?: string
		closeButton?: string | { html: string, right: boolean }
	}
	className?: string
	onCreate?: (dialog: Dialog) => void
	draggable?: { key: string }
	defaultPos?: { left: string, top: string }
	removeOnClose?: boolean
	closeWhenClickedOutside?: boolean
	backdrop?: boolean
}

type Listener<T extends keyof HTMLElementEventMap, E extends EventTarget> = {
	target: E
	type: T
	fn: (this: E, e: HTMLElementEventMap[T]) => void
}

const KEY_CLOSE = "Escape",
	DRAG_MIN_VISIBLE_PX = usesTouch ? 40 : 20,
	// DEF_TRANSFORM = "translate(-50%, -50%)",
	MIN_X = 38,
	MIN_Y = 33

if (!usesTouch)
	window.addEventListener("keydown", e => {
		if (e.code == KEY_CLOSE && (
			document.activeElement == document.body
			|| document.activeElement.closest("dt-dialog")
		)) {
			let len = Dialog.openDialogs.length
			if (len) {
				Dialog.openDialogs[--len].close()
				Dialog.openDialogs[--len]?.elBody.focus()
			}
		}
	})

// local storage
const toolid = globalThis.toolPath?.split("/").pop() ?? "main",
	strgKey = "dsatools_dialogs-" + toolid,
	strgKeyDragPos = "pos"

let data: object
try { data = JSON.parse(localStorage.getItem(strgKey) ?? "{}") }
catch { data = {} }
const saveData = () => {
	delete data["sortedbp"] // old
	localStorage.setItem(strgKey, JSON.stringify(data))
}

const setDragPos = (key: string, x: number, y: number) => (data[key] ??= {})[strgKeyDragPos] = { x, y }
const getDragPos = (key: string): { x: number, y: number } => data[key]?.[strgKeyDragPos]

export class Dialog extends HTMLElement {
	static localName = "dt-dialog"
	static dialogs: Dialog[] = []
	static openDialogs: Dialog[] = []
	static defaultParent = document.body
	static highestZ = 900
	static frontDialog: Dialog

	listeners = [] as Listener<keyof HTMLElementEventMap, EventTarget>[]

	elTitle: HTMLHeadingElement
	elHeader: HTMLElement
	elBody: HTMLElement
	elFooter: HTMLElement

	declare draggableKey: string
	declare defaultPos: DialogOptions["defaultPos"]
	declare defaultPosFirstOpen: boolean
	declare removeOnClose: boolean
	declare closeWhenClickedOutside: boolean

	constructor({ id, parent = Dialog.defaultParent, title, body, footer, className, onCreate, draggable, defaultPos, removeOnClose, closeWhenClickedOutside, backdrop }: DialogOptions = {}) {
		super()
		Dialog.dialogs.push(this)
		this.tabIndex = 0

		if (defaultPos)
			Object.assign(this.style, this.defaultPos = defaultPos)

		if (id != null) this.id = id

		// title
		this.elTitle = document.createElement("h4")
		this.elTitle.className = "title"
		if (title != null)
			this.elTitle.innerHTML = title

		// close button
		const elButtonClose = document.createElement("button")
		elButtonClose.className = "button-close"
		elButtonClose.innerHTML = `<i class="i x"></i>`
		this.addListener({ target: elButtonClose, type: "click", fn: () => this.close() })

		// header
		const elHeader = this.elHeader = document.createElement("div")
		elHeader.className = "header"
		elHeader.tabIndex = 0
		elHeader.append(this.elTitle, elButtonClose)

		// draggable
		if (draggable?.key) {
			const savedPos = getDragPos(draggable.key)
			this.draggableKey = draggable.key
			/* if (savedPos && !this.defaultPos)
				this.style.removeProperty("transform") */
			if (!savedPos && this.defaultPos)
				this.defaultPosFirstOpen = true
			this.addListener({
				target: elHeader, type: pointerEvent.down, fn: e =>
					e.target == elHeader && (this.#startDrag(e), elHeader.focus())
			})

			if (usesTouch) {
				let dblClkLastAt = 0
				this.addListener({
					target: elHeader, type: "touchend", fn: () => {
						const now = Date.now()
						if (now - dblClkLastAt <= 350) { // DBL_CLK_TIME
							this.#resetDrag()
							this.bringToFront()
						}
						dblClkLastAt = now
					}
				})
			} else {
				this.addListener({ target: elHeader, type: "dblclick", fn: () => this.#resetDrag() })
			}
		}

		// body
		const elBody = this.elBody = document.createElement("div")
		elBody.className = "body"
		elBody.tabIndex = 0
		if (body != null) {
			for (const thing of Array.isArray(body) ? body : [body]) {
				if (typeof thing == "string")
					elBody.insertAdjacentHTML("beforeend", thing)
				else if (thing instanceof HTMLElement)
					elBody.appendChild(thing)
			}
		}

		// footer
		if (footer != null) {
			const elFooter = this.elFooter = document.createElement("div")
			elFooter.className = "footer"
			elFooter.tabIndex = 0

			if (footer.closeButton) {
				const elFooterButtonClose = document.createElement("button")
				elFooterButtonClose.className = "button-close"
				if (typeof footer.closeButton == "string")
					elFooterButtonClose.innerHTML = footer.closeButton
				else {
					elFooterButtonClose.innerHTML = footer.closeButton.html
					if (footer.closeButton.right) {
						elFooterButtonClose.style.order = "1"
						elFooterButtonClose.style.marginLeft = "9px"
					}
				}
				this.addListener({ target: elFooterButtonClose, type: "click", fn: () => this.close() })
				elFooter.appendChild(elFooterButtonClose)
			}

			if (footer.html)
				elFooter.insertAdjacentHTML("beforeend", footer.html)
		}

		// className
		if (className != null)
			this.className = className

		this.append(elHeader, elBody)
		if (this.elFooter)
			this.append(this.elFooter)

		// onCreate
		onCreate?.(this)

		// removeOnClose
		if (removeOnClose)
			this.removeOnClose = true

		// closeW
		if (closeWhenClickedOutside)
			this.closeWhenClickedOutside = true

		if (backdrop)
			this.classList.add("backdrop")

		if (!parent)
			console.error("Dialog parent not found", parent)
		parent.appendChild(this)
	}

	open(noFocus?: boolean) {
		if (!Dialog.openDialogs.includes(this))
			Dialog.openDialogs.push(this)

		for (const lstnr of this.listeners)
			lstnr.target.addEventListener(lstnr.type, lstnr.fn)
		this.style.display = "flex"
		this.bringToFront()
		triggerCustom(this, "open")

		if (this.draggableKey) {
			const savedPos = getDragPos(this.draggableKey)
			if (savedPos) {
				this.style.left = savedPos.x + "px"
				this.style.top = savedPos.y + "px"
			}

			if (this.defaultPosFirstOpen) {
				delete this.defaultPosFirstOpen
				let changed: boolean
				if (this.offsetLeft + this.offsetWidth > this.parentElement.offsetWidth + DRAG_MIN_VISIBLE_PX * 2) {
					this.style.left = MIN_X + "px"
					changed = true
				}
				if (this.offsetTop + this.offsetHeight > this.parentElement.offsetHeight + DRAG_MIN_VISIBLE_PX * 2) {
					this.style.top = MIN_Y + "px"
					changed = true
				}
				if (changed) {
					setDragPos(this.draggableKey, this.offsetLeft, this.offsetTop)
					saveData()
				}
			}

			ensureVisibility(this)
		}

		if (this.closeWhenClickedOutside)
			setTimeout(() => {
				this.addListener({
					target: window,
					type: "click", // Note: mouse down inside dialog, up outside will trigger this
					fn: e => {
						if (!this.contains(e.target as HTMLElement))
							this.close()
					}
				})
			})

		if (!noFocus)
			this.elBody.focus()
		return this
	}

	close() {
		const i = Dialog.openDialogs.indexOf(this)
		if (i > -1)
			Dialog.openDialogs.splice(i, 1)

		for (const lstnr of this.listeners)
			lstnr.target.removeEventListener(lstnr.type, lstnr.fn)
		this.style.removeProperty("display")
		triggerCustom(this, "close")

		if (this.removeOnClose)
			this.remove()

		/* if (data[this.draggableKey]?.[strgKeyDragPos])
			this.style.transform = "" */
	}

	toggle() {
		return this.isOpen ? this.close() : this.open()
	}

	get isOpen() {
		return this.style.display == "flex"
	}

	hasFocus(excludeInnerElements = false) {
		const active = document.activeElement
		return active == this.elHeader || active == this.elBody || active == this.elFooter
			|| (!excludeInnerElements && this.contains(active))
	}

	bringToFront(openDialogIndex?: number) {
		if (this != Dialog.frontDialog) {
			this.style.zIndex = (++Dialog.highestZ).toString()
			Dialog.frontDialog = this
			if (openDialogIndex != null)
				Dialog.openDialogs.push(Dialog.openDialogs.splice(openDialogIndex, 1)[0])
		}
	}

	#startDrag(e: pointerEvent) {
		e.preventDefault()
		this.dataset.dragging = ""

		const { style, parentElement, elTitle } = this
		const rect = this.getBoundingClientRect()
		const coords = pointerEvent.getValues(e)
		const offX = coords.clientX - rect.left,
			offY = coords.clientY - rect.top

		const moveHandler = (e: TouchEvent) => {
			e.preventDefault()
			const coords = pointerEvent.getValues(e)
			const x = Math.min(parentElement.offsetWidth - DRAG_MIN_VISIBLE_PX, Math.max(-rect.width + DRAG_MIN_VISIBLE_PX * 2, coords.clientX - offX)),
				y = Math.min(Math.min(window.innerHeight, parentElement.offsetHeight) - elTitle.offsetTop - elTitle.offsetHeight, Math.max(-elTitle.offsetTop + 5, coords.clientY - offY))
			style.left = x + "px"
			style.top = y + "px"
			setDragPos(this.draggableKey, x, y)
		}
		window.addEventListener(pointerEvent.move, moveHandler)
		window.addEventListener(pointerEvent.up, () => {
			window.removeEventListener(pointerEvent.move, moveHandler)
			if (style.left)
				saveData()
			delete this.dataset.dragging
		}, { once: true })
	}

	#resetDrag() {
		if (data[this.draggableKey]) {
			if (this.defaultPos)
				Object.assign(this.style, this.defaultPos)
			else {
				this.style.removeProperty("top")
				this.style.removeProperty("left")
			}
			delete data[this.draggableKey] //?.[strgKeyDragPos]
			saveData()
		}
	}

	addListener<T extends keyof HTMLElementEventMap, E extends EventTarget>(listener: Listener<T, E>) {
		this.listeners.push(listener)
		listener.target.addEventListener(listener.type, listener.fn)
	}
}

customElements.define(Dialog.localName, Dialog)

function ensureVisibility(dialog: Dialog) {
	if (dialog.style.left == "")
		return

	if (dialog.offsetLeft > dialog.parentElement.offsetWidth - DRAG_MIN_VISIBLE_PX
		|| dialog.offsetLeft + dialog.offsetWidth < DRAG_MIN_VISIBLE_PX * 2
	)
		dialog.style.left = MIN_X + "px"

	if (dialog.offsetTop + dialog.elTitle.offsetTop + dialog.elTitle.offsetHeight > dialog.parentElement.offsetHeight
		|| dialog.offsetTop < dialog.elTitle.offsetTop
	)
		dialog.style.top = MIN_Y + "px"
}

window.addEventListener("resize", () => Dialog.dialogs.forEach(dialog => ensureVisibility(dialog)))

window.addEventListener("focus", () => {
	const i = Dialog.openDialogs.findIndex(d => d.hasFocus())
	if (i != -1)
		Dialog.openDialogs[i].bringToFront(i)
}, true)
