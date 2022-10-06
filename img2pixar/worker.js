globalThis.toolPath = this.location.href.substring(0, this.location.href.lastIndexOf("/"))

importScripts("converter.js")

let offscreenCanvas = new OffscreenCanvas(1, 1)

this.addEventListener("message", async function (event) {
	let imageData = await globalThis.img2pixar(offscreenCanvas, event.data)
	postMessage({ imageData: imageData })
})
