// eslint-disable-next-line
import { Blueprint, BuildBits, BuildCmd, ConfigCmd, Item, LoaderPoint, Shape } from "dsabp-js"

const shapeFlipMap = {
	H: new Map([
		[Shape.RAMP_DL, Shape.RAMP_DR],
		[Shape.RAMP_UL, Shape.RAMP_UR],
		[Shape.SLAB_L, Shape.SLAB_R],
		[Shape.HALF_RAMP_1_D, Shape.HALF_RAMP_1_DI],
		[Shape.HALF_RAMP_1_L, Shape.HALF_RAMP_1_RI],
		[Shape.HALF_RAMP_2_D, Shape.HALF_RAMP_2_DI],
		[Shape.HALF_RAMP_2_L, Shape.HALF_RAMP_2_RI],
		[Shape.HALF_RAMP_1_UI, Shape.HALF_RAMP_1_U],
		[Shape.HALF_RAMP_1_LI, Shape.HALF_RAMP_1_R],
		[Shape.HALF_RAMP_2_UI, Shape.HALF_RAMP_2_U],
		[Shape.HALF_RAMP_2_LI, Shape.HALF_RAMP_2_R],
		[Shape.HALF_RAMP_3_D, Shape.HALF_RAMP_3_DI],
		[Shape.HALF_RAMP_3_L, Shape.HALF_RAMP_3_RI],
		[Shape.HALF_RAMP_3_UI, Shape.HALF_RAMP_3_U],
		[Shape.HALF_RAMP_3_LI, Shape.HALF_RAMP_3_R],
		[Shape.QUARTER_DL, Shape.QUARTER_DR],
		[Shape.QUARTER_UL, Shape.QUARTER_UR],
		[Shape.QUARTER_RAMP_DL, Shape.QUARTER_RAMP_DR],
		[Shape.QUARTER_RAMP_UL, Shape.QUARTER_RAMP_UR],
		[Shape.BEVEL_DL, Shape.BEVEL_DR],
		[Shape.BEVEL_UL, Shape.BEVEL_UR]
	]),
	V: new Map([
		[Shape.RAMP_UR, Shape.RAMP_DR],
		[Shape.RAMP_UL, Shape.RAMP_DL],
		[Shape.SLAB_U, Shape.SLAB_D],
		[Shape.HALF_RAMP_1_R, Shape.HALF_RAMP_1_RI],
		[Shape.HALF_RAMP_2_R, Shape.HALF_RAMP_2_RI],
		[Shape.HALF_RAMP_1_UI, Shape.HALF_RAMP_1_D],
		[Shape.HALF_RAMP_1_DI, Shape.HALF_RAMP_1_U],
		[Shape.HALF_RAMP_1_LI, Shape.HALF_RAMP_1_L],
		[Shape.HALF_RAMP_2_UI, Shape.HALF_RAMP_2_D],
		[Shape.HALF_RAMP_2_DI, Shape.HALF_RAMP_2_U],
		[Shape.HALF_RAMP_2_LI, Shape.HALF_RAMP_2_L],
		[Shape.HALF_RAMP_3_R, Shape.HALF_RAMP_3_RI],
		[Shape.HALF_RAMP_3_L, Shape.HALF_RAMP_3_LI],
		[Shape.HALF_RAMP_3_UI, Shape.HALF_RAMP_3_D],
		[Shape.HALF_RAMP_3_DI, Shape.HALF_RAMP_3_U],
		[Shape.QUARTER_UR, Shape.QUARTER_DR],
		[Shape.QUARTER_UL, Shape.QUARTER_DL],
		[Shape.QUARTER_RAMP_DR, Shape.QUARTER_RAMP_UR],
		[Shape.QUARTER_RAMP_UL, Shape.QUARTER_RAMP_DL],
		[Shape.BEVEL_DR, Shape.BEVEL_UR],
		[Shape.BEVEL_UL, Shape.BEVEL_DL]
	])
}
const loaderFlipMap = {
	H: new Map([
		[LoaderPoint.TOP_LEFT, LoaderPoint.TOP_RIGHT],
		[LoaderPoint.LEFT, LoaderPoint.RIGHT],
		[LoaderPoint.BOTTOM_LEFT, LoaderPoint.BOTTOM_RIGHT]
	]),
	V: new Map([
		[LoaderPoint.TOP_LEFT, LoaderPoint.BOTTOM_LEFT],
		[LoaderPoint.TOP, LoaderPoint.BOTTOM],
		[LoaderPoint.TOP_RIGHT, LoaderPoint.BOTTOM_RIGHT]
	])
}

for (const D of ["H", "V"]) {
	for (const [k, v] of shapeFlipMap[D])
		shapeFlipMap[D].set(v, k)
	for (const [k, v] of loaderFlipMap[D])
		loaderFlipMap[D].set(v, k)
}

/**
 * @param {Blueprint} bp
 * @param {"H"|"V"} D direction
 */
export function flip(bp, D) {
	for (const cmd of bp.commands) {
		if (cmd instanceof ConfigCmd) {
			if (cmd.loader?.pickupPoint != null)
				cmd.loader.pickupPoint = loaderFlipMap[D].get(cmd.loader.pickupPoint) ?? cmd.loader.pickupPoint
			if (cmd.loader?.dropPoint != null)
				cmd.loader.dropPoint = loaderFlipMap[D].get(cmd.loader.dropPoint) ?? cmd.loader.dropPoint
			if (cmd.pusher?.angle != null) {
				cmd.pusher.angle = (D == "H" ? 180 : 360) - cmd.pusher?.angle
				if (cmd.pusher.angle < 0)
					cmd.pusher.angle += 360
			}
			if (cmd.angle != null) {
				cmd.angle = (D == "H" ? 180 : 360) - cmd.angle
				if (cmd.angle < 0)
					cmd.angle += 360
			}
		} else if (cmd instanceof BuildCmd) {
			if (cmd.shape)
				cmd.shape = shapeFlipMap[D].get(cmd.shape) ?? cmd.shape
			if (D == "H") {
				if (cmd.bits) {
					cmd.bits = new BuildBits(cmd.bits.toString().split("").reduce((r, c) => c + r))
					cmd.x += cmd.bits.size - 1
				}
				cmd.x = bp.width - cmd.x - 1
			} else if (D == "V") {
				cmd.y = bp.height - cmd.y - 1
			}
		}
	}
}

/**
 * @param {Blueprint} bp
 * @param {{delete: boolean, top: number, right: number, bottom: number, left: number}} options
 */
export function crop(bp, options) {
	const pL = { x: options.left, y: options.bottom },
		pR = { x: bp.width - options.right - 1, y: bp.height - options.top - 1 }

	bp.commands = bp.commands.filter(cmd => {
		if (cmd instanceof ConfigCmd)
			return true

		if (cmd instanceof BuildCmd) {
			if (cmd.bits && !cmd.bits.isOne()) {
				let newX
				for (const [i, bit] of cmd.bits.toArray().entries()) {
					if (bit != true) continue
					if (!isIn(cmd.x + i, cmd.y)) {
						if (newX == null)
							newX = cmd.x + i
						continue
					}
					cmd.bits.clear(i)
					if (cmd.bits.isZero()) // became empty, remove the command
						return false
				}
				cmd.x = newX
				cmd.bits.trimLeadZeros()
			}
			if (isIn(cmd.x, cmd.y)) {
				return false
			}
			if (options.delete) {
				cmd.x -= options.left
				cmd.y -= options.bottom
			}
			return true
		}
	})

	if (options.delete) {
		bp.width -= options.right + options.left
		bp.height -= options.top + options.bottom
	}
	stripRedundantCfgCmds(bp)

	function isIn(x, y) {
		const r = (x >= pL.x && x <= pR.x && y >= pL.y && y <= pR.y)
		return options.delete ? !r : r
	}
}

/**
 * @param {Blueprint} bp
 * @param {number} angle
 */
export function rotate(bp, angle) {
	const cX = bp.width / 2
	const cY = bp.height / 2
	angle *= Math.PI / 180
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)

	let minX = Infinity, minY = Infinity
	let maxX = 0, maxY = 0

	expandBuildBits(bp)

	for (const cmd of bp.commands) {
		if (!(cmd instanceof BuildCmd)) continue
		[cmd.x, cmd.y] = rotateC(cmd.x, cmd.y)
		minX = Math.min(minX, cmd.x)
		minY = Math.min(minY, cmd.y)
		maxX = Math.max(maxX, cmd.x)
		maxY = Math.max(maxY, cmd.y)
	}

	for (const cmd of bp.commands) {
		if (!(cmd instanceof BuildCmd)) continue
		cmd.x = cmd.x - minX
		cmd.y = cmd.y - minY
	}

	bp.width = Math.ceil((maxX - minX) + 1)
	bp.height = Math.ceil((maxY - minY) + 1)

	makeBuildBits(bp)

	function rotateC(x, y) {
		return [
			toFixed(((x - cX) * cos) - ((y - cY) * sin) + cX),
			toFixed(((x - cX) * sin) + ((y - cY) * cos) + cY)
		]
	}
}

function toFixed(n, digits = 10) {
	const f = 10 ** digits
	return Math.round(n * f) / f
}

/**
 * @param {Blueprint} bp
 * @param {{search: string[], replacement: string}} options
 * @returns {number} Replaced amount
 */
export function replace(bp, options) {
	const { search, replacement } = options
	const del = replacement == ""
	let amount = 0

	const searchItems = new Set(resolveItemInputs(search))
	const doSearchAir = searchItems.has(Item.NULL)

	const replacementItem = del ? Item.NULL
		: !isNaN(replacement) ? Item.getById(parseInt(replacement)) : resolveItemName(replacement)[0]

	if (replacementItem == null) return amount

	const filled = new Set()
	let i = bp.commands.length
	while (i--) {
		const cmd = bp.commands[i]
		if (!(cmd instanceof BuildCmd)) continue

		if (doSearchAir) {
			if (cmd.bits) {
				let bitI = 0
				for (const bit of cmd.bits) {
					if (bit) filled.add(`${cmd.x + bitI},${cmd.y}`)
					++bitI
				}
			} else {
				filled.add(`${cmd.x},${cmd.y}`)
			}
		}

		if (searchItems.has(cmd.item)) {
			if (del) {
				bp.commands.splice(i, 1)
			} else {
				cmd.item = replacementItem
				if (!replacementItem.isBuildable)
					cmd.shape = undefined
			}
			amount += cmd.bits ? cmd.bits.toArray().filter(bit => bit).length : 1
		}
	}

	stripRedundantCfgCmds(bp)

	if (doSearchAir) {
		expandBuildBits(bp)
		for (let x = 0; x < bp.width; x++) {
			for (let y = 0; y < bp.height; y++) {
				if (!filled.has(`${x},${y}`)) {
					bp.commands.push(new BuildCmd({ x, y, item: replacementItem }))
					++amount
				}
			}
		}
		makeBuildBits(bp)
	}

	return amount
}

function resolveItemInputs(inputs) {
	const output = []
	/** @type {Set<"block"|"buildable"|"nonbuildable"|"mac"|"bigmac"|"smallmac"|"hull">} */
	const categories = new Set()

	for (const s of new Set(inputs)) {
		if (s == "block") categories.add("block")
		else if (s == "buildable") categories.add("buildable")
		else if (s == "non-buildable" || s == "nonbuildable") categories.add("nonbuildable")
		else if (s == "machine") categories.add("mac")
		else if (s == "big machine") categories.add("bigmac")
		else if (s == "1x1 machine" || s == "small machine") categories.add("smallmac")
		else if (s == "hull mounted" || s == "hull-mounted" || s == "hull") categories.add("hull")
		else // not a category
			!isNaN(s) ? output.push(Item.getById(parseInt(s))) : output.push(...resolveItemName(s))
	}

	/** @param {Item} i */
	const isBigMac = i => i.buildInfo?.[0]?.bounds.x > 1 || i.buildInfo?.[0]?.bounds.y > 1

	if (categories.size) {
		for (const item of Item.getMap().values()) {
			if (categories.has("block") && item.isBlock
				|| categories.has("buildable") && item.isBuildable
				|| categories.has("nonbuildable") && !item.isBuildable
				|| categories.has("mac") && item.isBuildable && !item.isBlock
				|| categories.has("bigmac") && item.isBuildable && !item.isBlock && isBigMac(item)
				|| categories.has("smallmac") && item.isBuildable && !item.isBlock && !isBigMac(item)
				|| categories.has("hull") && item.isBuildable && item.buildInfo?.[0]?.require_blocks?.[0].block.includes("HULL")
			)
				output.push(item)
		}
	}
	return output
}

/** Item name to items */
function resolveItemName(name) {
	if (name == "air")
		return [Item.NULL]

	const output = []
	for (const item of Item.getMap().values()) {
		if (item.name.toLowerCase().includes(name))
			output.push(item)
	}
	return output
}

/**
 * Compresses all build commands to the smallest amount of BuildBits possible.
 * Meant to be used on a BP that has no BuildBits.
 * Made quickly. It could probably be much more efficient and clean.
 * @param {Blueprint} bp
 */
function makeBuildBits(bp) {
	class BuildCmdGroup {
		/** @type {ConfigCmd} */
		cfgCmd
		/** @type {Array<BuildCmd>} */
		commands
		constructor(cmd, cfgCmd) {
			this.commands = [cmd]
			this.cfgCmd = cfgCmd
		}
		get item() {
			return this.commands[0]?.item
		}
		get shape() {
			return this.commands[0]?.shape
		}
	}

	/** @type {Object<string, BuildCmdGroup[]>} */
	const rows = {}
	let currentCfg
	for (const cmd of bp.commands) {
		if (cmd instanceof ConfigCmd) {
			currentCfg = cmd
		} else if (cmd instanceof BuildCmd) {
			if (!rows[cmd.y])
				rows[cmd.y] = []
			const existingGroup = findGroup(cmd)
			if (existingGroup)
				existingGroup.commands.push(cmd)
			else
				rows[cmd.y].push(new BuildCmdGroup(cmd, currentCfg?.clone()))
		}
	}

	bp.commands.length = 0
	const lastCommands = [] // used for cmd+build commands that need to be built last
	let lastCfg, cfgCmdIndex, lastBlockIndex = 0
	const rowsValues = Object.values(rows)
	for (let i = rowsValues.length - 1; i >= 0; i--) { // loop in reverse so rcd start from top
		for (const group of rowsValues[i]) {
			const useLastCommands = group.item == Item.EXPANDO_BOX
			cfgCmdIndex = (useLastCommands ? lastCommands : bp.commands).length

			if (group.cfgCmd && !group.cfgCmd.equals(lastCfg)) {
				const existingCfgCmdIndex = findExistingCfgCmdIndex(group.cfgCmd, useLastCommands)
				if (existingCfgCmdIndex > -1) {
					cfgCmdIndex = existingCfgCmdIndex
				} else {
					lastCfg = group.cfgCmd
					if (useLastCommands)
						lastCommands.push(group.cfgCmd)
					else
						bp.commands.push(group.cfgCmd)
				}
			}

			group.commands.sort((a, b) => a.x - b.x) // sort x coord left to right

			/** @type {BuildCmd[][]} */
			const chunks = [[]]
			for (const cmd of group.commands) {
				if (cmd.x - chunks[chunks.length - 1]?.[0]?.x >= 63)
					chunks.push([])
				chunks[chunks.length - 1].push(cmd)
			}
			for (const chunk of chunks) {
				const mainCmd = chunk.shift()
				if (chunk.length) {
					mainCmd.bits = new BuildBits("1")
					for (const cmd of chunk)
						mainCmd.bits.set(Math.floor(cmd.x - mainCmd.x))
				}
				(useLastCommands ? lastCommands : bp.commands)
					.splice(mainCmd.item.isBlock ? lastBlockIndex++ : cfgCmdIndex + 1, 0, mainCmd)
			}
		}
	}
	bp.commands.push(...lastCommands)

	/** @param {BuildCmd} cmd */
	function findGroup(cmd) {
		for (const group of rows[cmd.y]) {
			if ((Math.abs(group.commands[0].x % 1 - cmd.x % 1) / group.commands[0].x || 0) == 0
				&& group.item == cmd.item
				&& group.shape == cmd.shape
				&& ((group.cfgCmd && currentCfg) ? group.cfgCmd.equals(currentCfg) : true)
			)
				return group
		}
	}

	function findExistingCfgCmdIndex(targetCmd, useLastCommands) {
		const cmds = useLastCommands ? lastCommands : bp.commands
		for (let i = cmds.length - 1; i >= 0; i--) {
			if (cmds[i] instanceof ConfigCmd && cmds[i].equals(targetCmd)) {
				return i
			}
		}
		return -1
	}
}

function expandBuildBits(bp) {
	let i = bp.commands.length
	while (i--) {
		const cmd = bp.commands[i]
		if (!(cmd instanceof BuildCmd && cmd.bits && !cmd.bits.isOne())) continue

		bp.commands.splice(i, 1)
		let setBitI = 0, bitI = 0
		for (const bit of cmd.bits) {
			if (bit) {
				const newCmd = new BuildCmd({ x: cmd.x + bitI, y: cmd.y, item: cmd.item, shape: cmd.shape })
				bp.commands.splice(i + setBitI, 0, newCmd)
				++setBitI
			}
			++bitI
		}
	}
}

/** @param {Blueprint} bp */
function stripRedundantCfgCmds(bp) {
	const cmds = bp.commands
	let i = cmds.length
	while (i--) {
		if (!(cmds[i] instanceof ConfigCmd)) continue
		// if previous is a cfg, delete previous (redundant adjacent)
		if (cmds[i - 1] instanceof ConfigCmd) cmds.splice(i - 1, 1)
		// if current is first item, delete current (redundant at end)
		if (i == cmds.length - 1) cmds.splice(i, 1)
	}
}
