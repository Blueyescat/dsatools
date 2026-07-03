import { Blueprint, encode, Item, PREFIX } from "dsabp-js"
import { setLastCopiedBpStr } from "../../main.js"
import { MapObject } from "../../MapObject.js"
import { getBpInfoHtml } from "../../util.js"
import { editorMap, winMan } from "../uiMain.js"
import { cleanItemInput, processBuildCommands, resolveItemInputs } from "/bptools/operations.js"
import { Dialog } from "/Dialog.js"
import { addTooltip, elByCls } from "/main.js"
import { toast } from "/Toast.js"

export function initBpStr() {
	const body = /*html*/`
		<details class="sorter" style="width: calc(100% - 1rem);">
			<summary>
				Sort by Item<span class="active-state" style="display: none;"> (Active)</span>&nbsp;
				<span class="tooltip-ref" data-clone data-allow-hover onclick="return false">
					<span class="help-circle"></span>
					<span class="tooltip-space"></span>
					<span class="tooltip-content smaller">
						<p>
							This provides a blueprint with commands sorted by item type (therefore grouped). As a result, the RCD processes all build commands
							for each item type in a row, which helps with feeding the RCD with items. In some cases it can also shorten a blueprint.
						</p>
						<p>
							<ul>
								<li>Default first: <code>cannon, thruster, block, starter,&nbsp;</code></li>
								<li>Default last: <code>expando box, hatch,&nbsp;</code></li>
							</ul>
						</p>
						<p>
							Defaults to sort expando boxes and hatches at last when the section is closed.
						</p>
					</span>
				</span>
			</summary>
			<p style="display: flex; gap: 0.3em; align-items: center; margin-bottom: 0.6em;">
				Place first: <input class="input-first" style="flex: 1;" data-save placeholder="block, cannon,comms, 236..." value="cannon, thruster, block, starter, ">
			</p>
			<p style="display: flex; gap: 0.3em; align-items: center; margin-bottom: 0.5em;">
				Place last: <input class="input-last" style="flex: 1;" data-save placeholder="expando, fabricator..." value="expando box, hatch, ">
			</p>
			<p class="smaller" style="float: right; margin-right: 1em;">
				Separate items with commas. See
				<span class="tooltip-ref" data-allow-hover data-click-triggered data-clone>
					<a class="no-link">Item List</a>.
					<span class="tooltip-space"></span>
					<span class="tooltip-content">
						<span class="item-list" style="display: inline-block; max-height: 40vh; overflow-y: scroll; font-family: monospace; overscroll-behavior: contain; font-size: medium;">
							<b>Categories:</b> <code>Air, Block, Buildable, Non-Buildable, Machine, 1x1 Machine, Big Machine, Hull Mounted</code>
							<br><br>
						</span>
					</span>
				</span>
			</p>
			<p>
				<label style="cursor: pointer;">Sort other items by ascending ID: <input type="checkbox" class="cb-sort-others" data-save checked></label>
			</p>
		</details>
		<details class="build-dir" style="width: calc(100% - 1rem);">
			<summary>
				Build Direction<span class="active-state" style="display: none;"> (Active)</span>&nbsp;
			</summary>
			<p style="display: flex; gap: 0.3em; align-items: center; margin-bottom: 0.6em;">
				Main direction:
				<span class="radio-chips chips-main-dir">
					<label style="padding-block: 2px 5px;">
						<input type="radio" name="main-bdir" value="D" data-save=".chips-main-dir" checked><i class="i arrow-r r90"></i>
					</label>
					<label style="padding-block: 2px 5px;">
						<input type="radio" name="main-bdir" value="U" data-save=".chips-main-dir"><i class="i arrow-r r-90"></i>
					</label>
				</span>
			</p>
			<p style="display: flex; gap: 0.3em; align-items: center; margin-bottom: 0.6em;">
				Reverse direction for: <input class="input-rev-dir-items" style="flex: 1;" data-save placeholder="expando box, " value="expando box, ">
			</p>
			<p style="display: flex; gap: 0.3em; align-items: center; margin-bottom: 0.6em;">
				Prioritize y-coord sorting for:
				<span class="tooltip-ref" data-clone data-allow-hover style="line-height: 1em;">
					<span class="help-circle"></span>
					<span class="tooltip-space"></span>
					<span class="tooltip-content smaller">
						<span style="display: inline-block; margin-bottom: 0.9em;">
							Some objects might not be placed in the desired order because it tries to group
							objects with the same configuration under a single config command.
						</span>
						<span style="display: inline-block; margin-bottom: 0.9em;">
							This option makes it ignore the config for certain items. The BP scanner in the game also does this for expando boxes.
							It will increase the number of config commands. "<code>block, machine</code>" can be used to include all items.
						</span>
						<span>
							Defaults to expando boxes when the section is closed. (The same for reverse direction items.)
						</span>
					</span>
				</span>
				<input class="input-prioritize-y-items" style="flex: 1;" data-save placeholder="expando box, " value="expando box, ">
			</p>
		</details>
		<p style="margin-bottom: 0.3em;"><textarea id="bp" rows="5" spellcheck="false" autocomplete="off"></textarea></p>
		<p class="info" style="font-size: smaller; float: left;">Changing this will load a new map.</p>
		<label style="cursor: pointer; font-size: smaller; float: right;">
			Only for RCD: <input type="checkbox" class="cb-only-rcd" data-save checked>
			<span class="tooltip-ref" data-clone data-allow-hover>
				<span class="help-circle"></span>
				<span class="tooltip-content smaller">
					Whether to exclude objects not supported by the RCD or outside the ship.
				</span>
			</span>
		</label>
		<ul class="bp-info" style="clear: both;"></ul>
	`

	const INFO_NEW_MAP = "Changing this will load a new map.",
		INFO_OWNER = "Only the room owner can load a new blueprint."

	type Type = "map" | "export-tool"

	let type: Type,
		bp: Blueprint,
		mapBpStr: string,
		blockInput: boolean | string,

		textareaBp: HTMLTextAreaElement,
		elInputInfo: HTMLElement,
		elBpInfo: HTMLElement,
		objects: Iterable<MapObject>,
		cbOnlyRcd: HTMLInputElement,

		sortingEnabled: boolean,
		inputSorterFirst: HTMLInputElement,
		inputSorterLast: HTMLInputElement,
		cbSorterOthers: HTMLInputElement,

		buildDirEnabled: boolean,
		chipsBuildDirMain: HTMLElement,
		inputBuildDirReverseItems: HTMLInputElement,
		inputBuildDirPrioritizeYItems: HTMLInputElement,
		directionTopToBottom: boolean

	function setBpStr(str: string, forBp?: Blueprint) {
		textareaBp.value = PREFIX + (str ?? "")
		textareaBp.classList.add("changing")
		setTimeout(() => textareaBp.classList.remove("changing"), 300)
		elInputInfo.innerHTML = typeof blockInput == "string" ? blockInput : INFO_NEW_MAP
		if (type == "map")
			mapBpStr = str
		elBpInfo.innerHTML = getBpInfoHtml(forBp ?? bp, textareaBp.value, type != "map")
	}

	const resItemInputsOpts = { followInputCategoriesOrder: true, onlyBuildables: true }

	function processBp() {
		const opts: Parameters<typeof processBuildCommands>["1"] = {
			inPlace: false
		}

		if (sortingEnabled) {
			opts.sortOthers = cbSorterOthers.checked
			opts.sortFirst = new Set(resolveItemInputs(cleanItemInput(inputSorterFirst.value), resItemInputsOpts))
			opts.sortLast = new Set(resolveItemInputs(cleanItemInput(inputSorterLast.value), resItemInputsOpts))
		}

		if (buildDirEnabled) {
			opts.directionTopToBottom = directionTopToBottom
			opts.reverseDirectionItems = resolveItemInputs(cleanItemInput(inputBuildDirReverseItems.value), resItemInputsOpts)
			opts.prioritizeYSortItems = resolveItemInputs(cleanItemInput(inputBuildDirPrioritizeYItems.value), resItemInputsOpts)
		}

		const newBp = processBuildCommands(bp, opts)

		winMan.buildOrder.setSource(newBp)
		encode(newBp).then(str => setBpStr(str, newBp))
	}

	const win = new Dialog({
		id: "dialog-bpstring",
		draggable: { key: "bpstring" },
		body,
		footer: {
			html: /*html*/`
				<button class="button-copy">Copy</button>`,
			closeButton: "Close"
		},
		onCreate(dialog) {
			textareaBp = dialog.querySelector("#bp") as HTMLTextAreaElement
			elBpInfo = elByCls(dialog, "bp-info")
			elInputInfo = elByCls(dialog, "info")
			cbOnlyRcd = elByCls(dialog, "cb-only-rcd")

			inputSorterFirst = elByCls(dialog, "input-first")
			inputSorterLast = elByCls(dialog, "input-last")
			cbSorterOthers = elByCls(dialog, "cb-sort-others")

			chipsBuildDirMain = elByCls(dialog, "chips-main-dir")
			inputBuildDirReverseItems = elByCls(dialog, "input-rev-dir-items")
			inputBuildDirPrioritizeYItems = elByCls(dialog, "input-prioritize-y-items")

			const btnCopy = elByCls<HTMLButtonElement>(dialog, "button-copy"),
				detailsSorter = elByCls<HTMLDetailsElement>(dialog, "sorter"),
				detailsBuildDir = elByCls<HTMLDetailsElement>(dialog, "build-dir"),

				itemBox = elByCls(dialog, "item-list"),
				buildables: string[] = [], items: string[] = []

			let inputTimer: number

			cbOnlyRcd.addEventListener("change", () => {
				editorMap.onlyRcdItems = cbOnlyRcd.checked
				editorMap.updateBpStr()
			})

			const handleDetailsToggle = () => {
				detailsSorter.getElementsByTagName("summary")[0].blur()
				sortingEnabled = detailsSorter.open
				buildDirEnabled = detailsBuildDir.open
				if (sortingEnabled || buildDirEnabled)
					processBp()
				else {
					if (type == "map")
						editorMap.updateBpStr()
					else {
						encode(bp).then(str => setBpStr(str))
						winMan.buildOrder.setSource(bp)
					}
				}
			}
			detailsSorter.addEventListener("toggle", () => handleDetailsToggle())
			detailsBuildDir.addEventListener("toggle", () => handleDetailsToggle())

			textareaBp.addEventListener("input", () => {
				if (type != "map")
					return
				clearTimeout(inputTimer)
				inputTimer = setTimeout(() => {
					if (editorMap.info.bpState == "loading")
						return
					let input = textareaBp.value.trim()
					if (input.substring(0, PREFIX.length).toUpperCase() == PREFIX)
						input = input.substring(PREFIX.length)
					editorMap.loadBlueprint(input, success => elInputInfo.innerHTML = success ? INFO_NEW_MAP : "<b>Invalid blueprint string.</b>")
						.then(success => {
							if (success) {
								setBpStr(input)
								if (sortingEnabled || buildDirEnabled)
									processBp()
							}
						})
				}, 500)
			})

			elBpInfo.addEventListener("click", e => {
				if (e.target instanceof HTMLAnchorElement)
					if (e.target.classList.contains("a-itemmatlist"))
						winMan.itemMatList.setType(type).setSource(objects).toggle()
					else if (e.target.classList.contains("a-buildorder"))
						winMan.buildOrder.setType(type).toggle()
			})

			btnCopy.addEventListener("click", () => {
				navigator.clipboard.writeText(textareaBp.value).then(() => {
					setLastCopiedBpStr(textareaBp.value)
					toast({ body: "Blueprint string copied to clipboard.", duration: 3000, color: "#0F0" })
					dialog.close()
				}).catch(() =>
					toast({ body: "Unable to copy to clipboard: no permission.", duration: 5000, color: "#F00" })
				)
			})

			const s = () => (sortingEnabled || buildDirEnabled) && processBp()
			inputSorterFirst.addEventListener("input", s)
			inputSorterLast.addEventListener("input", s)
			cbSorterOthers.addEventListener("change", s)

			for (const radio of chipsBuildDirMain.querySelectorAll("input"))
				radio.addEventListener("change", () => { directionTopToBottom = radio.value == "D"; s() })
			inputBuildDirReverseItems.addEventListener("input", s)
			inputBuildDirPrioritizeYItems.addEventListener("input", s)

			for (const el of dialog.getElementsByClassName("tooltip-ref"))
				addTooltip(el)

			setTimeout(() => {
				for (const item of Item.getMap().values()) {
					if (item != Item.NULL)
						(item.isBuildable ? buildables : items).push(`${item.id.toString().padStart(3, "0")}&nbsp; ${item.name}`)
				}
				itemBox.innerHTML += buildables.join("<br>") + "<br><br>" + items.join("<br>")
			}, 500)

			if (editorMap.collab.state.isRoomOwner == false) {
				blockInput = INFO_OWNER
				textareaBp.disabled = !!blockInput
			}

			editorMap.on("collab-status", status => {
				if (status == "joinedRoom")
					blockInput = !editorMap.collab.state.isRoomOwner && INFO_OWNER
				else if (status == "disconnected")
					blockInput = false
				elInputInfo.textContent = !blockInput ? INFO_NEW_MAP : blockInput as string
				textareaBp.disabled = !!blockInput
			})
		}
	})

	return {
		win,
		get type() { return type },
		get mapBpStr() { return mapBpStr },
		textareaBp,
		setBlueprint(toBp: Blueprint, bpStr: string, onlyIfMap?: boolean) {
			if (onlyIfMap && type != "map")
				return mapBpStr = bpStr, this
			bp = toBp

			if (sortingEnabled || buildDirEnabled)
				processBp()
			else {
				setBpStr(bpStr)
				winMan.buildOrder.setSource(bp)
			}

			if (type == "map")
				mapBpStr = bpStr

			return this
		},
		setObjectsSource(source: Iterable<MapObject>) {
			objects = source
			return this
		},
		setType(toType: Type) {
			if (type == toType)
				return this
			type = toType

			let title: string, allowInput: boolean

			if (type == "map") {
				title = "Map"
				allowInput = true
				this.setBlueprint(editorMap.bp, mapBpStr).setObjectsSource(editorMap.objects)
			} else if (type == "export-tool") {
				title = "Export Tool"
				allowInput = false
			}

			win.elTitle.textContent = `Blueprint String (${title})`
			elInputInfo.style.display = allowInput ? (typeof blockInput == "string" ? blockInput : "") : "none"
			textareaBp.disabled = !allowInput || !!blockInput

			return this
		},
		open() {
			!win.isOpen && win.open()
		}
	}
}
