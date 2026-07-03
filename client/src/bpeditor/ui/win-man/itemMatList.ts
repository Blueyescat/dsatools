import { Item } from "dsabp-js"
import { MapObject } from "../../MapObject.js"
import { getUnpackagedName } from "../../util.js"
import { editorMap, winMan } from "../uiMain.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"

export function initItemMatList() {
	const MAIN_TITLE = "List of Items & Materials",
		body = /*html*/`
			<div class="materials" style="float: right; margin-bottom: 0.3em; background: var(--button-active-color); border-radius: 8px; padding: 3px;" title="Resources to craft these items."></div>
			<p class="smaller only-rcd" style="display: none; color: darkgray;">(Only for RCD)</p>
			<div class="scrollable-table" style="clear: both; max-height: 70vh;">
				<div>
					<table>
						<thead>
							<tr>
								<th style="width: 5%;">Item</th>
								<th style="width: 5%;">Count</th>
								<th>Name</th>
							</tr>
						</thead>
						<tbody class="table-content"></tbody>
					</table>
				</div>
			</div>
		`

	type Type = "map" | "export-tool"

	let type: Type,
		tBody: HTMLTableSectionElement,
		elMaterials: HTMLElement,
		elOnlyRcdInfo: HTMLElement,
		objects: Iterable<MapObject>

	function fill(withObjects?: Iterable<MapObject>) {
		if (withObjects)
			objects = withObjects
		if (!objects) return
		tBody.innerHTML = ""

		const reqResources = new Map<Item, number>(),
			map = new Map<Item, number>(),
			onlyRcdActive = winMan.bpStr.win.isOpen && editorMap.onlyRcdItems

		for (const o of objects) {
			if (!(o.item && o.isValid && !o.isDisabled && !(onlyRcdActive && !o.isRcdSupported)))
				continue

			map.set(o.item, (map.get(o.item) ?? 0) + 1)

			if (o.item.recipe != null) {
				for (const input of o.item.recipe.input) {
					const item = Item.getById(input.item)
					reqResources.set(item, (reqResources.get(item) ?? 0) + input.count)
				}
			}
		}

		elOnlyRcdInfo.style.display = onlyRcdActive ? "" : "none"

		elMaterials.innerHTML = Array.from(reqResources)
			.map(([item, count]) => {
				return `${count} <img src="${location.origin}/p?https://test.drednot.io/img/${item.image}.png" title="${item.name}" style="vertical-align: middle; width: 1.2em;">`
			}).join(" &nbsp;")

		let i = 0
		for (const [item, count] of Array.from(map).sort((a, b) => b[1] - a[1])) {
			tBody.insertAdjacentHTML("beforeend",
				`<tr${i % 2 == 0 ? " class=\"odd\"" : ""}>`
				+ /*html*/`
					<td><img src="${location.origin}/p?https://test.drednot.io/img/${item.image}.png"></td>
					<td>${count}</td>
					<td>${getUnpackagedName(item)}</td>
				`+ `</tr>`
			)
			++i
		}
	}

	const win = new Dialog({
		id: "dialog-itemmatlist",
		draggable: { key: "itemmatlist" },
		defaultPos: { left: "8%", top: "8%" },
		body,
		onCreate(dialog) {
			tBody = elByCls<HTMLTableSectionElement>(dialog, "table-content")
			elMaterials = elByCls(dialog, "materials")
			elOnlyRcdInfo = elByCls(dialog, "only-rcd")
			const fillH = () => fill()

			let updateDebounceTimer: number
			editorMap.on("bpchange", () => {
				if (dialog.isOpen && type == "map") {
					clearTimeout(updateDebounceTimer)
					updateDebounceTimer = setTimeout(fillH, 40)
				}
			})

			dialog.addEventListener("open", fillH)

			winMan.bpStr.win.addEventListener("open", fillH)
			winMan.bpStr.win.addEventListener("close", fillH)
		}
	})

	return {
		win,
		get type() { return type },
		MAIN_TITLE,
		setSource(toObjects: Iterable<MapObject>) {
			objects = toObjects
			if (win.isOpen)
				fill()
			return this
		},
		setType(toType: Type) {
			if (type == toType)
				return this
			type = toType

			let title: string

			if (type == "map") {
				title = "Map"
			} else if (type == "export-tool") {
				title = "Export Tool"
			}

			win.elTitle.textContent = `${MAIN_TITLE} (${title})`
			return this
		},
		toggle() {
			return win.toggle(), this
		}
	}
}
