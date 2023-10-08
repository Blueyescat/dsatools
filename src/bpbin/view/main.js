const credits = `by <a href='https://github.com/Blueyescat' target='_blank'>Blueyescat</a>.`

import Zoomist from "zoomist"
import { loadHF } from "/main.js"
loadHF(credits)

const viewBp = document.getElementById("bp")
const buttonCopy = document.getElementById("button-copy")
const imgPreview = document.getElementById("preview-image")

let copyButtonTimer
buttonCopy.addEventListener("click", () => {
	navigator.clipboard.writeText(viewBp.textContent).then(() => {
		const w = buttonCopy.getBoundingClientRect().width
		buttonCopy.textContent = "Copied!"
		buttonCopy.style.width = w + "px"
		clearTimeout(copyButtonTimer)
		copyButtonTimer = setTimeout(() => {
			buttonCopy.textContent = "Copy String"
			buttonCopy.style.width = ""
		}, 1000)
	}).catch(console.error)
})

if (imgPreview.complete) imageReady()
else imgPreview.addEventListener("load", imageReady)

function imageReady() {
	if (!imgPreview.naturalWidth)
		return
	const previewZoomist = new Zoomist(".zoomist-container", {
		bounds: false,
		initScale: 1,
		minScale: 0.5,
		maxScale: 16
	})
	document.getElementById("button-reset-zoom").addEventListener("click", () => previewZoomist?.reset())
}
