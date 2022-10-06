const elHeader = document.querySelector("header")
const elFooter = document.querySelector("footer")

export const usesTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints

await fetch("./header.html").then(res => res.text()).then(html => {
	elHeader.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

await fetch("./footer.html").then(res => res.text()).then(html => {
	elFooter.insertAdjacentHTML("beforeend", html)
}).catch(console.error)

document.querySelectorAll(".custom-file-input").forEach(el => {
	let input = el.querySelector("input")
	el.querySelector("button").addEventListener("click", () => input.click())
})

/* Dropdowns */
const openDropdowns = new Set()
window.addEventListener(usesTouch ? "touchend" : "click", async function (event) {
	let target = event.targetTouches ? event.changedTouches.item(0).target : event.target
	if (target.matches(".dropdown")) {
		// let dropdown = target.parentElement
		let open = target.classList.toggle("open")
		if (open) openDropdowns.add(target)
		else openDropdowns.delete(target)
	} else {
		if (target.tagName == "A") return // code below may block the link, especially if touch
		for (const el of openDropdowns) {
			el.classList.remove("open")
		}
	}
})

/* Tooltips */
export function addTooltip(el) {
	el.addEventListener(usesTouch ? "touchend" : "mouseenter", tooltipInteractionHandler, true)
}

function tooltipInteractionHandler() {
	let ref = this, space
	let allowHover = "allowHover" in ref.dataset
	if (allowHover) {
		space = ref.getElementsByClassName("tooltip-space")[0]
		if (space) space.style.display = "block"
	}
	let content = ref.nextElementSibling
	if (usesTouch && content.style.display == "block") return closeTooltip(content, space)
	content.style.display = "block"
	let refRect = ref.getBoundingClientRect()
	let contRect = content.getBoundingClientRect()
	let x = refRect.left + (refRect.width / 2) - (contRect.width / 2)
	let y = refRect.top + refRect.height + 5
	if (x <= 0) x = 1
	else if (x + contRect.width > window.innerWidth) x = window.innerWidth - contRect.width - 4
	if (y >= window.innerHeight) y = window.innerHeight
	else if (y + contRect.height >= window.innerHeight) y = window.innerHeight - contRect.height
	content.style.left = x + "px"
	content.style.top = y + "px"

	window.addEventListener("scroll", function () {
		closeTooltip(content, space)
	}, { once: true })

	if (usesTouch) {
		window.addEventListener("touchend", function closeHandler(event) {
			if (event.target != ref && !content.contains(event.target)) {
				closeTooltip(content, space)
				window.removeEventListener("touchend", closeHandler)
			}
		})
	} else {
		ref.addEventListener("mouseleave", function closeHandler(event) {
			if (!allowHover || (allowHover && !content.contains(event.toElement))) {
				if (elementContainsSelection(content))
					window.addEventListener("click", function () { closeTooltip(content, space) }, { once: true })
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
	var sel = window.getSelection()
	if (sel.rangeCount > 0) {
		for (var i = 0; i < sel.rangeCount; ++i) {
			if (!el.contains(sel.getRangeAt(i).commonAncestorContainer)) {
				return false
			}
		}
		return true
	}
	return false
}
