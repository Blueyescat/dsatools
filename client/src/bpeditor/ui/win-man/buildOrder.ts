import { Blueprint, BuildCmd, Item } from "dsabp-js"
import { getUnpackagedName } from "../../util.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"

export function initBuildOrder() {
	const MAIN_TITLE = "Build Order",
		body = /*html*/`
			<div class="scrollable-table" style="clear: both; max-height: 75vh;">
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
		table: HTMLTableElement,
		tBody: HTMLTableSectionElement,
		bp: Blueprint

	async function fill(withBp?: Blueprint) {
		if (withBp)
			bp = withBp
		table.style.width = table.offsetWidth + "px"
		tBody.innerHTML = ""

		let lastItem: [Item, number]
		const array: [Item, number][] = []
		for (const cmd of bp.commands) {
			if (!(cmd instanceof BuildCmd)) continue

			if (lastItem?.[0] != cmd.item)
				array.push(lastItem = [cmd.item, 0])
			lastItem[1] += cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1
		}

		let i = 0
		for (const [item, count] of array) {
			tBody.insertAdjacentHTML("beforeend",
				`<tr${i % 2 == 0 ? " class=\"odd\"" : ""}>`
				+ /*html*/`
					<td><img src="${location.origin}/p?https://test.drednot.io/img/${item.image}.png"></td>
					<td>${count}</td>
					<td>${getUnpackagedName(item)}</td>
				`+ `</tr>`
			)
			++i
			if (i % 25 == 0)
				await new Promise(r => setTimeout(r))
		}
		table.style.removeProperty("width")
	}

	const win = new Dialog({
		id: "dialog-buildorder",
		draggable: { key: "buildorder" },
		defaultPos: { left: "70.8%", top: "8%" },
		body,
		onCreate(dialog) {
			table = dialog.getElementsByTagName("table")[0] as HTMLTableElement
			tBody = elByCls<HTMLTableSectionElement>(dialog, "table-content")
			dialog.addEventListener("open", () => fill())
			// EditorMap uses bpStr.setBlueprint on bp change
		}
	})

	return {
		win,
		get type() { return type },
		MAIN_TITLE,
		setSource(toBp: Blueprint) {
			bp = toBp
			if (win.isOpen)
				fill()
			return this
		},
		fill,
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
