import { decode } from "dsabp-js"
import { BpRenderer } from "dsabp-js-img"
import { editorMap } from "../uiMain.js"
import { getRecentBps, getSettings, RecentBps, saveRecentBp, saveRecentBps, SettingsBool } from "/bpeditor/managers/webStorage.js"
import { isKeyDown } from "/bpeditor/util.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"

export function initWelcome() {
	const body = /*html*/`
		<h2 style="font-weight: normal;">${document.title}</h2>
		<p><a class="a-guide no-link">Guide</a><span class="newcomers smaller" style="display: none;"> (Recommended for Newcomers)</span></p>
		<p><a class="a-new no-link">New map...</a></p>
		<p><a class="a-load no-link">Load a blueprint string...</a></p>
		<div class="recent">
			<h3 style="font-weight: normal; margin-top: 1.5em;">Recent</h3>
			<div class="recent-list"></div>
		</div>
	`

	return new Dialog({
		id: "dialog-welcome",
		title: "Welcome",
		body,
		backdrop: true,
		async onCreate(dialog) {
			const aGuide = elByCls<HTMLAnchorElement>(dialog, "a-guide"),
				aNew = elByCls<HTMLAnchorElement>(dialog, "a-new"),
				aLoad = elByCls<HTMLAnchorElement>(dialog, "a-load"),
				elRecentList = elByCls(dialog, "recent-list"),
				elNewcomers = elByCls(dialog, "newcomers"),

				settings = getSettings(),
				hideNewcomers = settings.bools.has(SettingsBool.hideWelcomeNewcomers)

			if (!hideNewcomers)
				elNewcomers.style.display = ""

			aGuide.addEventListener("click", () => {
				document.getElementById("button-menu-guide").click()
				if (!hideNewcomers) {
					settings.bools.enable(SettingsBool.hideWelcomeNewcomers)
					settings.save()
				}
			})

			aNew.addEventListener("click", () =>
				document.getElementById("button-menu-new").click()
			)

			aLoad.addEventListener("click", () =>
				document.getElementById("button-menu-view-bp").click()
			)

			dialog.addEventListener("open", () => loadRecents())
			dialog.addEventListener("close", () => { observer.disconnect(); elRecentList.replaceChildren() })

			editorMap.on("bploading", () => dialog.close())

			const waitingToRender = new Map<Element, { img: HTMLImageElement, str: string, date: number }>(),
				renderQueue: Element[] = []
			let isRendering = false

			const observer = new IntersectionObserver(entries => {
				entries.forEach(async ({ intersectionRatio, target }) => {
					if (intersectionRatio >= 0.2) {
						if (!renderQueue.includes(target))
							renderQueue.push(target)

						startRendering()

						observer.unobserve(target)
					}
				})
			}, { threshold: [0, 0.25, 0.5, 0.75, 1] })

			let bpRenderer: BpRenderer
			async function startRendering() {
				if (isRendering || renderQueue.length == 0) return

				isRendering = true
				while (renderQueue.length > 0) {
					const target = renderQueue.shift() as HTMLElement,
						item = waitingToRender.get(target)

					if (item) {
						if (!bpRenderer) {
							bpRenderer = new BpRenderer()
							bpRenderer.useCacheOf(editorMap.bpRenderer)
						}
						const bp = await decode(item.str),
							sq = bp.width + bp.height
						bpRenderer.squareSize = sq < 17 ? 20 : sq > 123 ? 4 : 6
						await bpRenderer.render(bp, 1)
						item.img.src = bpRenderer.canvasOut.toDataURL()
						target.title = `Click to load this blueprint.`
							+ `\n- Size: ${bp.width}x${bp.height}, can fit ${Math.trunc((bp.width - 2) / 3 * 10) / 10}x${Math.trunc((bp.height - 2) / 3 * 10) / 10} cannons`
							+ `\n- Last edited: ${new Date(item.date).toLocaleString()}`
						waitingToRender.delete(target)
					}

					await new Promise(resolve => setTimeout(resolve, 4))
				}
				isRendering = false
			}

			async function loadRecents() {
				elRecentList.replaceChildren()
				const recentBps = getRecentBps(),
					keys = Object.keys(recentBps).sort((a: any, b: any) => b - a)

				if (!keys.length)
					return elRecentList.insertAdjacentHTML("afterbegin", /*html*/`<i style="color: gray;">Maps are automatically saved and listed here.</i>`)

				if (keys.length > 150) {
					const deletedKey = keys.pop()
					delete recentBps[deletedKey]
					saveRecentBps(recentBps)
				}

				waitingToRender.clear()
				renderQueue.length = 0
				isRendering = false

				for (const sessionId of keys) {
					const item = recentBps[sessionId],
						elItem = document.createElement("button"),
						img = document.createElement("img"),
						btnDel = document.createElement("button")

					elItem.className = "item"
					elItem.tabIndex = 0

					elItem.addEventListener("click", () => {
						editorMap.loadBlueprint(item.str)
						saveRecentBp(recentBps, item.str, sessionId)
						dialog.close()
					})

					btnDel.innerHTML = /*html*/`<i class="i x"></i>`
					btnDel.title = "Delete"
					btnDel.addEventListener("click", e => {
						e.stopPropagation()
						deleteRecent(recentBps, elItem, img, sessionId)
					})

					elItem.addEventListener("keydown", e => e.key == "Delete" && btnDel.click())

					elItem.append(img, btnDel)
					elRecentList.appendChild(elItem)

					observer.observe(elItem)
					waitingToRender.set(elItem, { img, str: item.str, date: item.date })
				}
			}

			function deleteRecent(recentBps: RecentBps, elItem: HTMLElement, img: HTMLImageElement, sessionId: string) {
				const del = () => {
					elItem.remove()
					delete recentBps[sessionId]
					saveRecentBps(recentBps)
				}

				if (isKeyDown("shift"))
					return del()

				elItem.classList.add("deleting")
				new Dialog({
					title: "Delete Recent Map",
					body: /*html*/`<p>Are you sure you want to delete this map?</p>
						<p><img src="${img.src}" width="75" style="border: 1px solid var(--input-border-color); padding: 0.2em;"></p>
						<p class="smaller mobile-hidden" style="color: darkgray;">Hold Shift when clicking <i class="i x smaller"></i> to bypass this confirmation.</p>`,
					footer: {
						closeButton: { html: "No", right: true },
						html: /*html*/`<button class="button-yes">Yes</button>`
					},
					removeOnClose: true,
					closeWhenClickedOutside: true,
					onCreate(dialog) {
						const btnYes = elByCls<HTMLButtonElement>(dialog, "button-yes")
						btnYes.addEventListener("click", () => { dialog.close(); del() })
						dialog.addEventListener("open", () => btnYes.focus())
						dialog.addEventListener("close", () => elItem.classList.remove("deleting"), { once: true })
					},
				}).open(true)
			}
		}
	})
}
