import { Blueprint, decode, FixedAngle, Item } from "dsabp-js"
import { EditorMap } from "../EditorMap.js"
import { updateObject } from "./updateObject.js"
import { toggleThrobber } from "/assets/throbber.js"

export async function importBlueprint(editorMap: EditorMap, bp: Blueprint, bpStr: string, noHistory?: boolean) {
	toggleThrobber("Placing blueprint...")

	bp ??= await decode(bpStr)

	const { bp: mapBp, selection, history, events } = editorMap

	const placeInfo = [] as [x: number, y: number, item: Item][]

	selection.clearSelection()

	const offset = { x: Math.floor((mapBp.width - bp.width) / 2), y: Math.floor((mapBp.height - bp.height) / 2) }
	const objects = await editorMap.loadBpCommands(bp, offset, true, { bpStr: true })

	for (const obj of objects) {
		placeInfo.push([obj.x, obj.y, obj.item])

		selection.selectObject(obj)

		let valid: boolean

		// object created without hullDirection
		// it is a problem to have no hullDirection and this makes it look better - but needs a nicer way
		if (!obj.hullDirection && (obj.item.enumName.startsWith("TURRET") || obj.item.enumName.startsWith("THRUSTER")) && obj.item.buildInfo?.[0].allow_world) {
			valid = false
			let hullDirection: FixedAngle
			if (obj.y - offset.y == 0)
				hullDirection = FixedAngle.DOWN
			else if (obj.y - offset.y == bp.height - 1)
				hullDirection = FixedAngle.UP
			else if (obj.x - offset.x == 0)
				hullDirection = FixedAngle.LEFT
			else if (obj.x - offset.x == bp.width - 1)
				hullDirection = FixedAngle.RIGHT
			obj.hullDirection = hullDirection
			updateObject(obj)
		}

		obj.isValid = valid ?? !editorMap.getObjectByPos(obj.x, obj.y,
			o => !o.bgTileType && o != obj
		)
	}
	selection.onSelectionChange()

	if (!noHistory)
		history.addPreset("importBlueprint", bpStr, placeInfo)

	events.pointer.check()
	editorMap.updateBpStr()
	toggleThrobber()
}
