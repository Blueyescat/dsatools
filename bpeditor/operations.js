import items from "./assets/items.js"
// eslint-disable-next-line no-unused-vars
import { Blueprint, BuildBits, BuildCmd, ConfigCmd } from "../assets/lib/dsabp-js/index.min.js"

const shape = {
	H: {
		4: 1,
		3: 2,
		8: 6,
		17: 9,
		21: 13,
		16: 22,
		12: 18,
		11: 19,
		15: 23,
		24: 14,
		20: 10,
		29: 25,
		27: 31,
		28: 30,
		32: 26,
		36: 33,
		35: 34,
		40: 37,
		39: 38,
		44: 41,
		43: 42
	},
	V: {
		4: 3,
		1: 2,
		5: 7,
		17: 11,
		21: 15,
		23: 13,
		19: 9,
		24: 16,
		20: 12,
		10: 18,
		14: 22,
		29: 27,
		31: 25,
		28: 32,
		26: 30,
		36: 35,
		33: 34,
		40: 39,
		38: 37,
		44: 43,
		42: 41
	}
}
for (const key in shape.H) shape.H[shape.H[key]] = key
for (const key in shape.V) shape.V[shape.V[key]] = key

const loader = {
	H: {
		0: 2,
		3: 4,
		5: 7
	},
	V: {
		0: 5,
		1: 6,
		2: 7
	}
}
for (const key in loader.H) loader.H[loader.H[key]] = key
for (const key in loader.V) loader.V[loader.V[key]] = key

/**
 * @param {Blueprint} bp
 * @param {"H"|"V"} d direction
 */
export function flip(bp, d) {
	for (const cmd of bp.commands) {
		if (cmd instanceof ConfigCmd) {
			if (cmd.loader?.pickupPoint != null)
				cmd.loader.pickupPoint = parseInt(loader[d][cmd.loader.pickupPoint] ?? cmd.loader.pickupPoint)
			if (cmd.loader?.dropPoint != null)
				cmd.loader.dropPoint = parseInt(loader[d][cmd.loader.dropPoint] ?? cmd.loader.dropPoint)
			if (cmd.pusher?.angle != null) {
				cmd.pusher.angle = (d == "H" ? 180 : 360) - cmd.pusher?.angle
				if (cmd.pusher.angle < 0)
					cmd.pusher.angle += 360
			}
			if (cmd.angle != null) {
				cmd.angle = (d == "H" ? 180 : 360) - cmd.angle
				if (cmd.angle < 0)
					cmd.angle += 360
			}
		} else if (cmd instanceof BuildCmd) {
			if (cmd.shape)
				cmd.shape = parseInt(shape[d][cmd.shape] ?? cmd.shape)
			if (d == "H") {
				if (cmd.bits) {
					cmd.bits = new BuildBits(cmd.bits.toString().split("").reduce((r, c) => c + r))
					cmd.x += cmd.bits.size - 1
				}
				cmd.x = bp.width - cmd.x - 1
			} else if (d == "V") {
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
			((x - cX) * cos) - ((y - cY) * sin) + cX,
			((x - cX) * sin) + ((y - cY) * cos) + cY
		]
	}
}

/**
 * @param {Blueprint} bp
 * @param {{search: Array<string>, replacement: string}} options
 * @returns {number} Replaced amount
 */
export function replace(bp, options) {
	const { search, replacement } = options
	const del = replacement == ""
	let amount = 0

	const searchIds = new Set(itemInputsToIds(search))
	const doSearchAir = searchIds.has(-1)

	const replacementId = !del ? (!isNaN(replacement) ? parseInt(replacement) : itemNameToIds(replacement)[0]) : 0

	if (!del && isNaN(replacementId)) return amount

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

		if (searchIds.has(cmd.item)) {
			if (del) {
				bp.commands.splice(i, 1)
			} else {
				cmd.item = replacementId
				if (!items.isPlaceable(replacementId))
					cmd.shape = undefined
			}
			++amount
		}
	}

	stripRedundantCfgCmds(bp)

	if (doSearchAir) { // air
		expandBuildBits(bp)
		for (let x = 0; x < bp.width; x++) {
			for (let y = 0; y < bp.height; y++) {
				if (!filled.has(`${x},${y}`)) {
					bp.commands.push(new BuildCmd({ x, y, item: replacementId }))
					++amount
				}
			}
		}
		makeBuildBits(bp)
	}

	return amount
}

function itemInputsToIds(inputs) {
	const output = []
	/** @type {Set<"block"|"placeable"|"nonplaceable"|"bigmac"|"smallmac"|"hull">} */
	const categories = new Set()

	for (const s of new Set(inputs)) {
		if (s == "block") categories.add("block")
		else if (s == "placeable") categories.add("placeable")
		else if (s == "non-placeable" || s == "nonplaceable") categories.add("nonplaceable")
		else if (s == "big machine") categories.add("bigmac")
		else if (s == "1x1 machine" || s == "small machine") categories.add("smallmac")
		else if (s == "hull mounted" || s == "hull-mounted" || s == "hull") categories.add("hull")
		else // not a category
			!isNaN(s) ? output.push(parseInt(s)) : output.push(...itemNameToIds(s))
	}

	if (categories.size) {
		items.ids.forEach(id => {
			if (categories.has("block") && items.isBlock(id)
				|| categories.has("placeable") && items.isPlaceable(id)
				|| categories.has("nonplaceable") && !items.isPlaceable(id)
				|| categories.has("bigmac") && items.isBigMac(id)
				|| categories.has("smallmac") && items.isSmallMac(id)
				|| categories.has("hull") && items.isHull(id)
			)
				output.push(parseInt(id))
		})
	}
	return output
}

function itemNameToIds(name) {
	return items.ids.reduce((arr, id) => (
		name == "air" ? arr.push(-1)
			: items.getName(id).toLowerCase().includes(name) && arr.push(parseInt(id))
		, arr
	), [])
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

	/** @type {Object<string, Array<BuildCmdGroup>>} */
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
			const useLastCommands = group.item == 240 // box
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
					.splice(items.isBlock(mainCmd.item) ? lastBlockIndex++ : cfgCmdIndex + 1, 0, mainCmd)
			}
		}
	}
	bp.commands.push(...lastCommands)

	function findGroup(cmd) {
		for (const group of rows[cmd.y]) {
			if ((Math.abs(group.commands[0].x % 1 - cmd.x % 1) / group.commands[0].x || 0) == 0
				&& group.item == cmd.item
				&& group.shape == cmd.shape
				&& ((group.cfgCmd && currentCfg) ? group.cfgCmd.equals(currentCfg) : true))
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
