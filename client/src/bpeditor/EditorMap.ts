import { Body, System as CollSystem } from "detect-collisions"
import { Blueprint, BuildCmd, ConfigCmd, decode, encode, FixedAngle, Item, Shape } from "dsabp-js"
import { BpRenderer, connectedTileTypes, getShipBackgroundData } from "dsabp-js-img"
import { Viewport } from "pixi-viewport"
import { Application, EventEmitter, PointData } from "pixi.js"

import { winMan } from "./ui/uiMain.js"
import { toggleThrobber } from "/assets/throbber.js"

import { processBuildCommands } from "../bptools/operations.js"
import { MapObject, MapObjectData } from "./MapObject.js"
import { createObject } from "./actions/createObject.js"
import { updateObject, UpdateObjectOptions } from "./actions/updateObject.js"
import { checkPlacement } from "./checkPlacement.js"
import { isKeyDown, updateCursor } from "./util.js"

import { initBackground } from "./managers/background.js"
import { initCollab } from "./managers/collab.js"
import { initConfigs } from "./managers/configs.js"
import { initDebug } from "./managers/debug.js"
import { initEvents } from "./managers/events.js"
import { initHighlight } from "./managers/highlight.js"
import { initHistory } from "./managers/history.js"
import { initMods } from "./managers/mods.js"
import { initPlacement } from "./managers/placement.js"
import { initPointer, InteractionType } from "./managers/pointer.js"
import { initPusherBeams } from "./managers/pusherBeams.js"
import { initSelection } from "./managers/selection.js"
import { initShapePlacement } from "./managers/shapePlacement.js"
import { getRecentBps, saveRecentBp } from "./managers/webStorage.js"
import { pointerEvent } from "/main.js"

const allowBuildOnTiles = new Set([Item.BLOCK, Item.BLOCK_ICE_GLASS, Item.BLOCK_HYPER_RUBBER, Item.BLOCK_WALKWAY])
const supportedReqBlocks: Set<Item["buildInfo"][0]["require_blocks"][0]["block"]> = new Set(["_BUILD_SURFACE", "HULL_H", "HULL_V", "HULL_CORNER"])

export type Tool = "select" | "place" | "eraser" | "crop" | "bpexport" | "special"

type Manager<T extends (a: any) => any> = Awaited<ReturnType<T>>

export type NoUpdateOptions = { server?: boolean, all?: boolean, bpStr?: boolean, connTxt?: boolean, pushers?: boolean }

export interface EditorMapEvents {
	"coll-pointerover": [e: { target: Body, relatedTarget: Body }]
	"coll-pointerout": [e: { target: Body, relatedTarget: Body }]
	pointeraction: (detail: { e: pointerEvent, type: InteractionType, isInterval: boolean, isDouble: boolean, target: HTMLElement, lastMoveTouch: Touch }) => void
	toolchange: []
	itemchange: []
	selectionchange: []
	mapchange: []
	bpchange: []
	"collab-status": [status: "connecting" | "disconnected" | "reconnected" | "rejoinedRoom" | "rejoinRoomFailed" | "joinedRoom", message?: string]
	bploading: []

	bploaded: [bpIn?: string | Blueprint]
	mapresize: [width: number, height: number]
	objectcreate: [objectData: MapObjectData, noUpdate: NoUpdateOptions]
	objectsdelete: [object: MapObject[], noUpdate: NoUpdateOptions]
	objectmove: [object: MapObject, bpPoint: PointData, wPoint: PointData, noUpdate: NoUpdateOptions]
	objectupdate: [object: MapObject, options: UpdateObjectOptions]
	objectsmoveconfig: [objects: MapObject[], fromPoses: PointData[]]
	// historyadd: <K extends keyof EditorMap["history"]["preset"]>(presetKey: K, presetArgs: ReturnType<ReturnType<EditorMap["history"]["preset"][K]["add"]>["serialize"]>) => void
}

export class EditorMap extends EventEmitter<EditorMapEvents> {
	initialized = false
	app: Application
	viewport: Viewport
	collisions = new CollSystem()
	bp = new Blueprint({ width: -1, height: -1 })
	bpRenderer = new BpRenderer(null)
	objects = new Set<MapObject>()
	/** 2D array, coords to set of objects at the coords. */
	posToObject: Set<MapObject>[][] = []
	/** 2D array, coords to set of objects that depend on the coords. */
	dependents: Set<MapObject>[][] = []

	squareSize = this.bpRenderer.squareSize

	info = {
		bpState: null as "loaded" | "loading",
		selectedTool: "select" as Tool,
		selectedItem: null as Item,
		dragging: null as boolean,
		/** Null if not down, otherwise button number, 0 if touch */
		downPointer: null as number,
		placementCheckResult: { can: false } as ReturnType<typeof checkPlacement>,
		placementPos: { x: 0, y: 0 },
		moving: [] as {
			object: MapObject,
			/** bp point */
			from: PointData,
			offset: PointData,
			/** bp point */
			lastValidPos?: PointData,
			lastMeetsReq?: boolean,
			initialValidity: boolean
		}[]
	}

	events: Manager<typeof initEvents>
	highlight: Manager<typeof initHighlight>
	placement: Manager<typeof initPlacement>
	configs: Manager<typeof initConfigs>
	history: Manager<typeof initHistory>
	selection: Manager<typeof initSelection>
	background: Manager<typeof initBackground>
	pusherBeams: Manager<typeof initPusherBeams>
	shapePlacement: Manager<typeof initShapePlacement>
	collab: Manager<typeof initCollab>
	mods: Manager<typeof initMods>

	async init(app: Application, bpStr?: string) {
		this.app = app

		this.viewport = new Viewport({
			screenWidth: app.renderer.width,
			screenHeight: app.renderer.height,
			events: app.renderer.events,
			passiveWheel: false
		})

		this.collab = initCollab(this)

		this.background = await initBackground(this)
		this.history = initHistory(this, {
			undo: [document.getElementById("button-undo"), document.getElementById("button-menu-undo")],
			redo: [document.getElementById("button-redo"), document.getElementById("button-menu-redo")],
		})

		this.viewport.eventMode = "static"
		this.viewport.interactiveChildren = false
		this.viewport.drag({ keyToPress: ["Space"] })
			.decelerate({ friction: 0.85 })
			.pinch()
			.wheel({ smooth: 4 })
			.moveCorner(-this.squareSize * 1.5, -this.squareSize * 1.5)

		app.stage.addChild(this.viewport)

		this.events = initEvents(this)
		this.highlight = await initHighlight(this)
		this.placement = initPlacement(this)
		initDebug(this)
		this.selection = initSelection(this)

		this.configs = initConfigs(this)
		this.pusherBeams = await initPusherBeams(this)

		const bpLoaded = bpStr ? await this.loadBlueprint(bpStr) : false

		this.shapePlacement = initShapePlacement(this)
		initPointer(this)
		import("./toolExport.js")

		window.addEventListener("keydown", e => {
			if (e.code == "Space") {
				this.info.dragging = true
				this.events.pointer.stop()
				this.placement.dispObj.visible = false
			}
			updateCursor(this)
		})
		window.addEventListener("keyup", e => {
			if (e.code == "Space") {
				this.info.dragging = false
				this.events.pointer.start()
				this.placement.check(this.events.pointer.body)
			}
			updateCursor(this)
		}) // NOTE: blur

		const canvasContainer = document.getElementById("canvas-container")
		canvasContainer.addEventListener("pointerleave", () => {
			this.events.pointer.stop()
			this.placement.dispObj.visible = false
		})
		canvasContainer.addEventListener("pointerenter", () => {
			this.events.pointer.start()
			this.placement.dispObj.visible = false
			this.placement.check(this.events.pointer.body)
		})

		let blockDrag: boolean
		app.ticker.add(() => {
			if (document.activeElement != document.body || blockDrag)
				return
			if (isKeyDown("ctrl|meta") || isKeyDown("shift") || isKeyDown("alt"))
				return blockDrag = true, setTimeout(() => blockDrag = null, 500)
			let dragged: boolean
			if (isKeyDown("w", "up")) { dragged = true; this.viewport.y += 10 }
			if (isKeyDown("s", "down")) { dragged = true; this.viewport.y -= 10 }
			if (isKeyDown("d", "right")) { dragged = true; this.viewport.x -= 10 }
			if (isKeyDown("a", "left")) { dragged = true; this.viewport.x += 10 }
			if (dragged) {
				this.events.pointer.update()
			}
		})
		this.initialized = true
		return { bpLoaded }
	}

	reset() {
		this.objects.forEach(obj => obj.destroy())
		this.bpRenderer.customObjectByCoordsFn = null
		this.bpRenderer.knownObjects.length = 0
		this.posToObject.length = 0
		this.dependents = []
		this.history.clear()
		this.selection.selectBoxPrimary.endSelection(true)
	}

	get hasLoadedBp() {
		return this.bp.width != -1
	}

	async loadBackground(data: Awaited<ReturnType<typeof getShipBackgroundData>>, width: number, height: number) {
		if (this.objects.size)
			for (const obj of this.objects)
				if (obj.bgTileType)
					obj.destroy()

		for (let x = 0; x < data.tiles.length; ++x) {
			for (let y = data.tiles[x].length - 1; y >= 0; --y) {
				const tileData = data.tiles[x][y]
				await createObject({ editorMap: this, x, y, bgTileType: tileData.type }, false, { all: true, server: true }, tileData.image)
				if (y && y % 320 == 0) await new Promise(r => setTimeout(r))
			}
			if (x && x % 320 == 0) await new Promise(r => setTimeout(r))
		}

		this.bpRenderer.setSize(width, height)
		this.viewport.worldWidth = this.squareSize * width
		this.viewport.worldHeight = this.squareSize * height
	}

	async loadBpCommands(bp: Blueprint, offset?: PointData): Promise<undefined>
	async loadBpCommands(bp: Blueprint, offset: PointData, returnObjects: boolean, noUpdate?: NoUpdateOptions): Promise<MapObject[]>
	async loadBpCommands(bp: Blueprint, offset?: PointData, returnObjects?: boolean, noUpdate?: NoUpdateOptions): Promise<MapObject[]> | undefined {
		const roundFactor = 1 / this.squareSize * 2
		let currCfg: ConfigCmd = null
		const objects = returnObjects ? [] : null
		for (const cmd of bp.commands) {
			if (cmd instanceof ConfigCmd) {
				currCfg = cmd
				continue
			} else if (cmd instanceof BuildCmd) {
				if (!cmd.item) {
					console.info(`Ignoring unknown item at ${cmd.x}, ${cmd.y} - Shape: ${cmd.shape?.enumName}, Bits: ${cmd.bits?.toString()}`)
					continue
				}
				cmd.x = -Math.round(-cmd.x / roundFactor) * roundFactor
				cmd.y = -Math.round(-cmd.y / roundFactor) * roundFactor
				if (offset) {
					cmd.x += offset.x
					cmd.y += offset.y
				}

				const create = async (x: number, y: number, config: ConfigCmd) => {
					const o = await createObject({ editorMap: this, x, y, item: cmd.item, shape: cmd.shape, config: config?.clone() }, false, noUpdate)
					objects?.push(o)
				}

				if (cmd.bits) {
					let bitI = 0
					for (const bit of cmd.bits) {
						if (bit)
							await create(cmd.x + bitI, cmd.y, currCfg)
						bitI++
					}
				} else {
					await create(cmd.x, cmd.y, currCfg)
				}
			}
		}
		return objects
	}

	async loadBlueprint(bpIn: string | Blueprint, bpLoadCb?: (success: boolean) => void, quiet?: boolean) {
		const isStr = typeof bpIn == "string"
		this.emit("bploading")
		this.info.bpState = "loading"
		toggleThrobber("Loading map...")
		const bp = isStr ? await decode(bpIn).catch(console.error) : bpIn
		if (!bp)
			return bpLoadCb?.(false), toggleThrobber(), this.info.bpState = null, false

		if (!quiet)
			this.emit("bploaded", bpIn)

		if (bpLoadCb && isStr)
			bpLoadCb(true)

		this.reset()

		this.bp ??= bp
		this.bp.version = bp.version
		this.bp.width = bp.width
		this.bp.height = bp.height

		await this.loadBackground(await getShipBackgroundData(this.bpRenderer, bp), bp.width, bp.height)
		await this.loadBpCommands(bp, null, false, { all: true, server: true })

		// do this after loads so they aren't affected if commands was changed e.g. by updateBpStr
		this.bp.commands = bp.commands

		if (isStr)
			this.updateBpStr()

		this.info.bpState = "loaded"
		toggleThrobber()
		this.bpRenderer.customObjectByCoordsFn = (x, y) => this.getObjectByPos(x, y)?.item

		for (const obj of this.objects)
			if (obj.item == Item.PUSHER)
				this.pusherBeams.update(obj)

		this.events.pointer.check()
		this.emit("mapchange")
		return true
	}

	async resize(width: number, height: number, quiet?: boolean) {
		if (!quiet)
			this.emit("mapresize", width, height)
		this.bp.width = width
		this.bp.height = height
		await this.loadBackground(
			await getShipBackgroundData(this.bpRenderer, null, width, height),
			width, height
		)
		this.updateBpStr()
	}

	private updateBpStrTimer: number
	onlyRcdItems = true
	updateBpStr() {
		if (!this.hasLoadedBp)
			return
		clearTimeout(this.updateBpStrTimer)
		this.updateBpStrTimer = setTimeout(async () => {
			this.generateBpStr(o => o.isValid && !o.isDisabled && !(this.onlyRcdItems && !o.isRcdSupported))
				.then(str => {
					winMan.bpStr.setBlueprint(this.bp, str, true)

					this.generateBpStr().then(sessionBpStr => saveRecentBp(getRecentBps(), sessionBpStr))
				})
			this.emit("bpchange")
		}, 150)
		this.emit("mapchange")
	}

	/** Note: Modifies {@link bp} */
	async generateBpStr(filter?: (o: MapObject) => boolean) {
		this.bp.commands.length = 0
		let lastCfg: ConfigCmd
		for (const obj of this.objects) {
			if (!obj?.config?.equals(lastCfg)) {
				lastCfg = obj.config
				this.bp.commands.push(obj.config ?? new ConfigCmd())
			}
			if (!obj || obj.bgTileType || !(!filter || filter(obj)))
				continue
			this.bp.commands.push(new BuildCmd({ x: obj.x, y: obj.y, item: obj.item, shape: obj.shape == Shape.BLOCK ? undefined : obj.shape }))
		}
		return await encode(processBuildCommands(this.bp))
	}

	updateDependents(x: number, y: number, filter?: (depObj: MapObject) => boolean) {
		if (this.dependents[x]?.[y])
			for (const dep of this.dependents[x][y])
				if (!filter || filter(dep)) {
					dep.isValid = checkPlacement(this, dep.item, dep.body, dep.x, dep.y, dep.buildInfoIndex, { passCollisionCheck: true }).meetsRequirements
					if (dep.isValid)
						(dep.dependencies ??= new Set()).add(`${x},${y}`)
					else
						dep.dependencies?.delete(`${x},${y}`)
				}
	}

	async updateConnTexAround(point: PointData, self: boolean | MapObject = false, filter?: (tx: number, ty: number) => boolean) {
		const { x, y } = point

		const points = [[x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]]
		if (self && !(self instanceof MapObject)) points.push([x, y])

		for (const [tx, ty] of points)
			if (!filter || filter(tx, ty))
				await updateObject(
					this.getObjectByPos(tx, ty, obj =>
						!obj.bgTileType && obj.isValid && connectedTileTypes.has(obj.item)
					),
					{ keepBody: true, keepBpStr: false, keepServer: true }
				)
		if (self instanceof MapObject)
			await updateObject(self, { keepBody: true, keepBpStr: false, keepServer: true })
	}

	addObjectPos(obj: MapObject) {
		((this.posToObject[obj.x] ??= [])[obj.y] ??= new Set()).add(obj)
	}

	removeObjectPos(obj: MapObject) {
		this.posToObject[obj.x]?.[obj.y]?.delete(obj)
	}

	/**
	 * If multiple objects at same point, returns the older, or newer if reverse=true. Never returns disabled objects.
	 * @param filter Ignores background if omitted.
	 */
	getObjectByPos(x: number, y: number, filter?: (obj: MapObject) => boolean, reverse?: boolean) {
		const set = this.posToObject[x]?.[y]
		if (set) {
			if (reverse) {
				const arr = Array.from(set)
				for (let i = arr.length - 1; i >= 0; i--) {
					const o = arr[i]
					if (!o.isDisabled && (filter == null ? !o.bgTileType : filter(o)))
						return o
				}
			} else {
				for (const o of set) {
					if (!o.isDisabled && (filter == null ? !o.bgTileType : filter(o)))
						return o
				}
			}
		}
	}

	findRequiredBlocks(buildInfo: Item["buildInfo"][0], x: number, y: number, returnDesired = true) {
		const desired: PointData[] = []
		let found: MapObject[]
		let meets = true
		for (const req of buildInfo.require_blocks) {
			if (!supportedReqBlocks.has(req.block)) {
				meets = false
				continue
			}

			// minus to floor if .5
			const desiredPos = { x: -Math.round(-x) + req.x, y: -Math.round(-y) + req.y }
			const obj = this.getObjectByPos(desiredPos.x, desiredPos.y, o => o.isValid && o.bgTileType != "paint")
			if (returnDesired)
				desired.push(desiredPos)

			if (!obj // if requirement not found
				|| (obj.item && !allowBuildOnTiles.has(obj.item)) // or not a tile that can be built on 
				|| (obj.shape && !obj.shape.isBuildSurface) // or not a build surface
				|| (req.block == "HULL_H" && obj.bgTileType != "wallH")
				|| (req.block == "HULL_V" && obj.bgTileType != "wallV")
				// starter thruster requires corner but is allowed on any wall in the game
				|| (req.block == "HULL_CORNER" && obj.bgTileType == "paint")
			) {
				meets = false
				if (!returnDesired)
					break
			}
			(found ??= []).push(obj)
		}
		return { desired, meets, found }
	}

	toBpPoint(point: PointData) {
		return {
			x: point.x / this.squareSize,
			y: Math.max(1, this.bp.height) - 1 - point.y / this.squareSize
		}
	}

	toWorldPoint(point: PointData) {
		return {
			x: point.x * this.squareSize,
			y: (this.bp.height - 1 - point.y) * this.squareSize
		}
	}

	vwToWorld(thing: MouseEvent | Touch | { clientX: number, clientY: number }, canvasRect?: DOMRect) {
		const rect = canvasRect ?? this.app.canvas.getBoundingClientRect()
		return this.viewport.toWorld({ x: thing.clientX - rect.left, y: thing.clientY - rect.top })
	}

	getHullDirection(x: number, y: number) {
		const obj = this.getObjectByPos(x, y, o => o.bgTileType && o.bgTileType != "paint")
		if (!obj) return null
		return obj.bgTileType == "wallH" ? (y == 0 ? FixedAngle.DOWN : FixedAngle.UP)
			: obj.bgTileType == "wallV" ? (x == 0 ? FixedAngle.LEFT : FixedAngle.RIGHT)
				: y == 0 ? FixedAngle.DOWN : FixedAngle.UP // corners
	}
}
