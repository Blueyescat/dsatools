const elMain = document.getElementsByTagName("main")[0]
let elCont: HTMLElement,
	elText: HTMLElement,
	elImg: HTMLImageElement

export function toggleThrobber(onOrText: boolean | string | null = false, darkenMain?: boolean) {
	if (!elCont) {
		elCont = document.createElement("div")
		elCont.id = "throbber"

		elImg = document.createElement("img")
		elImg.alt = "Loading"
		elImg.src = "/assets/icons/wheel.svg"
		elCont.appendChild(elImg)

		elCont.appendChild(elText = document.createElement("span"))

		document.body.appendChild(elCont)
	}
	elMain.style.filter = onOrText && darkenMain ? "brightness(0.6)" : ""
	elText.innerText = typeof onOrText == "string" ? onOrText : ""
	elCont.style.opacity = onOrText ? "1" : "0"
	elImg.style.display = onOrText ? "" : "none"
	if (onOrText)
		elCont.style.width = "unset"
	else
		setTimeout(() => elCont.style.width = "0", onOrText == null ? null : 300)
}
