const tool = {
	name: "Image to Pixel Art",
	credits: `by <a href='https://github.com/Blueyescat' target='_blank'>Blueyescat</a>,
			inspired by <a href='https://github.com/ivstiv/pixelart-converter' target='_blank'>pixelart-converter</a>`
}

import { usesTouch, addTooltip } from "../main.js"
const Pica = new window.pica()

globalThis.toolPath = import.meta.url.substring(0, import.meta.url.lastIndexOf("/"))

let worker
if ("OffscreenCanvas" in window) worker = new Worker(globalThis.toolPath + "/worker.js")
else await import(globalThis.toolPath + "/converter.js")

const container = document.querySelector("#main-container")
const inputFile = container.querySelector(".input-file>input")
const inputWidth = container.querySelector(".input-width")
const inputHeight = container.querySelector(".input-height")
const cbUseTurretScale = container.querySelector(".cb-use-turret-scale")
const cbDrawPaintId = container.querySelector(".cb-paint-id")
const cbDrawPaintShape = container.querySelector(".cb-paint-shape")
const inputCoordX = container.querySelector(".input-coord-x")
const inputCoordY = container.querySelector(".input-coord-y")
const inputPixelSize = container.querySelector(".input-pixel-size")
const inputFontSize = container.querySelector(".input-font-size")
const selectColorSpace = container.querySelector(".select-color-space")
const buttonProcess = container.querySelector(".button-process")
const buttonShowResized = container.querySelector(".button-show-resized")
const imgFilePreview = container.querySelector(".file-preview>img")
const elFilePreviewName = container.querySelector(".file-preview>.name")
const elFilePreviewSize = container.querySelector(".file-preview>.size")
const elResultContainer = container.querySelector(".result-container")
const elResult = elResultContainer.querySelector(".result-container .result")
const elNotice = container.querySelector(".notice")
const elResultInfo = container.querySelector(".result-info")
const elResultHeading = container.querySelector(".result-heading")
const elResultSquare = document.querySelector(".result-hover-square")
const elResultSquareCoords = elResultSquare.querySelector(".coords")

const canvas = document.createElement("canvas")
const canvasCtx = canvas.getContext("2d")

let noticeTimeoutId, resultZoomist, resultDragging, resizedImageBlob
let hasSetWidth, hasSetHeight, hasChosenImage
let displayPixelSize, displayWidth, displayHeight, displayPaintHeight
let inShipCoordX = 1, inShipCoordY = 1
let resizeCache = {}
let image = new Image()

window.addEventListener("paste", function (event) {
	let file = event.clipboardData.files?.[0]
	if (!file || !file.type.includes("image/")) return
	const dt = new DataTransfer()
	dt.items.add(file)
	inputFile.files = dt.files
	inputFile.dispatchEvent(new Event("change"))
})

window.addEventListener("dragover", function (event) {
	event.preventDefault()
	container.style.outline = "2px dashed #2291c9"
})
window.addEventListener("dragleave", function (event) {
	if (!event.relatedTarget) container.style.outline = ""
})
window.addEventListener("drop", function (event) {
	event.preventDefault()
	container.style.outline = ""
	if (!event.dataTransfer.files.length) return
	inputFile.files = event.dataTransfer.files
	inputFile.dispatchEvent(new Event("change"))
})

inputFile.addEventListener("change", function () {
	let file = this.files?.[0]
	if (!file) {
		hasChosenImage = false
		inputFile.style.backgroundImage = null
		return
	}
	if (!file.type.includes("image/"))
		return this.value = null
	loadBaseImage(URL.createObjectURL(file), file.name)
})

async function loadBaseImage(src, fileName) {
	image.src = src
	let result = await new Promise(resolve => {
		image.onerror = () => resolve(false)
		image.onload = () => resolve(true)
	})
	if (!result) { // probably useless, it is just a leftover from when I considered adding image URL input
		imgFilePreview.src = ""
		elFilePreviewName.textContent = "ERROR - Unable to use this image."
		elFilePreviewSize.textContent = ""
		hasChosenImage = false
		return
	}
	hasSetWidth = undefined, hasSetHeight = undefined, hasChosenImage = true, resizeCache = {}
	imgFilePreview.src = src
	if (fileName.length > 55)
		elFilePreviewName.textContent = fileName.substr(0, 40) + "..." + fileName.substr(fileName.length - 10, fileName.length)
	else
		elFilePreviewName.textContent = fileName
	elFilePreviewSize.textContent = `(${image.width}x${image.height})`
	if ((image.width > 78 || image.height > 78) && image.width == image.height) {
		inputWidth.value = inputHeight.value = 78
	} else {
		if (!hasSetWidth && image.width < 79)
			inputWidth.value = image.width
		if (!hasSetHeight && image.height < 79)
			inputHeight.value = image.height
	}
}

inputWidth.addEventListener("input", function () {
	if (!hasSetHeight) {
		if (image.width > 78 && this.value)
			inputHeight.value = Math.round(calAspectRatioFit(image.width, image.height, parseInt(this.value), image.height).height)
		else
			inputHeight.value = this.value
	}
	hasSetWidth = true
})

inputHeight.addEventListener("input", function () {
	if (!hasSetWidth) {
		if (image.height > 78 && this.value)
			inputWidth.value = Math.round(calAspectRatioFit(image.width, image.height, image.width, parseInt(this.value)).width)
		else
			inputWidth.value = this.value
	}
	hasSetHeight = true
})

inputCoordX.addEventListener("input", function () { inShipCoordX = parseInt(this.value) })
inputCoordY.addEventListener("input", function () { inShipCoordY = parseInt(this.value) })

buttonProcess.addEventListener("click", async function () {
	if (!hasChosenImage)
		return notice("You haven't chosen an image.")
	const width = cbUseTurretScale.checked ? Math.round(parseFloat(inputWidth.value) * 3) : parseInt(inputWidth.value)
	if (!width || width < 1)
		return notice("The entered width is invalid.")
	const height =  cbUseTurretScale.checked ? Math.round(parseFloat(inputHeight.value) * 3) : parseInt(inputHeight.value)
	if (!height || height < 1)
		return notice("The entered height is invalid.")
	const pixelSize = parseInt(inputPixelSize.value)
	if (!pixelSize || pixelSize < 1)
		return notice("The entered pixel size is invalid.")
	const fontSize = parseInt(inputFontSize.value)
	if (isNaN(fontSize))
		return notice("The entered font size is invalid.")
	notice()
	canvas.width = width
	canvas.height = height
	elResultInfo.textContent = "..."
	let start = performance.now()

	let cache = resizeCache[width + "" + height]
	if (!cache && image.width == width && image.height == height) {
		canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height)
		buttonShowResized.style.display = "none"
	} else {
		if (cache) {
			image.src = URL.createObjectURL(cache)
			if (!image.complete) await new Promise(resolve => image.onload = () => resolve())
			canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height)
		} else {
			await Pica.resize(image, canvas)
			canvas.toBlob(blob => resizeCache[width + "" + height] = resizedImageBlob = blob)
		}
		buttonShowResized.style.display = ""
	}

	let result = await process({
		colorSpace: selectColorSpace.value,
		imageData: canvasCtx.getImageData(0, 0, canvas.width, canvas.height),
		pixelSize: pixelSize,
		fontSize: fontSize,
		drawPaintShape: cbDrawPaintShape.checked,
		drawPaintId: cbDrawPaintId.checked
	})

	let imageData = result.imageData
	displayPixelSize = pixelSize
	displayPaintHeight = height
	elResultInfo.textContent = `${width}x${height}sq - ${imageData.width}x${imageData.height}px - ${Math.round(performance.now() - start)}ms`
	canvas.width = displayWidth = imageData.width
	canvas.height = displayHeight = imageData.height
	canvasCtx.putImageData(imageData, 0, 0)
	elResult.dataset.zoomistSrc = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve)))
	if (resultZoomist) resultZoomist.destroy()
	elResultSquare.style.display = "none"
	resultZoomist = new window.Zoomist(elResult, {
		fill: "contain",
		zoomRatio: 0.3,
		on: {
			zoom(ratio) {
				if (ratio == 0.01) this.zoomTo(0.02) // can't zoom out if 0.01
				elResultSquare.style.display = "none"
			},
			dragStart() {
				elResultSquare.style.display = "none"
			},
			drag() {
				resultDragging = true
			},
			dragEnd() {
				setTimeout(() => resultDragging = false, 0)
			},
			ready() {
				elResultHeading.scrollIntoView({ behavior: "smooth" })
				let img = elResult.getElementsByClassName("zoomist-image")[0]
				img.style.pointerEvents = "unset" // zoomist makes it none, which is bad
				img.draggable = false // alternative for ^
			}
		}
	})
})

async function process(data) {
	let result
	if (worker) {
		worker.postMessage(data)
		result = await new Promise(resolve =>
			worker.addEventListener("message", (event) => resolve(event.data.imageData), { once: true })
		)
	} else {
		result = await globalThis.img2pixar(null, data)
	}
	return result
}

elResult.addEventListener(usesTouch ? "touchend" : "click", function (event) {
	let thing = event.changedTouches?.item(0) ?? event
	let target = thing.target
	if (!target.classList.contains("zoomist-image") || resultDragging)
		return
	let clientX = thing.clientX
	let clientY = thing.clientY
	// Calculate coords of the hovered on paint pixel on the image (relative to zoom)
	let img = target
	let imgRect = img.getBoundingClientRect()
	let x = clientX - imgRect.left
	let y = clientY - imgRect.top
	let resizeRatio = Math.min(img.width / displayWidth, img.height / displayHeight)
	let scaledPixelSize = displayPixelSize * resizeRatio
	let paintX = Math.floor(x / scaledPixelSize)
	let paintY = Math.floor(y / scaledPixelSize)
	if (paintX < 0 || paintY < 0) return elResultSquare.style.display = "none"

	// calculate position for the square element
	let contRect = elResultContainer.getBoundingClientRect()
	let paintPixelLeft = (imgRect.left - contRect.left) + (paintX ?? 1) * scaledPixelSize
	let paintPixelTop = (imgRect.top - contRect.top) + (paintY ?? 1) * scaledPixelSize
	let inShipX = inShipCoordX + paintX
	let inShipY = displayPaintHeight - (-inShipCoordY + 1 + paintY)
	elResultSquare.style.display = ""
	elResultSquare.style.width = elResultSquare.style.height = scaledPixelSize + "px"
	elResultSquare.style.left = paintPixelLeft + "px"
	elResultSquare.style.top = paintPixelTop + "px"

	// calculate position for the coords element
	elResultSquareCoords.textContent = inShipX + "," + inShipY
	let resultRect = elResultSquare.getBoundingClientRect()
	if (resultRect.bottom + 20 >= contRect.bottom) {
		elResultSquareCoords.style.top = "-20px"
		elResultSquareCoords.style.bottom = "unset"
	} else {
		elResultSquareCoords.style.top = "unset"
		elResultSquareCoords.style.bottom = "-20px"
	}
	if (resultRect.left - 30 <= contRect.left) {
		elResultSquareCoords.style.left = "0"
		elResultSquareCoords.style.right = "unset"
		elResultSquareCoords.style.transform = "unset"
	} else if (resultRect.right + 30 >= contRect.right) {
		elResultSquareCoords.style.left = "unset"
		elResultSquareCoords.style.right = "0"
		elResultSquareCoords.style.transform = "unset"
	} else {
		elResultSquareCoords.style.left = "50%"
		elResultSquareCoords.style.right = "unset"
		elResultSquareCoords.style.transform = "translateX(-50%)"
	}
})

;(async () => {
	let html = ""
	if (navigator.keyboard) {
		await navigator.keyboard.getLayoutMap().then((map) => {
			html += `(The debug key should be \`<strong>${map.get("Slash")}</strong>\` for your locale)`
		})
	} else {
		html += "(The debug key is Slash <strong>/</strong>, might be something else depending on your locale, like the period <strong>.</strong>)"
	}
	container.querySelector(".debug-key-info").innerHTML += html
})()

container.querySelector(".button-reset-zoom").addEventListener("click", () => resultZoomist?.reset())

buttonShowResized.addEventListener("click", () => window.open(URL.createObjectURL(resizedImageBlob), "_blank"))

;[inputWidth, inputHeight, inputFontSize, inputPixelSize, inputCoordX, inputCoordY].forEach(el => {
	el.addEventListener("focus", function () { this.select() })
})

document.querySelectorAll(".tooltip-ref").forEach(addTooltip)

function calAspectRatioFit(w, h, maxW, maxH) {
	let ratio = Math.min(maxW / w, maxH / h)
	return { width: w * ratio, height: h * ratio }
}

function notice(text = "") {
	clearTimeout(noticeTimeoutId)
	elNotice.textContent = text
	if (text == "") return
	noticeTimeoutId = setTimeout(() => elNotice.textContent = "", 8000)
}

document.querySelector("header nav .dropdown>.text").innerHTML = tool.name
if (tool.credits) container.querySelector("footer .credits").innerHTML = `${tool.name} ${tool.credits} -`
