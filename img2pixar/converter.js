const paintMatchCache = {}
let palettes

fetch(globalThis.toolPath + "/assets/color-palettes.json")
	.then(res => res.json())
	.then(json => palettes = json)
	.catch(console.error)

/* setTimeout(() => {
	let output = {}
	for (const id in palettes.RGB) output[id] = xyzToLab(rgbToXyz(palettes.RGB[id]))
	console.info(JSON.stringify(output))
}, 500) */

globalThis.img2pixar = async function (canvas, options) {
	if (!canvas) {
		if (!document) return // if no canvas, should be called from main thread
		canvas = document.createElement("canvas")
	}
	let canvasCtx = canvas.getContext("2d")
	let pixels = options.imageData.data
	let pixelSize = options.pixelSize
	let width = options.imageData.width
	let height = options.imageData.height
	let textureImage

	canvas.width = width * pixelSize
	canvas.height = height * pixelSize
	if (options.drawPaintId) canvasCtx.font = `${options.fontSize}px Verdana, Geneva, Tahoma, sans-serif`
	if (options.drawPaintTexture) {
		textureImage = await loadImage(globalThis.toolPath + "/assets/bg_ship.png")
	}

	let x = 0, y = 0
	for (let i = 0; i < pixels.length; i += 4) {
		if (i != 0 && i / 4 % width == 0) {
			y += pixelSize
			x = 0
		}

		let paintId = getClosestPaint(options.colorSpace, [pixels[i], pixels[i + 1], pixels[i + 2]])
		let rgbPaintColor = palettes.RGB[paintId]
		let cssColor = `rgb(${rgbPaintColor[0]}, ${rgbPaintColor[1]}, ${rgbPaintColor[2]})`

		if (textureImage) {
			canvasCtx.drawImage(textureImage, x, y, pixelSize, pixelSize)
			canvasCtx.fillStyle = cssColor
			canvasCtx.globalCompositeOperation = "multiply"
			canvasCtx.fillRect(x, y, pixelSize, pixelSize)
			canvasCtx.globalCompositeOperation = "source-over"
		} else {
			canvasCtx.fillStyle = cssColor
			canvasCtx.fillRect(x, y, pixelSize, pixelSize)
		}

		if (options.drawPaintId) {
			canvasCtx.fillStyle = isDarkColor(rgbPaintColor) ? "white" : "black"
			canvasCtx.fillText(paintId, x, y + pixelSize - 2, pixelSize)
		}
		x += pixelSize
	}
	return {
		imageData: canvasCtx.getImageData(0, 0, canvas.width, canvas.height)
	}
}

async function loadImage(url) {
	return createImageBitmap(await (await fetch(url).catch(console.error)).blob())
}

function isDarkColor(rgb, cap = 128) {
	return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) < cap
}

function getClosestPaint(cspace, color) {
	let palette, func
	if (cspace == "CIE2000")
		palette = "LAB", func = deltaE2000, color = xyzToLab(rgbToXyz(color))
	else
		palette = "RGB", func = euclideanDistance
	let resultId, closestId
	let colorText = color.join("")
	if (!Object.hasOwn(paintMatchCache, palette)) {
		paintMatchCache[palette] = {}
	}
	if (Object.hasOwn(paintMatchCache[palette], colorText)) {
		resultId = paintMatchCache[palette][colorText]
	} else {
		let shortestDist = -1
		for (const id in palettes[palette]) {
			let c = palettes[palette][id]
			let dist = func(color, c)
			if (shortestDist == -1 || dist < shortestDist) {
				shortestDist = dist
				resultId = id
				closestId = id
			}
		}
		paintMatchCache[palette][colorText] = closestId
	}
	return resultId
}

function euclideanDistance(c1, c2) {
	return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2))
}

// Credit https://github.com/hamada147/IsThisColourSimilar/blob/master/Colour.js#L252
function deltaE2000(lab1, lab2) {
	const rad2deg = rad => 360 * rad / (2 * Math.PI)
	const deg2rad = deg => (2 * Math.PI * deg) / 360
	const avgL = (lab1[0] + lab2[0]) / 2
	const c1 = Math.sqrt(Math.pow(lab1[1], 2) + Math.pow(lab1[2], 2))
	const c2 = Math.sqrt(Math.pow(lab2[1], 2) + Math.pow(lab2[2], 2))
	const avgC = (c1 + c2) / 2
	const g = (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7)))) / 2
	const a1p = lab1[1] * (1 + g)
	const a2p = lab2[1] * (1 + g)
	const c1p = Math.sqrt(Math.pow(a1p, 2) + Math.pow(lab1[2], 2))
	const c2p = Math.sqrt(Math.pow(a2p, 2) + Math.pow(lab2[2], 2))
	const avgCp = (c1p + c2p) / 2
	let h1p = rad2deg(Math.atan2(lab1[2], a1p))
	if (h1p < 0) h1p = h1p + 360
	let h2p = rad2deg(Math.atan2(lab2[2], a2p))
	if (h2p < 0) h2p = h2p + 360
	const avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2
	const t = 1 - 0.17 * Math.cos(deg2rad(avghp - 30)) + 0.24 * Math.cos(deg2rad(2 * avghp)) + 0.32 * Math.cos(deg2rad(3 * avghp + 6)) - 0.2 * Math.cos(deg2rad(4 * avghp - 63))
	let deltahp = h2p - h1p
	if (Math.abs(deltahp) > 180) {
		if (h2p <= h1p) deltahp += 360
		else deltahp -= 360
	}
	const deltalp = lab2[0] - lab1[0]
	const deltacp = c2p - c1p
	deltahp = 2 * Math.sqrt(c1p * c2p) * Math.sin(deg2rad(deltahp) / 2)
	const sl = 1 + ((0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2)))
	const sc = 1 + 0.045 * avgCp
	const sh = 1 + 0.015 * avgCp * t
	const deltaro = 30 * Math.exp(-(Math.pow((avghp - 275) / 25, 2)))
	const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)))
	const rt = -rc * Math.sin(2 * deg2rad(deltaro))
	return Math.sqrt(Math.pow(deltalp / (1 * sl), 2) + Math.pow(deltacp / (1 * sc), 2) + Math.pow(deltahp / (1 * sh), 2) + rt * (deltacp / (1 * sc)) * (deltahp / (1 * sh)))
}

function rgbToXyz(rgb) {
	const [r, g, b] = [...rgb].map(v => {
		v /= 255
		return (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92) * 100
	})
	const x = 0.4124 * r + 0.3576 * g + 0.1805 * b
	const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
	const z = 0.0193 * r + 0.1192 * g + 0.9505 * b
	return [x, y, z]
}

const D50 = [94.811, 100.000, 107.304]
function xyzToLab(xyz) {
	const [x, y, z] = [...xyz].map((v, i) => {
		v /= D50[i]
		return v > 0.008856 ? Math.pow(v, 1 / 3) : 7.787 * v + 16 / 116
	})
	const l = 116 * y - 16
	const a = 500 * (x - y)
	const b = 200 * (y - z)
	return [l, a, b]
}
