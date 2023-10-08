globalThis.toolPath = import.meta.url.substring(0, import.meta.url.lastIndexOf("/"))
const credits = `by <a href='https://github.com/Blueyescat' target='_blank'>Blueyescat</a>,
	<br>Inspired by <a href='https://github.com/ivstiv/pixelart-converter' target='_blank'>pixelart-converter</a> by ivstiv.`

import("/assets/autoInputSave.js")
import Pica from "pica"
import Zoomist from "zoomist"
import { loadHF, usesTouch } from "/main.js"
loadHF(credits)

const pica = new Pica({ idle: 60000 })

let worker
if ("OffscreenCanvas" in window) worker = new Worker(globalThis.toolPath + "/worker.js")
else await import(globalThis.toolPath + "/converter.js")

const container = document.querySelector("#main-container")
const inputFile = document.getElementById("input-file")
const inputWidth = document.getElementById("input-width")
const inputHeight = document.getElementById("input-height")
const cbUseTurretScale = document.getElementById("cb-use-turret-scale")
const cbDrawPaintId = document.getElementById("cb-paint-id")
const cbDrawPaintTexture = document.getElementById("cb-paint-texture")
const cbNoSmoothResizing = document.getElementById("cb-no-smooth-resizing")
const inputCoordX = document.getElementById("input-coord-x")
const inputCoordY = document.getElementById("input-coord-y")
const inputPixelSize = document.getElementById("input-pixel-size")
const inputFontSize = document.getElementById("input-font-size")
const selectColorSpace = document.getElementById("select-color-space")
const buttonProcess = document.getElementById("button-process")
const buttonShowResized = document.getElementById("button-show-resized")
const imgFilePreview = document.querySelector("#preview>img")
const elFilePreviewName = document.querySelector("#preview>.name")
const elFilePreviewSize = document.querySelector("#preview>.size")
const elResultContainer = document.getElementById("result-container")
const imgResult = document.getElementById("result")
const elNotice = document.getElementById("notice")
const elResultInfo = document.getElementById("result-info")
const elResultHeading = document.getElementById("result-heading")
const elResultSquare = document.getElementById("result-hover-square")
const elResultSquareCoords = elResultSquare.querySelector(".coords")
const canvas = document.createElement("canvas")
const canvasCtx = canvas.getContext("2d", { willReadFrequently: true })

let noticeTimeoutId, resultZoomist, resultDragging, resizedImageBlob
let hasSetWidth, hasSetHeight, hasChosenImage
let displayPixelSize, displayWidth, displayHeight, displayPaintHeight
let inShipCoordX = 1, inShipCoordY = 1
let resizeCache = {}
const image = new Image()

window.addEventListener("paste", e => {
	const file = e.clipboardData.files?.[0]
	if (!file || !file.type.includes("image/")) return
	const dt = new DataTransfer()
	dt.items.add(file)
	inputFile.files = dt.files
	inputFile.dispatchEvent(new Event("change"))
})

window.addEventListener("dragover", e => {
	e.preventDefault()
	container.style.outline = "2px dashed var(--blue)"
})
window.addEventListener("dragleave", e => {
	if (!e.relatedTarget) container.style.outline = ""
})
window.addEventListener("drop", e => {
	e.preventDefault()
	container.style.outline = ""
	if (!e.dataTransfer.files.length) return
	inputFile.files = e.dataTransfer.files
	inputFile.dispatchEvent(new Event("change"))
})

inputFile.addEventListener("change", () => {
	const file = inputFile.files?.[0]
	if (!file) {
		hasChosenImage = false
		inputFile.style.backgroundImage = null
		return
	}
	if (!file.type.includes("image/"))
		return inputFile.value = null
	loadBaseImage(URL.createObjectURL(file), file.name)
})

async function loadBaseImage(src, fileName) {
	image.src = src
	const result = await new Promise(resolve => {
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
	autoFillDims(cbUseTurretScale.checked)
}

cbUseTurretScale.addEventListener("change", () => {
	if (hasSetWidth || hasSetHeight || !hasChosenImage) return
	autoFillDims(this.checked)
})

function autoFillDims(turretScale) {
	if (image.width == image.height && image.width > 78) {
		inputWidth.value = inputHeight.value = turretScale ? 78 / 3 : 78
	} else {
		if (image.width <= 78)
			inputWidth.value = turretScale ? (image.width / 3).toFixed(1) : image.width
		if (image.height <= 78)
			inputHeight.value = turretScale ? (image.height / 3).toFixed(1) : image.height
	}
}

inputWidth.addEventListener("input", function () {
	if (!hasSetHeight) {
		const fit = calcAspectRatioFit(image.width, image.height, parseFloat(this.value), image.height).height
		if (isNaN(fit)) return
		inputHeight.value = cbUseTurretScale.checked ? toNearestTurretScale(fit) : Math.round(fit)
	}
	hasSetWidth = true
})

inputHeight.addEventListener("input", function () {
	if (!hasSetWidth) {
		const fit = calcAspectRatioFit(image.width, image.height, image.width, parseFloat(this.value)).width
		if (isNaN(fit)) return
		inputWidth.value = cbUseTurretScale.checked ? toNearestTurretScale(fit) : Math.round(fit)
	}
	hasSetHeight = true
})

inputCoordX.addEventListener("input", () => inShipCoordX = parseInt(inputCoordX.value))
inputCoordY.addEventListener("input", () => inShipCoordY = parseInt(inputCoordX.value))

buttonProcess.addEventListener("click", async () => {
	if (!hasChosenImage)
		return notice("You haven't chosen an image.")
	const width = cbUseTurretScale.checked ? Math.round(parseFloat(inputWidth.value) * 3) : parseInt(inputWidth.value)
	if (!width || width < 1)
		return notice("The entered width is invalid.")
	const height = cbUseTurretScale.checked ? Math.round(parseFloat(inputHeight.value) * 3) : parseInt(inputHeight.value)
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
	const start = performance.now()

	const cacheKey = "" + cbNoSmoothResizing.checked + width + height
	const cachedBlob = resizeCache[cacheKey]
	if (!cachedBlob && image.width == width && image.height == height) {
		canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height)
		buttonShowResized.style.display = "none"
	} else {
		if (cachedBlob) {
			image.src = URL.createObjectURL(cachedBlob)
			if (!image.complete) await new Promise(resolve => image.onload = () => resolve())
			canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height)
		} else {
			await pica.resize(image, canvas, cbNoSmoothResizing.checked ? { filter: "box" } : undefined)
			canvas.toBlob(blob => resizeCache[cacheKey] = resizedImageBlob = blob)
		}
		buttonShowResized.style.display = ""
	}

	const result = await process({
		colorSpace: selectColorSpace.value,
		imageData: canvasCtx.getImageData(0, 0, canvas.width, canvas.height),
		pixelSize: pixelSize,
		fontSize: fontSize,
		drawPaintTexture: cbDrawPaintTexture.checked,
		drawPaintId: cbDrawPaintId.checked
	})

	const imageData = result.imageData
	displayPixelSize = pixelSize
	displayPaintHeight = height
	elResultInfo.textContent = `${width}x${height}sq - ${imageData.width}x${imageData.height}px - ${Math.round(performance.now() - start)}ms`
	canvas.width = displayWidth = imageData.width
	canvas.height = displayHeight = imageData.height
	canvasCtx.putImageData(imageData, 0, 0)
	imgResult.src = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve)))
	if (resultZoomist) resultZoomist.destroy()
	elResultSquare.style.display = "none"
	resultZoomist = new Zoomist(".zoomist-container", {
		bounds: false,
		zoomRatio: 0.3,
		initScale: 1,
		minScale: 0.03,
		maxScale: 100,
		on: {
			zoom() {
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
				setTimeout(() => elResultHeading.scrollIntoView({ behavior: "smooth" }), 100)
				imgResult.style.pointerEvents = "auto"
				imgResult.draggable = false
			}
		}
	})
})

async function process(data) {
	let result
	if (worker) {
		worker.postMessage(data)
		result = await new Promise(resolve =>
			worker.addEventListener("message", e => resolve(e.data.imageData), { once: true })
		)
	} else {
		result = await globalThis.img2pixar(null, data)
	}
	return result
}

imgResult.addEventListener(usesTouch ? "touchend" : "click", e => {
	const thing = e.changedTouches?.item(0) ?? e
	if (resultDragging)
		return
	const clientX = thing.clientX
	const clientY = thing.clientY
	// calculate coords of the hovered on paint pixel on the image (relative to zoom)
	const imgRect = imgResult.getBoundingClientRect()
	const x = clientX - imgRect.left
	const y = clientY - imgRect.top
	const displayRatio = Math.min(imgResult.width / displayWidth, imgResult.height / displayHeight)
	const scaledPixelSize = displayPixelSize * resultZoomist.transform.scale * displayRatio
	const paintX = Math.floor(x / scaledPixelSize)
	const paintY = Math.floor(y / scaledPixelSize)
	if (paintX < 0 || paintY < 0)
		return elResultSquare.style.display = "none"

	// calculate position for the square element
	const contRect = elResultContainer.getBoundingClientRect()
	const paintPixelLeft = (imgRect.left - contRect.left) + (paintX ?? 1) * scaledPixelSize
	const paintPixelTop = (imgRect.top - contRect.top) + (paintY ?? 1) * scaledPixelSize
	const inShipX = inShipCoordX + paintX
	const inShipY = displayPaintHeight - (-inShipCoordY + 1 + paintY)
	elResultSquare.style.display = ""
	elResultSquare.style.width = elResultSquare.style.height = scaledPixelSize + "px"
	elResultSquare.style.left = paintPixelLeft + "px"
	elResultSquare.style.top = paintPixelTop + "px"

	// calculate position for the coords element
	elResultSquareCoords.textContent = inShipX + "," + inShipY
	const resultRect = elResultSquare.getBoundingClientRect()
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

void async function () {
	let html = ""
	if (navigator.keyboard) {
		await navigator.keyboard.getLayoutMap().then((map) => {
			html += `(The debug key should be <b>${map.get("Slash")}</b> for your locale)`
		})
	} else {
		html += "(The debug key is Slash <b>/</b>, might be something else depending on your locale, like the period <b>.</b>)"
	}
	document.getElementById("debug-key-info").insertAdjacentHTML("beforeend", html)
}()

document.getElementById("button-reset-zoom").addEventListener("click", () => resultZoomist?.reset())

buttonShowResized.addEventListener("click", () =>
	window.open(URL.createObjectURL(resizedImageBlob), "_blank")
)

for (const el of [inputWidth, inputHeight, inputFontSize, inputPixelSize, inputCoordX, inputCoordY])
	el.addEventListener("focus", () => el.select())

function toNearestTurretScale(n) {
	const int = Math.trunc(n)
	const dec = n - int
	if (dec == 0) return int
	if (dec <= 1 / 3) return int + 0.3
	if (dec <= 1 / 3 * 2) return int + 0.6
	return int + 1
}

function calcAspectRatioFit(w, h, maxW, maxH) {
	const ratio = Math.min(maxW / w, maxH / h)
	return { width: w * ratio, height: h * ratio }
}

function notice(text = "") {
	clearTimeout(noticeTimeoutId)
	elNotice.textContent = text
	if (text == "") return
	noticeTimeoutId = setTimeout(() => elNotice.textContent = "", 8000)
}
