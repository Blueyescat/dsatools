const strgKey = "dsatools_inputs-" + globalThis.toolPath.split("/").pop()

if (document.readyState != "loading")
	main()
else
	document.addEventListener("DOMContentLoaded", main)

function main() {
	if (localStorage.getItem("dsatools_inputs-bpeditor")) {
		const old = localStorage.getItem("dsatools_inputs-bpeditor")
		if (!old.includes("#dialog-bpstring"))
			localStorage.setItem("dsatools_inputs-bptools", old)
	}

	let data = localStorage.getItem(strgKey)
	if (data) {
		try {
			data = JSON.parse(data)
			for (const path in data) {
				const el = document.querySelector(path
					+ (path.includes("type=\"radio\"")
						? `[value="${data[path]}"]`
						: ""
					)
				)
				if (!el) {
					delete data[path]
					continue
				}
				if (el.type == "checkbox" || el.type == "radio")
					el.checked = !!data[path]
				else
					el.value = data[path]
				el.dispatchEvent(new Event("input"))
				el.dispatchEvent(new Event("change"))
			}
			localStorage.setItem(strgKey, JSON.stringify(data))
		} catch (err) {
			console.error("Error with auto input loading", err)
		}
	}

	const elements = document.querySelectorAll("[data-save]")
	elements.forEach(el => {
		el.addEventListener(el.tagName == "TEXTAREA" ? "input" : "change", () => {
			const path = getPath(el)
			let data = localStorage.getItem(strgKey) ?? "{}"
			try { data = JSON.parse(data) } catch { data = {} }
			data[path] = el.value
			if (el.type == "checkbox")
				data[path] = el.checked
			else
				data[path] = el.value
			localStorage.setItem(strgKey, JSON.stringify(data))
		})
	})
}

function getPath(el) {
	const selectors = []
	let hasClass
	while (el) {
		if (el.tagName == "BODY") break
		if (el.id != "") {
			selectors.unshift("#" + el.id)
			break
		} else if (el.type == "radio" && el.name && el.dataset.save) {
			const p = el.dataset.save
			selectors.unshift(`${p} ${el.tagName.toLowerCase()}[type="${el.type}"][name="${el.name}"]`)
			hasClass = p.startsWith(".")
			if (hasClass)
				el = el.closest(p)
			else if (p.startsWith("#"))
				break
		} else if (el.className) {
			selectors.unshift(`.${el.className.replaceAll(" ", ".")}`)
			hasClass = true
		} else {
			selectors.unshift(hasClass ? "**"
				: `:nth-child(${Array.from(el.parentNode.children).indexOf(el) + 1})`)
		}
		el = el.parentNode
	}
	return selectors.join(">").replace(/(>\*\*)+>/g, " ")
}

export { }
