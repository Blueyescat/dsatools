const strgKey = "dsatools_inputs-" + globalThis.toolPath.split("/").pop()

if (document.readyState != "loading")
	main()
else
	document.addEventListener("DOMContentLoaded", main)

function main() {
	let data = localStorage.getItem(strgKey)
	if (data) {
		try { data = JSON.parse(data) } catch {/**/ }
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
			el.dispatchEvent(new Event(el.tagName == "TEXTAREA" ? "input" : "change"))
		}
		localStorage.setItem(strgKey, JSON.stringify(data))
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
	while (el) {
		if (el.tagName == "BODY") break
		let path
		if (el.id != "") {
			path = "#" + el.id
			selectors.unshift(path)
			break
		} else if (el.type == "radio" && el.name) {
			path = `#${el.dataset.save} ${el.tagName.toLowerCase()}[type="${el.type}"][name="${el.name}"]`
			selectors.unshift(path)
			break
		} else {
			path = `:nth-child(${Array.from(el.parentNode.children).indexOf(el) + 1})`
			selectors.unshift(path)
		}
		el = el.parentNode
	}
	return selectors.join(">")
}
