import { BpRenderer } from "dsabp-js-img"
import { Rectangle } from "pixi.js"
import { editorMap } from "../uiMain.js"
import { Dialog } from "/Dialog.js"
import { elByCls, linkRangeNumber } from "/main.js"
import { toast } from "/Toast.js"

export function initExportImage() {
	const body = /*html*/`
		<p>
			<label style="cursor: pointer;">
				Screenshot <input type="checkbox" class="switch cb-mode" data-save> Generate
			</label>
		</p>
		<p style="display: flex; align-items: center; gap: 0.2em;">
			Background color:
			<span style="border: 1px solid var(--input-border-color); border-radius: 3px;">
				<input type="color" class="input-bg-color" style="border: none; padding: 0; cursor: pointer;" data-save>
			</span>
			<input type="range" value="0" min="0" max="255" style="width: 128px;">
			<input type="number" value="0" min="0" max="255" class="input-bg-alpha" style="width: 50px;" data-save>
		</p>
		<p>
			Scale: <input type="number" value="1" placeholder="1" min="0" class="input-scale" style="width: 60px;" data-save>
		</p>
		<p>
			Exterior margin: <input type="number" value="3.75" placeholder="3.75" step="0.05" min="0" class="input-margin" style="width: 70px;" data-save> squares
		</p>
		<div class="screenshot-section" style="max-width: 400px;">
			<p class="smaller">A screenshot of the map will be taken, including anything but the UI. It will hide the placement preview and focus highlight, you need to handle other
				visible elements yourself. Leave 'Exterior margin' blank to include objects outside the hull (be careful with pusher beams).</p>
		</div>
		<div class="generate-section" style="max-width: 400px; display: none;">
			<p>
				Square size: <input type="number" value="40" placeholder="40" min="1" class="input-sq-size" style="width: 70px;" data-save>
			</p>
			<p class="smaller">An image will be generated using the blueprint. Doesn't support objects outside the hull.</p>
		</div>
		<div style="float: right;">
			<img class="img-view" width="180" style="margin-top: 0.5em; border-radius: 8px; display: none;">
			<p class="smaller info" style="text-align: right;"></p>
		</div>
	`

	const { app, viewport, bp, placement, events } = editorMap

	new Dialog({
		id: "dialog-exportimage",
		title: "Export Image",
		draggable: { key: "exportimage" },
		body,
		footer: {
			html: /*html*/`
				<button class="button-view" style="margin-right: 9px;">View</button>
				<button class="button-copy">Copy</button>
				<button class="button-download">Download</button>
				<button class="button-save">Save As...</button>
			`,
			closeButton: { html: "Close", right: true }
		},
		onCreate(dialog) {
			linkRangeNumber(dialog.querySelector("input[type=range]"))

			document.getElementById("button-menu-exportimage").addEventListener("click", () => dialog.open())

			const cbIsScreenshot = elByCls<HTMLInputElement>(dialog, "cb-mode"),
				btnView = elByCls<HTMLButtonElement>(dialog, "button-view"),
				btnCopy = elByCls<HTMLButtonElement>(dialog, "button-copy"),
				btnDownload = elByCls<HTMLButtonElement>(dialog, "button-download"),
				btnSave = elByCls<HTMLButtonElement>(dialog, "button-save"),
				elScreenshotSection = elByCls(dialog, "screenshot-section"),
				elGenerateSection = elByCls(dialog, "generate-section"),
				inputBgColor = elByCls<HTMLInputElement>(dialog, "input-bg-color"),
				inputBgAlpha = elByCls<HTMLInputElement>(dialog, "input-bg-alpha"),
				inputSqSize = elByCls<HTMLInputElement>(dialog, "input-sq-size"),
				inputScale = elByCls<HTMLInputElement>(dialog, "input-scale"),
				inputExteriorMargin = elByCls<HTMLInputElement>(dialog, "input-margin"),
				imgView = elByCls<HTMLImageElement>(dialog, "img-view"),
				elInfo = elByCls(dialog, "info"),

				bpRenderer = new BpRenderer(document.createElement("canvas")),
				bgCanvas = document.createElement("canvas"),
				bgCtx = bgCanvas.getContext("2d")


			let ssMode = true,
				bgAlpha = 0,
				lastObjUrl: string,
				imgW: number, imgH: number

			cbIsScreenshot.addEventListener("change", () => {
				ssMode = !cbIsScreenshot.checked
				elScreenshotSection.style.display = ssMode ? "" : "none"
				elGenerateSection.style.display = ssMode ? "none" : ""
			})

			inputBgAlpha.addEventListener("input", () => {
				bgAlpha = parseInt(inputBgAlpha.value)
				inputBgColor.style.opacity = (bgAlpha / 255).toString()
			})

			async function getImage() {
				const hexa = inputBgColor.value + bgAlpha.toString(16).padStart(2, "0"),
					scale = parseFloat(inputScale.value || "1")

				let blob: Blob

				if (ssMode) {
					events.pointer.stop()
					placement.dispObj.visible = false

					const extMargin = inputExteriorMargin.valueAsNumber
					let frame: Rectangle
					if (!isNaN(extMargin)) {
						const squareSize = bpRenderer.squareSize,
							marginOffset = extMargin * squareSize,
							back = -(squareSize / 2) - marginOffset,
							forward = (-(squareSize / 2) + marginOffset) - back
						frame = new Rectangle(back, back, viewport.worldWidth + forward, viewport.worldHeight + forward)
						imgW = frame.width
						imgH = frame.height
					} else {
						imgW = Math.round(viewport.width / viewport.scaled)
						imgH = Math.round(viewport.height / viewport.scaled)
					}

					const base64 = await app.renderer.extract.base64({ target: viewport, clearColor: hexa, resolution: scale, frame })
					app.renderer.renderableGC.enabled = false // https://github.com/pixijs/pixijs/issues/10942
					app.renderer.renderableGC.enabled = true

					events.pointer.start()
					placement.check(events.pointer.body)

					blob = await (await fetch(base64)).blob()
				} else {
					bpRenderer.squareSize = parseInt(inputSqSize.value || "40")
					await bpRenderer.render(bp, parseFloat(inputExteriorMargin.value || "3.75"))
					const { canvasOut } = bpRenderer
					bgCanvas.width = canvasOut.width * scale
					bgCanvas.height = canvasOut.height * scale

					bgCtx.scale(scale, scale)
					bgCtx.fillStyle = hexa
					bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)

					bgCtx.drawImage(canvasOut, 0, 0)

					imgW = bgCanvas.width
					imgH = bgCanvas.height

					blob = await new Promise<Blob>(resolve => bgCanvas.toBlob(resolve))
				}

				elInfo.textContent = `${imgW}x${imgH} - ${(blob.size / 1024).toFixed(3)}KB`
				return blob
			}

			btnView.addEventListener("click", async () => {
				const blob = await getImage()
				URL.revokeObjectURL(lastObjUrl)
				imgView.src = lastObjUrl = URL.createObjectURL(blob) + "#_You_can't_share_this_URL_it_is_local_temporary"
				imgView.style.display = ""
			})

			btnCopy.addEventListener("click", async () => {
				const blob = await getImage()

				URL.revokeObjectURL(lastObjUrl)
				imgView.src = lastObjUrl = URL.createObjectURL(blob) + "#_You_can't_share_this_URL_it_is_local_temporary"
				imgView.style.display = ""

				navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
					.then(() => {
						toast({ body: "Image copied to clipboard.", duration: 4000, color: "#0F0" })
					}).catch(err => {
						console.error(err)
						toast({ body: "Unable to copy image to clipboard: no permission or not supported.", duration: 6000, color: "#F00" })
					})
			})

			const hideView = () => (URL.revokeObjectURL(lastObjUrl), imgView.src = "", imgView.style.display = "none")

			btnDownload.addEventListener("click", async () => {
				hideView()
				const blob = await getImage()
				toast({ body: "Downloading the image...", duration: 4000, color: "#0F0" })
				const a = document.createElement("a")
				a.href = URL.createObjectURL(blob)
				a.download = `${bp.width}x${bp.height}-ship-bpeditor.png`
				a.click()
				URL.revokeObjectURL(a.href)
				a.remove()
			})

			if (window["showSaveFilePicker"])
				btnSave.addEventListener("click", async () => {
					const handle = await window["showSaveFilePicker"]({
						id: "dsatools-exportbpimage",
						startIn: "downloads",
						types: [{ accept: { "image/png": [".png"] } }],
						suggestedName: `${bp.width}x${bp.height}-ship-bpeditor.png`
					}).catch(() => { })
					if (handle) {
						hideView()
						const writable = await handle.createWritable()
						await writable.write(await getImage())
						await writable.close()
						toast({ body: "Image saved.", duration: 4000, color: "#0F0" })
					}
				})
			else
				btnSave.style.display = "none"

			dialog.addEventListener("close", () => {
				hideView()
				elInfo.textContent = ""
			})
		}
	})
}
