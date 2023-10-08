globalThis.toolPath = self.location.href.substring(0, self.location.href.lastIndexOf("/"))

importScripts("converter.js")

const offscreenCanvas = new OffscreenCanvas(1, 1)

self.addEventListener("message", e => {
	globalThis.img2pixar(offscreenCanvas, e.data)
		.then(imageData => postMessage({ imageData }))
})
