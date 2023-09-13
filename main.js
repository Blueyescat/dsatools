export const usesTouch = matchMedia("(pointer: coarse)").matches || !!navigator.maxTouchPoints

const elHeader = document.getElementsByTagName("header")[0]
const elFooter = document.getElementsByTagName("footer")[0]

if (elHeader) await fetch("/assets/header.html").then(res => res.text()).then(html => {
	elHeader.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

if (elFooter) await fetch("/assets/footer.html").then(res => res.text()).then(html => {
	elFooter.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

document.querySelectorAll(".custom-file-input").forEach(el => {
	const input = el.querySelector("input")
	el.querySelector("button").addEventListener("click", () => input.click())
})

/* Dropdowns */
const openDropdowns = new Set()

function toggleDropdown(el, force) {
	const open = el.classList.toggle("open", force)
	if (open) openDropdowns.add(el)
	else openDropdowns.delete(el)
}

window.addEventListener(usesTouch ? "touchstart" : "mousedown", e => {
	const target = e.targetTouches ? e.changedTouches.item(0).target : e.target
	if (target.matches(".dropdown")) {
		toggleDropdown(target)
	} else {
		if (target.tagName == "A") return // code below may block the link, especially if touch
		for (const el of openDropdowns)
			el.classList.remove("open")
	}
})

window.addEventListener("focusin", e => {
	if (e.target.matches(".dropdown:not(.open)"))
		return toggleDropdown(e.target)
	openDropdowns.forEach(el => !el.contains(e.target) && toggleDropdown(el, false))
})

/* Tooltips */
export function addTooltip(el) {
	el.addEventListener(usesTouch ? "touchend" : "mouseenter", tooltipInteractionHandler, true)
}

function tooltipInteractionHandler() {
	const ref = this
	let space
	const allowHover = "allowHover" in ref.dataset
	const showAbove = "showAbove" in ref.dataset
	if (allowHover) {
		space = ref.getElementsByClassName("tooltip-space")[0]
		if (space) space.style.display = "block"
	}
	const content = ref.nextElementSibling
	if (usesTouch && content.style.display == "block")
		return closeTooltip(content, space)
	if (content.style.display == "block")
		return
	content.style.display = "block"

	const refRect = ref.getBoundingClientRect()
	const contRect = content.getBoundingClientRect()
	let x = refRect.left + (refRect.width / 2) - (contRect.width / 2)
	let y = refRect.top + (showAbove ? -contRect.height - 5 : refRect.height + 5)

	if (x <= 0) x = 1
	else if (x + contRect.width > window.innerWidth) x = window.innerWidth - contRect.width - 4
	if (y >= window.innerHeight) y = window.innerHeight
	else if (y + contRect.height >= window.innerHeight) y = window.innerHeight - contRect.height
	content.style.left = x + "px"
	content.style.top = y + "px"

	window.addEventListener("scroll", () => {
		closeTooltip(content, space)
	}, { once: true })

	if (usesTouch) {
		window.addEventListener("touchend", function closeHandler(e) {
			if (e.target != ref && !content.contains(e.target)) {
				closeTooltip(content, space)
				window.removeEventListener("touchend", closeHandler)
			}
		})
	} else {
		ref.addEventListener("mouseleave", function closeHandler(e) {
			if (e.relatedTarget == space)
				return space.addEventListener("mouseleave", closeHandler, { once: true })
			if (!allowHover || (allowHover && !content.contains(e.relatedTarget))) {
				if (elementContainsSelection(content)) // keep open if user selected text in content
					window.addEventListener("click", e => {
						if (!content.contains(e.target))
							closeTooltip(content, space)
					}, { once: true })
				else
					closeTooltip(content, space)
			} else {
				content.addEventListener("mouseleave", closeHandler, { once: true })
			}
		}, { once: true })
	}

	function closeTooltip(content, space) {
		content.style.display = ""
		if (space) space.style.display = ""
	}
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

/* Chips :has fallback for Firefox - synces radio :checked to its label */
if (!CSS.supports("selector(:has(*))")) {
	document.querySelectorAll(".radio-chips").forEach(chips => {
		chips.querySelectorAll("input").forEach(radio => {
			if (radio.checked)
				radio.parentElement.setAttribute("checked", "")
			radio.addEventListener("change", () =>
				chips.querySelectorAll("label").forEach(label =>
					label.toggleAttribute("data-chk", label == radio.parentElement) // radio here is the checked one
				)
			)
			radio.addEventListener("focus", () =>
				radio.parentElement.dataset.fcs = ""
			)
			radio.addEventListener("blur", () =>
				delete radio.parentElement.dataset.fcs
			)
		})
	})
}

/* Link range-number inputs */
document.querySelectorAll("[range-link-number]").forEach(rangeInput => {
	const numberInput = rangeInput.nextElementSibling
	rangeInput.addEventListener("input", () => {
		numberInput.value = rangeInput.value
		numberInput.dispatchEvent(new Event("change"))
	})
	numberInput.addEventListener("change", () =>
		rangeInput.value = numberInput.value
	)
})
