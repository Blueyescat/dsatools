import { Dialog } from "./Dialog.js"
Dialog.defaultParent = document.getElementById("dialog-container")

export const usesTouch = matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches

export const pointerEvent = {
	down: usesTouch ? "touchstart" : "mousedown",
	move: usesTouch ? "touchmove" : "mousemove",
	up: usesTouch ? "touchend" : "mouseup",
	click: usesTouch ? "touchend" : "click",
	getValues(event: MouseEvent | TouchEvent) {
		const { clientX, clientY, target } = (event as TouchEvent).changedTouches?.[0] ?? event as MouseEvent
		return { clientX, clientY, target }
	}
} as const
export type pointerEvent = MouseEvent | TouchEvent

const supportsCssHas = CSS.supports("selector(:has(a))")

const elHeader = document.getElementsByTagName("header")[0],
	elFooter = document.getElementsByTagName("footer")[0]

if (elHeader) await fetch("/assets/header.html").then(res => res.text()).then(html => {
	elHeader.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

if (elFooter) await fetch("/assets/footer.html").then(res => res.text()).then(html => {
	elFooter.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

export function loadHF(credits?: string, title = document.title) {
	const dd = document.querySelector("#header-content nav .dropdown")
	elByCls(dd, "text").insertAdjacentHTML("afterbegin", location?.pathname == "/" ? "Tools" : title)
	for (const el of dd.querySelectorAll("ul>li>a")) {
		if (el.textContent == title) {
			el.classList.add("active")
			break
		}
	}
	if (credits)
		document.getElementById("credits").innerHTML = title + " " + credits
	return { header: elHeader, footer: elFooter }
}

export function showChangelog() {
	new Dialog({
		title: "<h3>Changelog</h3>",
		backdrop: true,
		body: /*html*/`
			<iframe src="/changelog.html" frameborder="0" style="width: 100%; height: 100%;"
				onload="new ResizeObserver(()=>this.style.height=this.contentWindow.document.documentElement.scrollHeight+'px').observe(this.contentWindow.document.body)"
			></iframe>
		`,
		footer: { closeButton: "Close" },
		removeOnClose: true,
		closeWhenClickedOutside: true,
		onCreate(dialog) {
			dialog.style.position = "fixed"
			dialog.style.width = "100%"
			dialog.style.maxWidth = "var(--page-width)"
			dialog.style.maxHeight = "80vh"
		},
	}).open()

	fetch("/changelog.html?noCache", { headers: { Range: "bytes=4-13" } })
		.then(r => r.text())
		.then(t => localStorage.setItem("dsatools_viewedChangelog", t))
}

document.getElementById("button-changelog")?.addEventListener("click", showChangelog)

const viewedChangelog = localStorage.getItem("dsatools_viewedChangelog")
if (navigator.serviceWorker.controller && (!viewedChangelog || sessionStorage.getItem("dsatools_showChangelog"))) {
	sessionStorage.removeItem("dsatools_showChangelog")
	// show if new changelog or hasn't viewed any
	if (viewedChangelog)
		fetch("/changelog.html?noCache", { headers: { Range: "bytes=4-13" } })
			.then(r => r.text())
			.then(t => viewedChangelog != t && showChangelog())
	else showChangelog()
}

/* Dropdowns */
const openDropdowns = new Set<HTMLElement>(),
	selFocusables = ":is(button, a)",
	selLiContainingFocusables = `:scope>li:not(.disabled)>:is(${selFocusables})`

let activeDropdownTrgg: HTMLElement,
	activeDropdownUl: HTMLElement

const closeAllDropdowns = () => Array.from(openDropdowns).reverse().forEach(t => toggleDropdown(t, false))

function toggleDropdown(elTrgg: HTMLElement, force?: boolean) {
	const isSub = elTrgg.matches(".dropdown ul .dropdown-trigger"),
		isSubMain = isSub && !(elTrgg.parentNode as HTMLElement).closest(".dropdown-trigger"),

		ul = isSub ? elTrgg.querySelector(":scope>ul") as HTMLElement : elTrgg.nextElementSibling as HTMLElement,

		isOpen = ul.style.display == "block",
		close = force != true && (force == false || (isOpen && !isSub))

	if (close && !isOpen)
		return ul

	if (close) {
		ul.style.display = "none"
		activeDropdownUl = elTrgg.closest(".dropdown ul")
		activeDropdownTrgg = activeDropdownUl ? activeDropdownUl.closest(".dropdown-trigger") ?? activeDropdownUl.previousElementSibling as HTMLElement : null
		openDropdowns.delete(elTrgg)
		delete elTrgg.dataset.open
		ul.style.removeProperty("left")
		ul.style.removeProperty("top")
		if (!isSub)
			elTrgg.blur()
	} else if (!isOpen && activeDropdownUl != ul) {
		ul.style.display = "block"
		ul.focus()
		if (isSubMain) {
			for (const t of openDropdowns) {
				if (t != elTrgg && t.matches(".dropdown ul .dropdown-trigger"))
					toggleDropdown(t, false)
			}
		} else if (isSub) {
			for (const t of openDropdowns) {
				if (t != elTrgg && elTrgg.contains(t) && t.matches(".dropdown ul .dropdown-trigger"))
					toggleDropdown(t, false)
			}
		} else {
			closeAllDropdowns()
		}
		activeDropdownUl = ul
		activeDropdownTrgg = elTrgg
		openDropdowns.add(elTrgg)
		elTrgg.dataset.open = ""
		const rect = ul.getBoundingClientRect()
		if (rect.left <= 0)
			ul.style.left = 5 + "px"
		if (rect.right >= screen.width)
			ul.style.left = (screen.width - rect.right - 5) + "px"
		if (rect.bottom >= screen.height)
			ul.style.top = (screen.height - rect.bottom) + "px"
	}
	return ul
}

function handleDropdownItemClick(el: HTMLElement, aux?: boolean) {
	const b = el.querySelector<HTMLElement>(selFocusables + ":not(.disabled)")
	if (b) {
		if (aux && b.tagName == "A")
			window.open((b as HTMLAnchorElement).href, "_blank")
		else
			b.click()
		closeAllDropdowns()
	}
}

window.addEventListener(pointerEvent.click, e => {
	const target = (e.target) as HTMLElement
	if (target.matches(".dropdown>.dropdown-trigger"))
		toggleDropdown(target)
	else if (target.matches(".dropdown li:not(.dropdown-trigger)"))
		handleDropdownItemClick(target)
	else if (!target.closest(".dropdown"))
		closeAllDropdowns()
})

window.addEventListener("auxclick", e => {
	if (e.target instanceof HTMLElement && e.target.matches(".dropdown li:not(.dropdown-trigger)"))
		handleDropdownItemClick(e.target, true)
})

window.addEventListener(usesTouch ? "touchend" : "mouseover", e => {
	const trgg = ((e as TouchEvent).changedTouches?.[0].target ?? e.target) as HTMLElement
	if (!trgg) return

	if (!supportsCssHas && e.type == "mouseover" && trgg.matches(".dropdown ul li"))
		trgg.style.cursor = (trgg.firstChild as HTMLElement)?.classList?.contains("disabled") ? "default" : ""

	if (trgg.matches(".dropdown ul .dropdown-trigger")) {
		const ul = toggleDropdown(trgg, true)
		if (e.type == "mouseover") {
			let closeTimer: number

			const enterUlHandler = () => {
				clearTimeout(closeTimer)
				trgg.removeEventListener("mouseleave", leaveTrggHandler)
				trgg.removeEventListener("mouseover", enterTrggBackHandler)
			}

			const enterTrggBackHandler = () => clearTimeout(closeTimer)

			const leaveTrggHandler = () => {
				closeTimer = setTimeout(() => {
					toggleDropdown(trgg, false)
					ul.removeEventListener("mouseover", enterUlHandler)
					trgg.removeEventListener("mouseover", enterTrggBackHandler)
				}, 1000)
			}

			trgg.addEventListener("mouseleave", leaveTrggHandler, { once: true })
			ul.addEventListener("mouseover", enterUlHandler, { once: true })
			trgg.addEventListener("mouseover", enterTrggBackHandler, { once: true })
		}
		if (activeDropdownTrgg && activeDropdownTrgg != trgg && !activeDropdownTrgg.contains(trgg))
			toggleDropdown(activeDropdownTrgg, false)
		activeDropdownTrgg = trgg
	} else if (e.type == "mouseover" && activeDropdownTrgg && trgg.matches(".dropdown>.dropdown-trigger")) {
		toggleDropdown(trgg, true)
	}
})

window.addEventListener("keydown", e => {
	if (!activeDropdownTrgg) return
	/* if (e.key == "Tab")
		e.preventDefault() */
	const isMainDropdown = activeDropdownTrgg.matches(selFocusables)
	if (activeDropdownUl) {
		const ul = activeDropdownUl,
			items = Array.from(ul.querySelectorAll<HTMLElement>(selLiContainingFocusables)),
			curr = document.activeElement as HTMLElement,
			currIndex = items.indexOf(curr)

		if (e.key == "ArrowDown" || e.key == "ArrowUp") {
			items[
				e.key == "ArrowDown"
					? currIndex == items.length - 1 ? 0 : currIndex + 1
					: currIndex <= 0 ? items.length - 1 : currIndex - 1
			]?.focus()
		} else if (e.key == "ArrowRight" || e.key == "Enter") {
			const li = curr.closest<HTMLElement>(".dropdown-trigger")
			if (li) {
				const newUl = toggleDropdown(li, true)
				activeDropdownTrgg = li
				newUl.querySelector<HTMLElement>(selLiContainingFocusables)?.focus()
			} else if (isMainDropdown && e.key != "Enter") {
				handleMain(activeDropdownTrgg, true)
			}
		} else if (e.key == "ArrowLeft") {
			const trgg = activeDropdownTrgg;
			(isMainDropdown ? trgg : trgg.querySelector<HTMLElement>(selFocusables)).focus()
			toggleDropdown(trgg, false)
			if (isMainDropdown)
				handleMain(trgg, false)
		} else if (e.key == "Escape") {
			closeAllDropdowns()
		}
	}

	function handleMain(trgg: HTMLElement, toRight?: boolean) {
		const cont = trgg.parentElement.parentElement,
			triggers = Array.from(cont.querySelectorAll<HTMLElement>(".dropdown>.dropdown-trigger")),
			currIndex = triggers.indexOf(trgg),
			ul = toggleDropdown(triggers[
				toRight
					? currIndex == triggers.length - 1 ? 0 : currIndex + 1
					: currIndex <= 0 ? triggers.length - 1 : currIndex - 1
			], true)
		ul.querySelector<HTMLElement>(":not(.disabled)>" + selFocusables)?.focus()
	}
})

window.addEventListener("blur", closeAllDropdowns)

/* Tooltips */
const tooltipContainer = document.createElement("div")
let tooltipTouchTimer
let tooltipIsHoldingTouch = false
tooltipContainer.id = "tooltip-container"
document.body.append(tooltipContainer)

if (usesTouch) {
	window.addEventListener("touchstart", e => {
		tooltipIsHoldingTouch = !tooltipIsHoldingTouch

		let target = e.changedTouches[0]?.target as HTMLElement
		if (!target.classList.contains("tooltip-ref")) {
			target = target.closest(".tooltip-ref")
			if (!target)
				return
		}

		tooltipTouchTimer = setTimeout(() => {
			if (tooltipIsHoldingTouch)
				handleTooltipInteraction(e, target, true)
		}, 500)
	})

	window.addEventListener("touchend", () => {
		clearTimeout(tooltipTouchTimer)
		tooltipIsHoldingTouch = false
	})

	window.addEventListener("touchmove", e => {
		const touch = e.changedTouches[0]
		const actualTarget = document.elementFromPoint(touch?.clientX, touch?.clientY)
		if (actualTarget != e.target) {
			clearTimeout(tooltipTouchTimer)
			tooltipIsHoldingTouch = false
		}
	})
}

export function addTooltip(ref) {
	ref.addEventListener(usesTouch ? "touchend" : (("clickTriggered" in ref.dataset) ? "click" : "mouseenter"), handleTooltipInteraction, true)
}
export function removeTooltipListener(ref) {
	ref.removeEventListener(usesTouch ? "touchend" : (("clickTriggered" in ref.dataset) ? "click" : "mouseenter"), handleTooltipInteraction, true)
}
export function forceCloseTooltip(ref) {
	trigger(ref, usesTouch ? "touchend" : "mouseleave")
}

document.querySelectorAll(".tooltip-ref").forEach(addTooltip)

function handleTooltipInteraction(this: HTMLElement | void, e, target: HTMLElement, isLongTouch) {
	let ttpCloseHandler
	const ref = target ?? this as HTMLElement

	const longTouchActive = usesTouch && ("longTouch" in ref.dataset)

	if (usesTouch && e.type == "touchend" && !longTouchActive) {
		const touch = e.changedTouches?.[0]
		if (touch) {
			const actualTarget = document.elementFromPoint(touch.clientX, touch.clientY)
			if (ref != actualTarget && !ref.contains(actualTarget))
				return
		}
	}

	if (isLongTouch && longTouchActive)
		return

	const originalContent = elByCls(ref, "tooltip-content")
	if (!originalContent)
		return

	const allowHover = "allowHover" in ref.dataset,
		showAbove = "showAbove" in ref.dataset,
		showRight = "showRight" in ref.dataset,
		useClone = "clone" in ref.dataset

	if (useClone && ref.dataset.clone == "1")
		return

	const content = useClone ? originalContent.cloneNode(true) as HTMLElement : originalContent

	if (content.style.display == "block")
		return

	let space
	if (allowHover) {
		space = elByCls(ref, "tooltip-space")
		if (space) space.style.display = "block"
	}

	if (longTouchActive && e.type == "touchend")
		closeTooltip(content, space, true)

	if (usesTouch && ("onlyLongT" in ref.dataset) && !isLongTouch)
		return

	if (useClone) {
		tooltipContainer.appendChild(content)
		ref.dataset.clone = "1"
	}

	if (content.style.display == "block")
		return

	content.style.display = "block"
	if (isLongTouch)
		ref.dataset.longTouch = ""

	reposTooltip(ref, content, showAbove, showRight)

	window.addEventListener("scroll", () => closeTooltip(content, space), { once: true })

	if (usesTouch) {
		ttpCloseHandler = e => {
			if (ref.contains(e.target))
				return closeTooltip(content, space)
			if (e.target == space)
				return window.addEventListener("touchend", ttpCloseHandler, { once: true })
			if (!allowHover || (allowHover && !content.contains(e.target))) {
				if (elementContainsSelection(content)) { // keep open if user selected text in content
					window.addEventListener("touchend", e => {
						if (!content.contains(e.target as HTMLElement))
							closeTooltip(content, space)
					}, { once: true })
				} else
					closeTooltip(content, space)
			} else {
				window.addEventListener("touchend", ttpCloseHandler, { once: true })
			}
		}
		setTimeout(() => window.addEventListener("touchend", ttpCloseHandler, { once: true }))

		void (async () => {
			// for touches, check if something hid the ref element after opening the tooltip
			for (let t = 0; t < 5; t++) {
				await new Promise(r => setTimeout(r, 30))
				if (!ref.offsetParent) {
					closeTooltip(content, space)
					window.removeEventListener("touchend", ttpCloseHandler)
					break
				}
			}
		})()
	} else {
		ttpCloseHandler = e => {
			if (ref.contains(e.relatedTarget))
				return ref.addEventListener("mouseleave", ttpCloseHandler, { once: true })
			if (e.relatedTarget && e.relatedTarget == space)
				return space.addEventListener("mouseleave", ttpCloseHandler, { once: true })
			if (!allowHover || (allowHover && !content.contains(e.relatedTarget))) {
				if (elementContainsSelection(content)) { // keep open if user selected text in content
					content.addEventListener("mouseleave", ttpCloseHandler, { once: true })
					window.addEventListener("click", e => {
						if (!content.contains(e.target as HTMLElement))
							closeTooltip(content, space)
					}, { once: true })
				} else
					closeTooltip(content, space)
			} else {
				content.addEventListener("mouseleave", ttpCloseHandler, { once: true })
			}
		}
		ref.addEventListener("mouseleave", ttpCloseHandler, { once: true })
	}

	function closeTooltip(content: HTMLElement, space: HTMLElement, longTouch?: boolean) {
		if (usesTouch)
			window.removeEventListener("touchend", ttpCloseHandler)
		else
			ref.removeEventListener("mouseleave", ttpCloseHandler)
		if (useClone) {
			ref.dataset.clone = ""
			content.remove()
		} else
			content.style.display = ""
		if (longTouch)
			setTimeout(() => delete ref.dataset.longTouch, 100)
		if (space)
			space.style.display = ""
	}
}

export function reposTooltip(ref: HTMLElement, content: HTMLElement,
	showAbove = "showAbove" in ref.dataset,
	showRight = "showRight" in ref.dataset
) {
	const refRect = ref.getBoundingClientRect(), contRect = content.getBoundingClientRect()

	let x = refRect.left + (showRight ? refRect.width + 5 : (refRect.width / 2) - (contRect.width / 2))
	let y = refRect.top + (showAbove ? -contRect.height - 5 : (showRight ? 0 : refRect.height + 5))
	if (x <= 0)
		x = 1
	else if (x + contRect.width > screen.width)
		x = screen.width - contRect.width - 4

	if (y >= screen.height)
		y = screen.height
	else if (y + contRect.height >= screen.height)
		y = screen.height - contRect.height
	else if (y - contRect.height < 0)
		y = refRect.top + (showRight ? 0 : refRect.height + 5)

	content.style.left = x + "px"
	content.style.top = y + "px"
}

function elementContainsSelection(el) {
	const sel = window.getSelection()
	if (sel.type != "Range" || sel.rangeCount < 1)
		return false
	for (let i = 0; i < sel.rangeCount; ++i) {
		if (!el.contains(sel.getRangeAt(i).commonAncestorContainer))
			return false
	}
	return true
}

/* Chips :has fallback for Firefox <121 - synces radio :checked to its label */
export function updateChips(chips: Element, checkedRadio: HTMLInputElement) {
	if (!supportsCssHas)
		chips.querySelectorAll("label").forEach(label =>
			label.toggleAttribute("data-chk", label == checkedRadio.parentElement)
		)
}
if (!supportsCssHas) {
	document.querySelectorAll(".radio-chips").forEach(chips => {
		chips.querySelectorAll("input").forEach(radio => {
			if (radio.checked)
				radio.parentElement.setAttribute("data-chk", "")
			chips.addEventListener("change", () =>
				updateChips(chips, radio)
			)
		})
	})
	window.addEventListener("change", e => {
		const radio = e.target as HTMLInputElement
		if (radio.matches(".radio-chips input")) {
			const chips = radio.parentElement.parentElement
			updateChips(chips, radio)
		}
	})
	window.addEventListener("focus", e => {
		if ((e.target as HTMLElement).matches(".radio-chips input"))
			(e.target as HTMLElement).parentElement.dataset.fcs = ""
	}, true)
	window.addEventListener("blur", e => {
		if ((e.target as HTMLElement)?.matches(".radio-chips input"))
			delete (e.target as HTMLElement).parentElement.dataset.fcs
	}, true)
}

/* Link range-number inputs */
export function linkRangeNumber(rangeInput: HTMLInputElement) {
	const numberInput = rangeInput.nextElementSibling as HTMLInputElement
	if (numberInput.value == "")
		numberInput.value = rangeInput.value
	rangeInput.addEventListener("input", () => {
		numberInput.value = rangeInput.value
		trigger(numberInput, "input")
		trigger(numberInput, "change")
	})
	numberInput.addEventListener("input", () => rangeInput.value = numberInput.value)
}

document.querySelectorAll("[range-link-number]").forEach(linkRangeNumber)

/* Shake */
export function shakeElement(el) {
	if (!el) return
	el.classList.add("shake")
	setTimeout(() => el.classList.remove("shake"), 155)
}

/* Tri-CB */
export function switchTriStateCb(cb: HTMLInputElement, force?: boolean | null | "clear", forceUndefIsNull?: boolean) {
	if (!cb) return

	const label = ("useLabel" in cb.dataset) ? cb.nextElementSibling : undefined,
		props = window.getComputedStyle(label ?? cb),
		titleNull = props.getPropertyValue("--tricb-null").slice(1, -1),
		titleFalse = props.getPropertyValue("--tricb-false").slice(1, -1),
		noTitle = !cb.title.startsWith("State: ")

	if (force == "clear")
		return cb.title = noTitle ? "" : "State: " + titleNull, cb.checked = false, delete cb.dataset.state

	if (forceUndefIsNull && force === undefined)
		force = null

	let state = force !== undefined ? force : (cb.dataset.state == "true" ? false : (cb.dataset.state == "false" ? null : true))
	if (titleFalse == "" && state == false)
		state = null

	cb.dataset.state = String(state)
	cb.checked = state == true
	if (noTitle) {
		delete cb.title
	} else {
		const titleTrue = props.getPropertyValue("--tricb-true").slice(1, -1)
		cb.title = `State: ${state == true ? titleTrue : state == false ? titleFalse : titleNull}`
	}
	return state as boolean | null
}

/* Util */
export function elByCls<T extends HTMLElement | SVGElement = HTMLElement>(src: Element, classNames: string) {
	return src.getElementsByClassName(classNames)[0] as T
}

export function trigger(targets: EventTarget | EventTarget[], eventName: keyof HTMLElementEventMap, options?: EventInit, custom?: boolean) {
	Array.isArray(targets)
		? targets.forEach(target => triggerSingle(target, eventName, options, custom))
		: triggerSingle(targets, eventName, options, custom)
}

export function triggerCustom(targets: EventTarget | EventTarget[], eventName: string, options?: CustomEventInit) {
	trigger(targets, eventName as any, options, true)
}

function triggerSingle(target: EventTarget, eventName: string, options?: CustomEventInit, custom?: boolean) {
	target.dispatchEvent(new (custom ? CustomEvent : Event)(eventName, options))
}
