import { ConfigCmd, Item, Shape } from "dsabp-js"
import { findBuildInfoIndex } from "dsabp-js-img"
import { createObject } from "../../actions/createObject.js"
import { deleteObject } from "../../actions/deleteObject.js"
import { checkPlacement } from "../../checkPlacement.js"
import { ConfigDiff, getConfigDiff, pathToObject } from "../../managers/configs.js"
import { MapObject, MapObjectData } from "../../MapObject.js"
import { deepEquals, objToData, some } from "../../util.js"
import { AllConds, ConfigConds, OtherItemConds, resolveCfgPath, TriState } from "../config-menu/ConfigMenu.js"
import * as itemPicker from "../itemPicker.js"
import { ItemSlot } from "../ItemSlot.js"
import * as shapePicker from "../shapePicker.js"
import { editorMap } from "../uiMain.js"
import { updateObject } from "/bpeditor/actions/updateObject.js"
import { Dialog } from "/Dialog.js"
import { elByCls, switchTriStateCb } from "/main.js"

export function initFindReplace() {
	const body = /*html*/`
		<div style="position: relative;">
			<div>
				<p>
					<input type="checkbox" class="tricb cb-selecteds" data-state="null" data-use-label> <label style="--tricb-true: 'Limit to'; --tricb-false: 'Exclude'; --tricb-null: 'Include';"></label> selected objects (<span class="select-amount" style="color: var(--blue);">0</span>)
				</p>
				<p>
					<input type="checkbox" class="tricb cb-invalids" data-state="null" data-use-label> <label style="--tricb-true: 'Limit to'; --tricb-false: 'Exclude'; --tricb-null: 'Include';"></label> invalid objects (<span class="invalid-amount" style="color: #ff1010;">0</span>)
				</p>
				<div style="margin-block: 0.9em;">
					<label style="cursor: pointer;" title="Match squares where a full block can fit?">
						<input type="checkbox" class="cb-find-air"> Air
					</label>
					&nbsp;&nbsp;
					<span class="dropdown menu find-groups">
						<button class="dropdown-trigger">
							Add group of items &nbsp;<i class="i angle-right r90" style="font-weight: bold;"></i>
						</button>
						<ul tabindex="0" style="margin-top: 0.2em;">
							<li><button data-g="block">Tiles</button></li>
							<li><button data-g="mac">Machines</button></li>
							<li><button data-g="1x1mac">1x1 machines</button></li>
							<li><button data-g="bigmac">Big machines</button></li>
							<li><button data-g="hull">Hull-mounted</button></li>
							<li><button data-g="nonhull">Non-hull-mounted</button></li>
							<li><button data-g="starter">Starter</button></li>
						</ul>
					</span>
					&nbsp;&nbsp;
					<button class="button-clear">Clear <i class="i x"></i></button>
				</div>
				<div class="items-to-find">
					<span>
						<dt-item-slot></dt-item-slot>
						<i class="config-line"></i>
						<button class="button-config disabled" title="Specify configuration for the item"><i class="i sliders no-pointer"></i></button>
						<button class="button-remove-item" title="Remove item"><i class="i x no-pointer"></i></button>
					</span>
				</div>
				<p style="text-align: end;">
					Matched <b class="match-amount" style="color: #FF5733;">0</b> object<span class="match-plural">s</span>
					<button class="button-select disabled" style="padding: 0.6em">Select</button></p>
				<hr>
				<p>
					Replace with:&nbsp;
					<span class="replacement-item">
						<dt-item-slot></dt-item-slot>
						<i class="config-line"></i>
						<button class="button-config disabled" title="Specify configuration for the item"><i class="i sliders no-pointer"></i></button>
						<button class="button-remove-item" title="Remove item"><i class="i x no-pointer"></i></button>
					</span>
					<button class="button-replace" style="padding: 0.6em; float: right;">Replace</button>
				</p>
				<small style="margin-top: -1em; float: right;">(empty = delete)</small>
			</div>
		</div>
	`

	const configMan = editorMap.configs,
		toFindArr: { item?: Item, config?: ConfigCmd, shape?: Shape, conditions?: AllConds }[] = [],
		replacement: { item?: Item, config?: ConfigCmd, shape?: Shape, conditions?: AllConds } = {},
		matchedObjects = new Set<MapObject>()

	let isConfigMenuOpen: boolean,
		openConfigButton: HTMLElement,
		openConfigDialog: Dialog,
		findAir: boolean,
		selecteds: TriState = null,
		invalids: TriState = null

	const win = new Dialog({
		id: "dialog-findreplace",
		title: "Find - Replace",
		draggable: { key: "findreplace" },
		defaultPos: { left: "66%", top: "10%" },
		body,
		onCreate(dialog) {
			dialog.elBody.style.overflow = "unset"

			const cbSelecteds = elByCls<HTMLInputElement>(dialog, "cb-selecteds"),
				cbInvalids = elByCls<HTMLInputElement>(dialog, "cb-invalids"),
				elSelectAmount = elByCls(dialog, "select-amount"),
				elInvalidAmount = elByCls(dialog, "invalid-amount"),
				cbAir = elByCls<HTMLInputElement>(dialog, "cb-find-air"),
				elGroups = elByCls(dialog, "find-groups"),
				btnClear = elByCls(dialog, "button-clear"),
				elFindRows = elByCls(dialog, "items-to-find"),
				elMatchAmount = elByCls(dialog, "match-amount"),
				elMatchPlural = elByCls(dialog, "match-plural"),
				btnSelect = elByCls(dialog, "button-select"),
				btnReplace = elByCls<HTMLButtonElement>(dialog, "button-replace")

			const updateSelectAmount = () => elSelectAmount.textContent = editorMap.selection.selectedObjects.size.toString(),
				updateInvalidAmount = () => {
					let a = 0
					editorMap.objects.forEach(o => !o.isValid && ++a)
					elInvalidAmount.textContent = a.toString()
				}

			editorMap.on("selectionchange", () => dialog.isOpen && updateSelectAmount())

			cbSelecteds.addEventListener("click", () => { selecteds = switchTriStateCb(cbSelecteds); update() })

			cbInvalids.addEventListener("click", () => { invalids = switchTriStateCb(cbInvalids); update() })

			cbAir.addEventListener("click", () => { findAir = cbAir.checked; update() })

			const initialFindRow = elFindRows.firstElementChild as HTMLElement,
				initialFindSlot = initialFindRow.getElementsByTagName(ItemSlot.localName)[0] as ItemSlot
			initialFindSlot.allowDrag = true
			initialFindSlot.allowDrop = "infinite"

			function handleFindSlotChange(row: HTMLElement, rowIndex: number, item: Item) {
				if (!item)
					return elByCls(row, "button-remove-item").click()

				toFindArr[rowIndex] = { item }

				const btnConfigClasses = elByCls(row, "button-config").classList
				btnConfigClasses.toggle("disabled", !configMan.isConfigured(item) && !configMan.isShaped(item))

				btnConfigClasses.remove("used")
				if (isConfigMenuOpen)
					configMan.close()

				if (row == elFindRows.lastElementChild)
					addRow()

				update()
			}

			initialFindSlot.addEventListener("change", () =>
				handleFindSlotChange(initialFindRow, 0, initialFindSlot.item)
			)

			const replacementRow = elByCls(dialog, "replacement-item")
			const replacementSlot = replacementRow.getElementsByTagName(ItemSlot.localName)[0] as ItemSlot
			replacementSlot.allowDrag = true
			replacementSlot.allowDrop = "infinite"
			replacementSlot.addEventListener("change", () => {
				if (!replacementSlot.item)
					return elByCls(replacementRow, "button-remove-item").click()
				replacement.item = replacementSlot.item
				replacement.config = null
				replacement.shape = null
				replacement.conditions = null
				const btnConfigClasses = elByCls(replacementRow, "button-config").classList
				btnConfigClasses.toggle("disabled", !configMan.isConfigured(replacementSlot.item) && !configMan.isShaped(replacementSlot.item))
				btnConfigClasses.remove("used")
			})

			function addRow(item?: Item, useLast?: boolean) {
				const lastRow = elFindRows.lastElementChild as HTMLElement

				let row = lastRow

				if (useLast && !toFindArr[elFindRows.children.length - 1]) {
					(row.getElementsByTagName(ItemSlot.localName)[0] as ItemSlot).setItem(item)
				} else {
					row = row.cloneNode() as HTMLElement
					const newBtnConfig = elByCls(lastRow, "button-config").cloneNode(true) as HTMLElement
					newBtnConfig.classList.remove("open")
					newBtnConfig.classList.toggle("disabled", !item || !(configMan.isConfigured(item) || configMan.isShaped(item)))

					const slot = new ItemSlot(item, { allowDrag: true, allowDrop: "infinite" })
					slot.addEventListener("change", () => {
						handleFindSlotChange(row, Array.from(elFindRows.children).indexOf(row), slot.item)
					})

					row.append(
						slot,
						elByCls(lastRow, "config-line").cloneNode(),
						newBtnConfig,
						elByCls(lastRow, "button-remove-item").cloneNode(true)
					)
					elFindRows.appendChild(row)

					if (item)
						(toFindArr[
							elFindRows.childElementCount - 1 // last row index
						] ??= {}).item = item
				}
			}

			btnClear.addEventListener("click", () => {
				const startLen = toFindArr.length + (findAir ? 1 : 0)
				toFindArr.length = 0;
				(elFindRows.lastElementChild.getElementsByTagName(ItemSlot.localName)[0] as ItemSlot).setItem(null)
				elFindRows.replaceChildren(elFindRows.lastElementChild)
				findAir = cbAir.checked = false
				if (startLen > 0)
					update()
			})

			dialog.addEventListener("click", e => {
				const target = e.target as HTMLElement
				if (!target) return

				if (elGroups.contains(target)) {
					if ("g" in target.dataset) {
						const g = target.dataset.g,
							startLen = toFindArr.length
						for (const item of Item.getMap().values()) {
							const bi = item.buildInfo?.[0],
								isBlock = !!bi?.block
							if (bi && (g == "block" && isBlock
								|| g == "mac" && !isBlock

								|| ((g == "1x1mac" || g == "bigmac") && !isBlock
									&& (bi?.bounds?.x > 1 || bi?.bounds?.y > 1) == (g == "bigmac"))

								|| ((g == "hull" || g == "nonhull")
									&& (bi?.require_blocks?.[0].block.includes("HULL") ?? false) == (g == "hull"))

								|| g == "starter" && item.enumName.includes("STARTER")
							) && !toFindArr.find(i => i?.item == item && !i.config && !i.shape)) // don't add if toFind has it without config
								addRow(item, true)
						}
						if (toFindArr.length > startLen) {
							addRow()
							update()
						}
					} else {
						itemPicker.close()
					}
					return
				}

				// - below is about rows -

				const rows = Array.from(elFindRows.children),
					row = target.parentElement,
					rowIndex = rows.indexOf(row),
					isFind = rowIndex > -1

				if (target.classList.contains("button-remove-item")) { // remove item
					if (isFind)
						toFindArr.splice(rowIndex, 1)
					else
						for (const k in replacement) delete replacement[k]

					const btnConfig = elByCls(row, "button-config")

					if (btnConfig == openConfigButton) {
						openConfigDialog.close()
						openConfigButton = openConfigDialog = null
					}

					if (!isFind || rows.length == 1) {
						(row.getElementsByTagName(ItemSlot.localName)[0] as ItemSlot).setItem(null)
						const btnConfigClasses = btnConfig.classList
						btnConfigClasses.add("disabled")
						btnConfigClasses.remove("used")
					} else
						row.remove()

					if (isFind)
						update()
				} else if (target instanceof ItemSlot) { // add/change item
					if (isConfigMenuOpen)
						configMan.close()
					itemPicker.open(item => {
						if (!item) return

						itemPicker.close()
						if (target.item == item)
							return

						target.setItem(item)
						// toFindArr is modified from slot change event
						// else is replacement, and .item is modified from slot change event
					})
				} else if (target.classList.contains("button-config") && !target.classList.contains("disabled")) { // config
					const toFind = isFind ? toFindArr[rowIndex] : null,
						thing = toFind ?? replacement

					configMan.close()

					if (!thing.conditions) {
						const isShaped = configMan.isShaped(thing.item)
						thing.conditions = {}
						if (isShaped)
							thing.conditions.shape = true
					}

					if (configMan.isConfigured(thing.item) && !thing.config)
						thing.config = new ConfigCmd()
					const dialog = configMan.openFor(thing.item, { sourceObject: thing, conditions: thing.conditions, addClassToDialog: isFind ? null : "replacement" })

					isConfigMenuOpen = !!dialog
					if (dialog) {
						openConfigButton = target
						openConfigDialog = dialog

						const menu = configMan.menu,
							btnRemoveCfg = elByCls(dialog.elFooter, "button-remove-config")

						// handle remove config button
						const removeLstnr = () => {
							delete thing.config
							delete thing.shape
							delete thing.conditions
							target.classList.remove("used")
							dialog.close()
							update()
						}
						btnRemoveCfg.addEventListener("click", removeLstnr, { once: true })

						// add listeners for changes on menu (if changing find options)
						let configLstnr, condLstnr, shapeLstnr
						if (isFind) {
							configLstnr = menu ? end => end && update() : null
							menu?.on("configchange", configLstnr)

							condLstnr = menu ? causedByConfigChange => !causedByConfigChange && update() : null
							menu?.on("condchange", condLstnr)

							shapeLstnr = configMan.isShapePickerOpen ? () => update() : null
							if (shapeLstnr) {
								shapePicker.events.on("shapechange", shapeLstnr)
								shapePicker.events.on("condchange", shapeLstnr)
							}
						} else {
							shapePicker.events.once("shapechange", () => dialog.close())
						}

						// remove stuff when the menu is closed
						dialog.addEventListener("close", () => {
							if (!isFind)
								dialog.classList.remove("replacement")
							target.classList.remove("open")
							btnRemoveCfg.removeEventListener("click", removeLstnr)

							if (configLstnr)
								menu.off("configchange", configLstnr)

							if (condLstnr)
								menu.off("condchange", configLstnr)

							if (shapeLstnr) {
								shapePicker.events.off("shapechange", shapeLstnr)
								shapePicker.events.off("condchange", shapeLstnr)
							}
							isConfigMenuOpen = false
						}, { once: true })

						if (isFind && !target.classList.contains("used"))
							update()
						target.classList.add("open", "used")
					}
				}
			})

			editorMap.on("selectionchange", () => selecteds != null && update())

			editorMap.on("mapchange", () => dialog.isOpen && (update(), updateInvalidAmount()))

			let findDebounceTimer: number
			function update() {
				if (!dialog.isOpen) return
				clearTimeout(findDebounceTimer)
				findDebounceTimer = setTimeout(() => find(), 40)
			}

			function find() {
				const airCheckBody = findAir && editorMap.collisions.createBox({ x: 0, y: 0 }, editorMap.squareSize, editorMap.squareSize, { isCentered: true })
				let notJustAir: boolean

				matchedObjects.forEach(o => o.removeOutline("find"))
				matchedObjects.clear()

				for (const obj of (selecteds == true ? editorMap.selection.selectedObjects : editorMap.objects)) {
					if (!obj.isDisabled
						&& (
							findAir && obj.bgTileType === "paint"
							&& airCheckBody.setPosition(obj.display.x, obj.display.y, true)
							&& checkPlacement(editorMap, Item.BLOCK, airCheckBody, obj.x, obj.y, 0).can
						)
						|| (
							(
								(invalids == true && !obj.isValid)
								|| (invalids == false && obj.isValid)
								|| (invalids == null)
							)
							&&
							(
								(selecteds == true && obj.isSelected)
								|| (selecteds == false && !obj.isSelected)
								|| (selecteds == null)
							)
							&& toFindArr.find(({ item, config, shape, conditions }) =>
								item === obj.item && (!conditions || checkConds(obj, item, config, shape, conditions))
							)
						)
					) {
						obj.setOutline(0xFF5733, "find")
						matchedObjects.add(obj)
						if (notJustAir == undefined && !obj.bgTileType)
							notJustAir = true
					}
				}

				if (airCheckBody)
					editorMap.collisions.remove(airCheckBody)

				elMatchAmount.textContent = matchedObjects.size.toString()
				elMatchPlural.textContent = matchedObjects.size != 1 ? "s" : ""
				btnSelect.classList.toggle("disabled", !matchedObjects.size || !notJustAir)
			}

			dialog.addEventListener("close", () => {
				matchedObjects.forEach(o => o.removeOutline("find"))
				matchedObjects.clear()
			})

			dialog.addEventListener("open", () => { update(); updateSelectAmount(); updateInvalidAmount() })

			btnSelect.addEventListener("click", () => {
				editorMap.selection.clearSelection(true)
				matchedObjects.forEach(o => !o.bgTileType && editorMap.selection.selectObject(o))
			})

			interface HistoryDataReplace {
				type: "new"
				deletedObject: MapObjectData
				newObject: MapObjectData
			}
			interface HistoryDataConfig {
				type: "config"
				undoShape: Shape
				redoShape: Shape
				configDiff: ConfigDiff
				x: number
				y: number
				item: Item
			}
			btnReplace.addEventListener("click", async () => {
				const undoRedoDataDelete: MapObjectData[] = [],
					undoRedoDataChange: (HistoryDataReplace | HistoryDataConfig)[] = []

				if (!replacement?.item) {
					for (const o of matchedObjects) {
						if (!o.bgTileType) {
							undoRedoDataDelete.push(objToData(o))
							deleteObject(o, false, { all: true })
						}
					}
					for (const data of undoRedoDataDelete)
						editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
							!some(undoRedoDataDelete, data => data.x == tx && data.y == ty)
						)
				} else {
					const rep = replacement
					for (const o of matchedObjects) {
						const cfgConds = rep.conditions?.item?.get(rep.item)?.config

						if (o.item == rep.item) { // change config
							let shapeChanged: boolean, cfgChanged: boolean,
								oldShape: Shape, oldCfg: ConfigCmd

							if ((o.shape || configMan.isShaped(o)) && rep.shape) {
								oldShape = o.shape
								o.shape = rep.shape
								shapeChanged = oldShape != o.shape
							}

							if (rep.config && cfgConds) {
								o.config ??= new ConfigCmd()
								oldCfg = o.config.clone()
								cfgChanged = conditionallyMergeConfigCmds(o.config, rep.config, cfgConds)
								if (!cfgChanged)
									oldCfg = null
							}

							if (cfgChanged || shapeChanged) {
								editorMap.configs.tryUpdate(o, false)
								if (await editorMap.configs.tryUpdate(o, false)) {
									const hist = { type: "config" } as HistoryDataConfig
									const configDiff = cfgChanged && getConfigDiff(oldCfg, o.config)
									hist.x = o.x
									hist.y = o.y
									hist.item = o.item
									if (configDiff?.length)
										hist.configDiff = configDiff
									if (shapeChanged) {
										hist.undoShape = oldShape ?? Shape.BLOCK
										hist.redoShape = o.shape
									}
									undoRedoDataChange.push(hist)
								} else {
									Object.assign(o.config, oldCfg)
									o.shape = oldShape
								}
							}
						} else { // place new object
							const hist = { type: "new" } as HistoryDataReplace,
								buildInfoIndex = findBuildInfoIndex(rep.item, o.hullDirection),
								{ snap_x, snap_y, offset, offset2 } = rep.item.buildInfo?.[buildInfoIndex] ?? {}

							let { x, y } = editorMap.toWorldPoint(o);
							({ x, y } = editorMap.toBpPoint(editorMap.placement.calc({ x, y }, snap_x, snap_y, offset, offset2)))

							let originalIsValid: boolean
							if (!o.bgTileType) {
								hist.deletedObject = objToData(o)
								originalIsValid = o.isValid
								o.isValid = false // not deleted yet
								o.isDisabled = true
							}

							const config = rep.config ? new ConfigCmd() : undefined
							if (config)
								conditionallyMergeConfigCmds(config, rep.config, cfgConds)

							const newObj = await createObject(hist.newObject = {
								editorMap, x, y, buildInfoIndex,
								item: rep.item,
								config,
								shape: rep.shape ?? o.shape
							}, false, { bpStr: true })

							const { item, body, buildInfoIndex: bii } = newObj
							if (checkPlacement(editorMap, item, body, x, y, bii, { passReqBlocksCheck: true }).can) {
								deleteObject(o, false, { all: true }) // now deleted
							} else {
								deleteObject(newObj, false, { all: true })
								delete hist.newObject
								o.isValid = originalIsValid
								o.isDisabled = false
							}
							undoRedoDataChange.push(hist)
						}
					}
				}

				if (undoRedoDataChange.length || undoRedoDataDelete.length)
					editorMap.history.add({
						type: "replace",
						undo: async () => {
							if (undoRedoDataChange.length) {
								for (const data of undoRedoDataChange) {
									if (data.type == "new") {
										await createObject(data.deletedObject, false, { bpStr: true })

										if (data.newObject) {
											deleteObject(editorMap.getObjectByPos(data.newObject.x, data.newObject.y, o => o.item == data.newObject.item), false, { all: true })
											editorMap.updateConnTexAround({ x: data.newObject.x, y: data.newObject.y }, false, (tx, ty) =>
												!some(undoRedoDataDelete, data => data.x == tx && data.y == ty)
											)
										}
									} else if (data.type == "config") {
										await undoRedoConfig(true, data)
									}
								}
							} else {
								for (const data of undoRedoDataDelete)
									await createObject(data, false, { bpStr: true })
							}

							editorMap.events.pointer.check()
							editorMap.updateBpStr()
						},
						redo: async () => {
							if (undoRedoDataChange.length) {
								for (const data of undoRedoDataChange) {
									if (data.type == "new") {
										deleteObject(editorMap.getObjectByPos(data.deletedObject.x, data.deletedObject.y, o => o.item == data.deletedObject.item), false, { all: true })
										editorMap.updateConnTexAround({ x: data.deletedObject.x, y: data.deletedObject.y }, false, (tx, ty) =>
											!some(undoRedoDataDelete, data => data.x == tx && data.y == ty)
										)

										if (data.newObject)
											await createObject(data.newObject, false, { bpStr: true })
									} else if (data.type == "config") {
										await undoRedoConfig(false, data)
									}
								}
							} else {
								for (const data of undoRedoDataDelete) {
									deleteObject(editorMap.getObjectByPos(data.x, data.y, o => o.item == data.item), false, { all: true })
									editorMap.updateConnTexAround({ x: data.x, y: data.y }, false, (tx, ty) =>
										!some(undoRedoDataDelete, data => data.x == tx && data.y == ty)
									)
								}
							}

							editorMap.events.pointer.check()
							editorMap.updateBpStr()
						}
					})

				editorMap.events.pointer.check()
				editorMap.updateBpStr()
			})

			async function undoRedoConfig(isUndo: boolean, hist: HistoryDataConfig) {
				const obj = editorMap.getObjectByPos(hist.x, hist.y, o => o.item == hist.item)
				if (!obj) return // ignore invalid

				if (hist.configDiff?.length)
					for (const { path, prev, curr } of hist.configDiff)
						pathToObject(obj.config, path, (isUndo ? prev : curr) ?? pathToObject(ConfigCmd.defaults, path))

				const s = isUndo ? hist.undoShape : hist.redoShape
				if (s) obj.shape = s

				await updateObject(obj, { keepBpStr: true })
			}
		}
	})

	return {
		win,
		toggle() {
			win.toggle()
		}
	}
}

function checkConds(targetObj: MapObject, item: Item, config: ConfigCmd, shape: Shape, conditions: AllConds) {
	const itemCond = conditions.item?.get(item)
	return conditionallyCompareConfigCmds(config, itemCond?.config, targetObj.config)
		&& (conditions.shape == undefined || (shape == (targetObj.shape ?? Shape.BLOCK)) == conditions.shape)
		&& checkOtherConds(targetObj, itemCond?.other)
}

function conditionallyCompareConfigCmds(cmd: ConfigCmd, conds: ConfigConds, targetCmd: ConfigCmd) {
	for (const inputKey in conds) {
		const cfgCond = conds[inputKey],
			queryCfgVal = resolveCfgPath(cmd, cfgCond.input),
			targetCfgVal = resolveCfgPath(targetCmd, cfgCond.input)

		if (cfgCond.cond != null && deepEquals(queryCfgVal, targetCfgVal, { ignoreArrayOrder: true }) != cfgCond.cond)
			return false
	}
	return true
}

function conditionallyMergeConfigCmds(targetcmd: ConfigCmd, sourceCmd: ConfigCmd, conds: ConfigConds) {
	let anyChange: boolean
	for (const inputKey in conds) {
		const cfgCond = conds[inputKey]
		if (cfgCond.cond != null) {
			const changed = resolveCfgPath(targetcmd, cfgCond.input, null, { value: resolveCfgPath(sourceCmd, cfgCond.input) })
			if (changed) anyChange ??= changed
		}
	}
	return anyChange ?? false
}

function checkOtherConds(obj: MapObject, otherConds: OtherItemConds) {
	if (otherConds?.ejectorHull != null) {
		if (obj.item == Item.ITEM_EJECTOR && (!!obj.hullDirection != otherConds.ejectorHull))
			return false
	}
	return true
}
