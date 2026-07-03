import { Body, Polygon, ensurePolygonPoints } from "detect-collisions"
import { Item, Shape } from "dsabp-js"
import type { EditorMap } from "./EditorMap.js"
import { MapObject } from "./MapObject.js"
import { scaleVertices } from "./util.js"

const allowSolidTiles = new Set([Item.BLOCK_WALKWAY, Item.BLOCK_LADDER, Item.BLOCK_ANNIHILATOR, Item.BLOCK_LOGISTICS_RAIL])

export function checkPlacement(editorMap: EditorMap, item: Item, body: Body, x: number, y: number, buildInfoIndex: number,
	options: {
		passCollisionCheck?: boolean,
		passReqBlocksCheck?: boolean,
		separate?: boolean
	} = {}
): {
	can: boolean,
	meetsRequirements: boolean,
	requiredBlocks: MapObject[],
	separated: boolean,
	separateFailed: boolean,
	buildInfoIndex: number
} {
	const { squareSize, collisions, placement } = editorMap

	const itemBuildInfo = item.buildInfo[buildInfoIndex]
	let meetsRequirements = true, requiredBlocks: MapObject[]
	if (itemBuildInfo.require_blocks)
		void ({ meets: meetsRequirements, found: requiredBlocks } = editorMap.findRequiredBlocks(itemBuildInfo, x, y, false))

	let collided: Body, separated: boolean, separateFailed: boolean

	if ((meetsRequirements || options.passReqBlocksCheck) && !options.passCollisionCheck) {
		let sepExistingBlock: { body: Polygon, originalPoints: SAT.Vector[] }
		if (item.isBlock) {
			const t = editorMap.getObjectByPos(x, y, o => o.item?.isBlock)
			if (t && t.isValid && t.body != body) {
				if (!options.separate)
					collided = t.body
				else { // make collided block temporarily have a square body
					sepExistingBlock = {
						body: t.body as Polygon,
						originalPoints: (t.body as Polygon).points.map(v => v.clone())
					};
					(t.body as Polygon).setPoints(ensurePolygonPoints(scaleVertices(null, null, Shape.BLOCK, squareSize)))
				}
			}
		}
		if (!collided) {
			let collidedBody: Body
			const sepOriginalPos = options.separate ? body.pos.clone() : null
			collisions.checkOne(body, res => {
				if (res.b == sepExistingBlock?.body)
					sepExistingBlock.body.setPoints(sepExistingBlock.originalPoints)

				const collObj = (res.b as Body).mapObject
				if (!collObj || collObj.isDisabled || !collObj.isValid)
					return
				const collItem = collObj.item
				const collBuildInfo = collObj.item?.buildInfo[collObj.buildInfoIndex]
				const isRCD = item == Item.RCD_FLUX || item == Item.RCD_SANDBOX || collItem == Item.RCD_FLUX || collItem == Item.RCD_SANDBOX

				if (itemBuildInfo.allow_world && collObj.bgTileType && collObj.bgTileType != "paint")
					return

				if (collBuildInfo?.allow_solids && itemBuildInfo.allow_non_solids
					|| collBuildInfo?.allow_non_solids && itemBuildInfo.allow_solids)
					return

				if (allowSolidTiles.has(collItem) && itemBuildInfo.allow_non_solids
					|| collBuildInfo?.allow_non_solids && allowSolidTiles.has(item))
					return

				// allow some overlap similar to the game - it is weird.
				let allowedOverlap = 0
				if (!isRCD) {
					if (
						(item == Item.EXPANDO_BOX && collItem != Item.EXPANDO_BOX)
						|| (item != Item.EXPANDO_BOX && collItem == Item.EXPANDO_BOX)
					)
						allowedOverlap = 0.7003376
					else if (item == Item.EXPANDO_BOX && collItem == Item.EXPANDO_BOX)
						allowedOverlap = 2
					else if (item.fab_type && collItem?.fab_type)
						allowedOverlap = 2
					else if (item == Item.RECYCLER && collItem == Item.RECYCLER)
						allowedOverlap = 2.00005
					else {
						++allowedOverlap
						if (collObj.bgTileType || collItem?.isBlock || item.isBlock || (collObj.hullDirection || itemBuildInfo.allow_world))
							++allowedOverlap
						if (!item.isBlock && !collItem?.isBlock)
							allowedOverlap += 0.00007
					}
				}

				if (Math.abs(res.overlapV.x) <= allowedOverlap && Math.abs(res.overlapV.y) < allowedOverlap) // no = for y
					return

				if (options.separate) {
					const worldPos = {
						x: body.x - (res.overlapV.x - (allowedOverlap - 1e-10) * res.overlapN.x),
						y: body.y - (res.overlapV.y - (allowedOverlap - 1e-10) * res.overlapN.y)
					}

					const { snap_x, snap_y, offset, offset2 } = itemBuildInfo
					if (snap_x || snap_y)
						placement.calc(worldPos, snap_x, snap_y, offset, offset2)

					body.setPosition(worldPos.x, worldPos.y)
					separated = true
				}
				collidedBody ??= res.b
			})

			if (separated) {
				const bpPoint = editorMap.toBpPoint(body)
				const res = checkPlacement(editorMap, item, body, bpPoint.x, bpPoint.y, buildInfoIndex)
				if (res.can) {
					collidedBody = null
					meetsRequirements = res.meetsRequirements
				} else {
					body.setPosition(sepOriginalPos.x, sepOriginalPos.y)
					separated = false
					separateFailed = true
				}
			}
			collided = collidedBody
		}
	}

	return { can: (meetsRequirements || options.passReqBlocksCheck) ? !collided?.mapObject : false, meetsRequirements, requiredBlocks, separated, separateFailed, buildInfoIndex }
}
