import { Blueprint, BPCmd, BuildBits, BuildCmd, ConfigCmd, FixedAngle, Item, LoaderPoint, Shape } from "dsabp-js"

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

export function flip(bp: Blueprint, D: "H" | "V") {
	const isHorizly = D == "H"
	for (const cmd of bp.commands) {
		if (cmd instanceof ConfigCmd) {
			if (cmd.loader?.pickupPoint != null)
				cmd.loader.pickupPoint = loaderFlipMap[D].get(cmd.loader.pickupPoint) ?? cmd.loader.pickupPoint
			if (cmd.loader?.dropPoint != null)
				cmd.loader.dropPoint = loaderFlipMap[D].get(cmd.loader.dropPoint) ?? cmd.loader.dropPoint
			if (cmd.pusher?.angle != null) {
				cmd.pusher.angle = (isHorizly ? 180 : 360) - cmd.pusher?.angle
				if (cmd.pusher.angle < 0)
					cmd.pusher.angle += 360
			}
			if (cmd.angle != null) {
				cmd.angle = (isHorizly ? 180 : 360) - cmd.angle
				if (cmd.angle < 0)
					cmd.angle += 360
			}
			if (cmd.fixedAngle != null) {
				const a = cmd.fixedAngle
				if (isHorizly && (a == FixedAngle.RIGHT || a == FixedAngle.LEFT))
					cmd.fixedAngle = cmd.fixedAngle == FixedAngle.RIGHT ? FixedAngle.LEFT : FixedAngle.RIGHT
				else if (!isHorizly && (a == FixedAngle.UP || a == FixedAngle.DOWN))
					cmd.fixedAngle = cmd.fixedAngle == FixedAngle.UP ? FixedAngle.DOWN : FixedAngle.UP
			}
		} else if (cmd instanceof BuildCmd) {
			if (cmd.shape)
				cmd.shape = shapeFlipMap[D].get(cmd.shape) ?? cmd.shape
			if (isHorizly) {
				if (cmd.bits) {
					cmd.bits = new BuildBits(cmd.bits.toString().split("").reduce((r, c) => c + r))
					cmd.x += cmd.bits.size - 1
				}
				cmd.x = bp.width - cmd.x - 1
			} else {
				cmd.y = bp.height - cmd.y - 1
			}
		}
	}
}

export function crop(bp: Blueprint, options: { delete: boolean, top: number, right: number, bottom: number, left: number }) {
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

export function rotate(bp: Blueprint, angle: number) {
	const cX = bp.width / 2
	const cY = bp.height / 2
	const angleInDegrees = angle % 360
	angle *= Math.PI / 180
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)

	let minX = Infinity, minY = Infinity
	let maxX = 0, maxY = 0

	expandBuildBits(bp)

	for (const cmd of bp.commands) {
		if (cmd instanceof BuildCmd) {
			[cmd.x, cmd.y] = rotateC(cmd.x, cmd.y)
			if (cmd.shape) {
				cmd.shape = rotateShape(cmd.shape, angleInDegrees)
			}
			minX = Math.min(minX, cmd.x)
			minY = Math.min(minY, cmd.y)
			maxX = Math.max(maxX, cmd.x)
			maxY = Math.max(maxY, cmd.y)
		} else if (cmd instanceof ConfigCmd) {
			if (cmd.loader?.pickupPoint != null)
				cmd.loader.pickupPoint = rotateLoaderPoint(cmd.loader.pickupPoint, angleInDegrees)
			if (cmd.loader?.dropPoint != null)
				cmd.loader.dropPoint = rotateLoaderPoint(cmd.loader.dropPoint, angleInDegrees)
			if (cmd.pusher?.angle != null) {
				cmd.pusher.angle = (cmd.pusher.angle + angleInDegrees) % 360
				if (cmd.pusher.angle < 0) cmd.pusher.angle += 360
			}
			if (cmd.angle != null) {
				cmd.angle = (cmd.angle + angleInDegrees) % 360
				if (cmd.angle < 0) cmd.angle += 360
			}
			if (cmd.fixedAngle != null) {
				cmd.fixedAngle = rotateFixedAngle(cmd.fixedAngle, angleInDegrees)
			}
		}
	}

	for (const cmd of bp.commands) {
		if (cmd instanceof BuildCmd) {
			cmd.x = cmd.x - minX
			cmd.y = cmd.y - minY
		}
	}

	bp.width = Math.ceil((maxX - minX)) + 1
	bp.height = Math.ceil((maxY - minY)) + 1

	processBuildCommands(bp)

	function rotateC(x, y) {
		return [
			toFixed(((x - cX) * cos) - ((y - cY) * sin) + cX),
			toFixed(((x - cX) * sin) + ((y - cY) * cos) + cY)
		]
	}
}

const loaderRotationArr = [LoaderPoint.LEFT, LoaderPoint.BOTTOM_LEFT, LoaderPoint.BOTTOM, LoaderPoint.BOTTOM_RIGHT, LoaderPoint.RIGHT, LoaderPoint.TOP_RIGHT, LoaderPoint.TOP, LoaderPoint.TOP_LEFT]

function rotateLoaderPoint(point, angle) {
	if (angle % 45 != 0)
		angle = Math.round(angle / 45) * 45
	const currentIndex = loaderRotationArr.indexOf(point)
	const steps = Math.round(angle / 45)
	const pointAmount = loaderRotationArr.length
	return loaderRotationArr[(currentIndex + steps + pointAmount) % pointAmount]
}

function rotateShape(shape, angle) {
	if (angle % 90 != 0)
		angle = Math.round(angle / 90) * 90
	const relativeIndex = (shape.enumValue - 1) % 4 // imaginary index of shape between 4 Shapes that are the same type
	const groupIndex = shape.enumValue - relativeIndex // find index of the first shape in ^
	let newRelativeIndex = relativeIndex - (angle / 90) // decrease the relative index (results in clockwise rotation)
	if (newRelativeIndex < 0)
		newRelativeIndex += 4
	return Shape.getByValue(groupIndex + newRelativeIndex)
}

function rotateFixedAngle(fixedAngle, angle) {
	if (angle % 90 != 0)
		angle = Math.round(angle / 90) * 90
	return FixedAngle.getByValue((fixedAngle.enumValue + angle / 90) % 4)
}

function toFixed(n, digits = 10) {
	const f = 10 ** digits
	return Math.round(n * f) / f
}

/** @returns replaced amount */
export function replace(bp: Blueprint, options: { search: string[], replacement: string }): number {
	const { search, replacement } = options
	const del = replacement == ""
	let amount = 0

	const searchItems = new Set(resolveItemInputs(search))
	const doSearchAir = searchItems.has(Item.NULL)

	const replacementItem = del ? Item.NULL
		: !isNaN(replacement as any) ? Item.getById(parseInt(replacement)) : resolveItemName(replacement)[0]

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
	expandBuildBits(bp)

	if (doSearchAir) {
		for (let x = 0; x < bp.width; x++) {
			for (let y = 0; y < bp.height; y++) {
				if (!filled.has(`${x},${y}`)) {
					bp.commands.push(new BuildCmd({ x, y, item: replacementItem }))
					++amount
				}
			}
		}
	}

	processBuildCommands(bp)

	return amount
}

interface ResolveItemInputsOptions {
	allowMultipleOfType?: boolean
	oneItemPerName?: boolean
	followInputCategoriesOrder?: boolean
	onlyBuildables?: boolean
}
export function resolveItemInputs(inputs: string[], { allowMultipleOfType, oneItemPerName, followInputCategoriesOrder, onlyBuildables }: ResolveItemInputsOptions = {}) {
	const output = []
	const categories = new Set<"block" | "buildable" | "nonbuildable" | "mac" | "bigmac" | "smallmac" | "hull">()

	for (const s of (allowMultipleOfType ? inputs : new Set(inputs))) {
		if (s == "") continue

		let category
		if (s == "block") category = "block"
		else if (s == "buildable") category = "buildable"
		else if (s == "non-buildable" || s == "nonbuildable") category = "nonbuildable"
		else if (s == "machine") category = "mac"
		else if (s == "big machine") category = "bigmac"
		else if (s == "1x1 machine" || s == "small machine") category = "smallmac"
		else if (s == "hull mounted" || s == "hull-mounted" || s == "hull") category = "hull"
		else // not a category
			!isNaN(s as any) ? output.push(Item.getById(parseInt(s))) : output.push(...resolveItemName(s, onlyBuildables, oneItemPerName))

		if (category) {
			if (followInputCategoriesOrder)
				output.push(...resolveItemInputs([s]))
			else
				categories.add(category)
		}
	}

	const isBigMac = (i: Item) => i.buildInfo?.[0].bounds.x > 1 || i.buildInfo?.[0].bounds.y > 1

	if (categories.size) {
		for (const item of Item.getMap().values()) {
			if (onlyBuildables && !item.isBuildable)
				continue
			if (categories.has("block") && item.isBlock
				|| categories.has("buildable") && item.isBuildable
				|| categories.has("nonbuildable") && !item.isBuildable
				|| categories.has("mac") && item.isBuildable && !item.isBlock
				|| categories.has("bigmac") && item.isBuildable && !item.isBlock && isBigMac(item)
				|| categories.has("smallmac") && item.isBuildable && !item.isBlock && !isBigMac(item)
				|| categories.has("hull") && item.buildInfo?.[0].require_blocks?.[0].block.includes("HULL")
			)
				output.push(item)
		}
	}
	return output
}

/** Item name to items */
function resolveItemName(name: string, onlyBuildables?: boolean, oneItemPerName?: boolean) {
	if (name == "air")
		return [Item.NULL]

	const output = []
	for (const item of Item.getMap().values()) {
		if (onlyBuildables && !item.isBuildable)
			continue
		if (item.name.toLowerCase().includes(name)) {
			output.push(item)
			if (oneItemPerName)
				return output
		}
	}
	return output
}

export function cleanItemInput(text: string) {
	return text.toLowerCase().trim().replace(/ +/, " ").split(/\s*,\s*/)
}

/** for build bits */
class BuildCmdGroup {
	cfgCmd: ConfigCmd
	commands: BuildCmd[]
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

class ConfigGroup {
	cfgCmd: ConfigCmd
	commands: BuildCmd[]
	y: number
	constructor(cfgCmd: ConfigCmd | null, y: number) {
		this.cfgCmd = cfgCmd
		this.commands = []
		this.y = y
	}
}

/**
 * Compresses all build commands to the smallest amount of BuildBits possible.
 * Meant to be used on a BP that has no BuildBits.
 * Made quickly. It could probably be much more efficient and clean.
 * 
 * @returns new bp if inPlace=false
 */
export function processBuildCommands(inputBp: Blueprint,
	{
		inPlace = true,
		sortOthers,
		sortFirst = new Set(),
		sortLast = new Set([Item.EXPANDO_BOX, Item.ITEM_HATCH_STARTER, Item.ITEM_HATCH]),

		directionTopToBottom = true,
		reverseDirectionItems = [Item.EXPANDO_BOX],
		prioritizeYSortItems = [Item.EXPANDO_BOX]
	}: {
		inPlace?: boolean,
		sortFirst?: Set<Item>,
		sortLast?: Set<Item>,
		sortOthers?: boolean,

		directionTopToBottom?: boolean,
		reverseDirectionItems?: Item[],
		prioritizeYSortItems?: Item[]
	} = {}
) {
	const directionFactor = directionTopToBottom ? 1 : -1,
		outCommands: BPCmd[] = [],
		rows: Record<string, BuildCmdGroup[]> = {},
		sortedCommands: ConfigGroup[][] = [],
		nonSortedCommands: ConfigGroup[] = [],
		nonSortedBlockCommands: ConfigGroup[] = [],

		tableRevDirItems: Record<string, true> = reverseDirectionItems.reduce((o, item) => (o[item.id] = true, o), Object.create(null)),
		tablePriYSortItems: Record<string, true> = prioritizeYSortItems.reduce((o, item) => (o[item.id] = true, o), Object.create(null))

	let currentCfg: ConfigCmd,
		sortTypes: Item[],
		currentGroup: ConfigGroup

	for (const cmd of inputBp.commands) {
		if (cmd instanceof ConfigCmd) {
			currentCfg = cmd
		} else if (cmd instanceof BuildCmd) {
			const row = rows[cmd.y] ??= [],
				existingGroup = findGroup(rows, currentCfg, cmd)
			if (existingGroup)
				existingGroup.commands.push(cmd)
			else
				row.push(new BuildCmdGroup(cmd, currentCfg?.clone()))
		}
	}

	if (sortFirst?.size || sortOthers) {
		sortLast.forEach(item => sortFirst.delete(item))

		sortTypes = Array.from(sortFirst)
		if (sortOthers) {
			sortTypes.push(
				...Array.from(Item.getMap().values())
					.filter(item => !sortFirst.has(item) && !sortLast.has(item)),
				...Array.from(sortLast)
			)
		} else {
			sortTypes.length += Item.getMap().size - sortFirst.size - sortLast.size
			sortTypes.push(...sortLast)
		}
	} else {
		sortTypes = [...sortLast]
	}
	if (sortTypes.length)
		sortTypes = sortTypes.filter(item => item.isBuildable)

	for (const y of Object.keys(rows).map(Number)) {
		for (const group of rows[y]) {
			const { item, commands } = group,
				cfgCmd = item.isBlock ? null : group.cfgCmd,

				sortArrayIndex = sortTypes.indexOf(item),
				sortArray = sortArrayIndex != -1
					? sortedCommands[sortArrayIndex] ??= []
					: (item.isBlock ? nonSortedBlockCommands : nonSortedCommands)

			currentGroup = findExistingCfgCmdGroup(cfgCmd, sortArray, tablePriYSortItems, y)
			if (!currentGroup) {
				const groupIndex = (tablePriYSortItems[item.id]) ? sortArray.findIndex(g => directionFactor * (tableRevDirItems[item.id] ? g.y - y : y - g.y) > 0) : -1
				sortArray.splice(
					groupIndex == -1 ? sortArray.length : groupIndex,
					0,
					currentGroup = new ConfigGroup(cfgCmd, y)
				)
			}

			let chunks: BuildCmd[][]
			if (commands.length > 1) {
				chunks = [[]]
				for (const cmd of commands.sort((a, b) => a.x - b.x)) {
					if (cmd.x - chunks[chunks.length - 1][0]?.x >= 63)
						chunks.push([])
					chunks[chunks.length - 1].push(cmd)
				}
			} else {
				chunks = [[commands[0]]]
			}

			for (const chunk of chunks) {
				const mainCmd = chunk.shift()
				if (chunk.length) {
					mainCmd.bits = new BuildBits("1")
					for (const cmd of chunk)
						mainCmd.bits.set(Math.floor(cmd.x - mainCmd.x))
				}

				currentGroup.commands.push(mainCmd)
			}
		}
	}

	sortedCommands.splice(sortFirst?.size ?? 0, 0, nonSortedBlockCommands, nonSortedCommands)

	if (sortedCommands.length) {
		let lastConfig: ConfigCmd = null
		outCommands.push(...sortedCommands.flatMap(groups =>
			groups.flatMap(group => {
				const cmds: BPCmd[] = group.commands.sort((a, b) =>
					directionFactor * (
						(tableRevDirItems[a.item.id] ? a.y - b.y : b.y - a.y)
					) || a.x - b.x // by X if Y are same
				)

				if (group.cfgCmd && (!lastConfig || !group.cfgCmd.equals(lastConfig))) {
					cmds.unshift(group.cfgCmd)
					lastConfig = group.cfgCmd
				}

				return cmds
			})
		))
	}

	if (inPlace)
		inputBp.commands.splice(0, inputBp.commands.length, ...outCommands)

	return inPlace ? inputBp : new Blueprint({ version: inputBp.version, width: inputBp.width, height: inputBp.height, commands: outCommands })
}

function findGroup(rows: Record<string, BuildCmdGroup[]>, currentCfg: ConfigCmd, cmd: BuildCmd) {
	for (const group of rows[cmd.y]) {
		if ((Math.abs(group.commands[0].x % 1 - cmd.x % 1) / group.commands[0].x || 0) == 0
			&& group.item == cmd.item
			&& group.shape == cmd.shape
			&& (!group.cfgCmd || !currentCfg || group.cfgCmd.equals(currentCfg))
		)
			return group
	}
}

function findExistingCfgCmdGroup(targetCmd: ConfigCmd | null, targetArray: ConfigGroup[], tablePriYSortItems: Record<string, true>, y: number): ConfigGroup {
	for (let i = targetArray.length - 1; i >= 0; i--) {
		const group = targetArray[i]
		if (targetCmd == null
			? group.cfgCmd == null
			: (group.cfgCmd?.equals(targetCmd) && (
				!(tablePriYSortItems[group.commands[0].item.id]) // whether to prioritize sorting by Y
				|| group.y == y
			))
		)
			return group
	}
}

function expandBuildBits(bp: Blueprint) {
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

function stripRedundantCfgCmds(bp: Blueprint) {
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
