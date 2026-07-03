import { ClientChannel, geckos } from "@geckos.io/client"
import type { Bridge } from "@geckos.io/common/lib/bridge.js"
import { EmitOptions } from "@geckos.io/common/lib/types.js"
import { Blueprint, encodeSync, Item } from "dsabp-js"
import { PointData } from "pixi.js"
import { connectObject } from "../actions/connectObject.js"
import { createObject } from "../actions/createObject.js"
import { deleteObject } from "../actions/deleteObject.js"
import { disconnectObject } from "../actions/disconnectObject.js"
import { moveObject } from "../actions/moveObject.js"
import { updateObject, UpdateObjectOptions } from "../actions/updateObject.js"
import { EditorMap, NoUpdateOptions } from "../EditorMap.js"
import { MapObject, MapObjectData } from "../MapObject.js"
import { winMan } from "../ui/uiMain.js"
import { chunkArr, deserializeMapObjectData, SerializedMapObjectData, serializeMapObjectData, setQueryParam } from "../util.js"
import { toast } from "/Toast.js"

interface SEvent {
	disconnected: void
	ping: void

	roomId: string | false
	createRoom: string
	joinRoom: string
	roomOwner: boolean
	userJoinLeave: [join: boolean, channelId: string, userAmount: number]

	requestBp: void
	bp: [type: "request" | "share", bpStr: string]
	resizeMap: [width: number, height: number]

	createObject: [objectData: SerializedMapObjectData, noUpdate: NoUpdateOptions]
	deleteObjects: [objectInfos: { x: number, y: number, item: number }[], noUpdate: NoUpdateOptions]
	moveObject: [objectInfo: { x: number, y: number, item: number }, bpPoint: PointData, wPoint: PointData, noUpdate: NoUpdateOptions]
	updateObject: [objectData: SerializedMapObjectData, updateOptions: UpdateObjectOptions]
	moveConfigObjects: Array<[objectData: SerializedMapObjectData, fromPos: PointData]>
	// addToHistory: [presetKey: keyof EditorMap["history"]["preset"], presetArgs: ReturnType<ReturnType<EditorMap["history"]["preset"][K]["add"]>["serialize"]>]
}

export function initCollab(editorMap: EditorMap) {
	const S = {} as {
		isRoomOwner: boolean,
		channel: ClientChannel,
		roomId: string,
		awaitBpStart: number,
		heartbeatInterval: number,
		missedBeats: number
	}

	async function connect() {
		if (["connected", "connecting", "new"].includes(S.channel?.["connectionsManager"]?.localPeerConnection?.connectionState))
			return S.channel
		editorMap.emit("collab-status", "connecting")
		S.channel = await new Promise((resolve, reject) => {
			S.channel = geckos({ port: location.port ? parseInt(location.port) : (location.protocol == "http:" ? 80 : 443) })
			addGeckosMethods(S.channel.constructor.prototype)
			S.channel.onConnect(err => {
				if (err) {
					if (S.roomId)
						setTimeout(connect, 1000)
					return reject(err)
				}
				console.info("[Collab] Connected")
				S.missedBeats = 0
				clearInterval(S.heartbeatInterval)
				S.heartbeatInterval = setInterval(() =>
					Promise.race([
						getPing(),
						new Promise((_, reject) => setTimeout(() => reject(), document.hasFocus() ? 5000 : 20000))
					]).then(() =>
						S.missedBeats = 0
					).catch(() => {
						if (++S.missedBeats == 2)
							S.channel.close()
					}), 20000)
				resolve(S.channel)
				if (S.roomId) { // had room before connect
					editorMap.emit("collab-status", "reconnected");
					(S.isRoomOwner ? createRoom(S.roomId) : joinRoom(S.roomId, 60))
						.then(() => editorMap.emit("collab-status", "rejoinedRoom"))
						.catch(err => editorMap.emit("collab-status", "rejoinRoomFailed", err))
				}
			})
		})
		// events are removed after disconnection
		addEvents()
		return S.channel
	}

	async function createRoom(forceId?: string) {
		await connect()
		let roomIdHandler: (args: SEvent["roomId"]) => void
		return S.roomId && !forceId ? S.roomId : Promise.race([
			new Promise<string>((resolve, reject) => {
				S.channel.listenOnce("roomId", roomIdHandler = id => {
					if (id == false)
						return console.info("[Collab] Room already exists"), reject("Room already exists, join it instead.")
					resolve(S.roomId = id)
					editorMap.emit("collab-status", "joinedRoom")
					S.isRoomOwner = true
					console.info(`[Collab] Created room ${S.roomId}`)
					setQueryParam("collab", id)
				})
				S.channel.send("createRoom", forceId)
			}),
			new Promise<string>((_, reject) => setTimeout(() => {
				S.channel?.removeListener("roomId", roomIdHandler)
				reject("Creating room timed out.")
			}, 6000))
		])
	}

	async function joinRoom(toId: string, forceRetry?: number, create?: boolean) {
		if (S.roomId == toId && !forceRetry)
			return S.roomId
		if (forceRetry)
			await new Promise(r => setTimeout(r, 500))
		await connect()
		return Promise.race([
			new Promise<string>((resolve, reject) => {
				S.channel.listenOnce("roomId", id => {
					if (id) {
						console.info(`[Collab] Joined room ${id}`)
						setQueryParam("collab", id)

						S.channel.listenOnce("roomOwner", (is: boolean) => {
							if (!is) {
								// request bp from server
								S.channel.send("requestBp", null, { reliable: true, runs: 3, interval: 250 })
								S.awaitBpStart = performance.now()
								console.info("[Collab] Requested blueprint")

								setTimeout(() => (
									S.awaitBpStart && toast({ body: "Couldn't receive blueprint from the owner. Try rejoining the room.", duration: 12000, color: "#F00" })
								), 8000)
							}
							resolve(S.roomId = id)
							editorMap.emit("collab-status", "joinedRoom")
						})
					} else {
						if (create) {
							resolve(createRoom(toId))
						} else {
							console.info(`[Collab] Failed to join room ${toId}${forceRetry ? ", will retry" : ""}`)
							if (forceRetry)
								resolve(joinRoom(toId, --forceRetry))
							else
								reject("Room doesn't exist.")
						}
					}
				})
				S.channel.send("joinRoom", toId)
			}),
			new Promise<string>((_, reject) => setTimeout(() => {
				reject("Joining the room timed out.")
			}, 6000))
		])
	}

	function leaveRoom() {
		if (!S.roomId)
			return false
		S.roomId = null // null before to prevent reconnect
		try { S.channel.close() } catch {/**/ }
		return true
	}

	function addEvents() {
		// disconnected
		S.channel.listenOnce("disconnected", () => {
			S.channel = null
			clearInterval(S.heartbeatInterval)
			editorMap.emit("collab-status", "disconnected")
			console.info(`[Collab] Disconnected${S.roomId ? `, reconnect & join room ${S.roomId} in 2 seconds` : ", not in a room"}`)
			if (S.roomId) // still in a room, reconnect
				setTimeout(connect, 2000)
			setQueryParam("collab", null)
		})

		// owner status
		S.channel.listen("roomOwner", (is: boolean) => {
			if (is && S.isRoomOwner != null) // not first time
				toast({ body: "You are now the room owner.", color: "var(--blue)", duration: 5000 })
			S.isRoomOwner = is
			console.info(`[Collab] ${is ? "Is" : "Not"} room owner`)
		})

		// join / leave
		S.channel.listen("userJoinLeave", ([isJoin, channelId, userCount]: [boolean, string, number]) => {
			if (channelId != S.channel.id)
				toast({
					body: /*html*/`<b style="line-height: 0; font-size: x-large;">${isJoin ? "+" : "−"}</b> Someone ${isJoin ? "joined" : "left"} the room. Users: ${userCount}`,
					color: "var(--blue)", duration: 6000
				})
		})

		// received a bp
		S.channel.listen("bp", ([, bpStr]) => {
			if (!S.isRoomOwner) {
				console.info(`[Collab] Received ${bpStr.length} bytes of BP${S.awaitBpStart ? ` in ${performance.now() - S.awaitBpStart}ms` : ""} from the room owner`)
				toast({
					body: bpStr == "m8BQXz9h4kQA" // w -1 h -1 bp
						? "The room owner doesn't have a map loaded" : "Received a blueprint from the room owner",
					color: "var(--blue)",
					duration: 6000
				})
				editorMap.loadBlueprint(bpStr, null, true).then(() =>
					winMan.bpStr.setBlueprint(editorMap.bp, bpStr, true)
				)
			}
			delete S.awaitBpStart
		})

		// server requests bp
		S.channel.listen("requestBp", () => {
			editorMap.generateBpStr()
				.then(str =>
					S.channel.send("bp", ["request", str], { reliable: true, runs: 5, interval: 250 })
				)
		})

		// received map resize
		S.channel.listen("resizeMap", ([width, height]) =>
			editorMap.resize(width, height, true)
		)

		// received create map object
		S.channel.listen("createObject", ([objectData, noUpdate]) => {
			const mapObjectData = deserializeMapObjectData(objectData)
			mapObjectData.editorMap = editorMap;
			(noUpdate ??= {}).server = true
			createObject(mapObjectData, false, noUpdate)
		})

		// received delete map object
		S.channel.listen("deleteObjects", ([objectInfos, noUpdate]) => {
			(noUpdate ??= {}).server = true
			for (const { item, x, y } of objectInfos) {
				const obj = editorMap.getObjectByPos(x, y, o => o.item == Item.getById(item))
				deleteObject(obj, false, noUpdate)
			}
		})

		// received move map object
		S.channel.listen("moveObject", ([{ x, y, item }, bpPoint, wPoint, noUpdate]) => {
			const obj = editorMap.getObjectByPos(x, y, o => o.item == Item.getById(item));
			(noUpdate ??= {}).server = true
			moveObject(obj, bpPoint, wPoint, noUpdate)
		})

		// received update map object
		S.channel.listen("updateObject", ([objectData, options]) => {
			const item = Item.getById(objectData[2]),
				obj = editorMap.getObjectByPos(objectData[0], objectData[1], o => o.item == item, true),
				mapObjectData = deserializeMapObjectData(objectData)
			mapObjectData.editorMap = editorMap;
			(options ??= {}).keepServer = true
			options.objectData = mapObjectData
			updateObject(obj, options)
		})

		// received move config objects
		S.channel.listen("moveConfigObjects", data => moveConfigObjects(data))
	}

	async function getPing() {
		// const sendTime = performance.now()
		// S.channel?.emit("ping")
		const stats = await (S.channel["peerConnection"].localPeerConnection as RTCPeerConnection)?.getStats()
		if (!stats)
			return null
		for (const report of stats.values())
			if (report.type == "candidate-pair" && report.state == "succeeded")
				return report.currentRoundTripTime * 1000
		throw null

		/* return await new Promise(resolve =>
			S.channel.listenOnce("ping", () =>
				resolve(Math.round(performance.now() - sendTime))
			)
		) */
	}

	// - EDITOR EVENTS -

	editorMap.on("bploaded", bpIn => {
		if (S.isRoomOwner)
			S.channel?.send("bp", ["share", (bpIn instanceof Blueprint ? encodeSync(bpIn) : bpIn)], { reliable: true, runs: 10, interval: 100 })
	})

	editorMap.on("mapresize", (width, height) =>
		S.channel?.send("resizeMap", [width, height])
	)

	editorMap.on("objectcreate", (objectData, noUpdate) =>
		S.channel?.send("createObject", [serializeMapObjectData(objectData), noUpdate])
	)

	editorMap.on("objectsdelete", (objects, noUpdate) => {
		for (const chunk of chunkArr(objects, 256))
			S.channel?.send("deleteObjects", [chunk.map(obj => ({ item: obj.item.id, x: obj.x, y: obj.y })), noUpdate])
	})

	editorMap.on("objectmove", ({ item, x, y }, bpPoint, wPoint, noUpdate) =>
		S.channel?.send("moveObject", [
			{ item: item.id, x, y },
			bpPoint ? { x: bpPoint.x, y: bpPoint.y } : null,
			wPoint ? { x: wPoint.x, y: wPoint.y } : null,
			noUpdate
		])
	)

	editorMap.on("objectupdate", (objectData, options) =>
		S.channel?.send("updateObject", [serializeMapObjectData(objectData), options])
	)

	editorMap.on("objectsmoveconfig", (objects, fromPoses) => {
		const serialized = fromPoses.map((fromPos, i) => [serializeMapObjectData(objects[i]), fromPos] as [SerializedMapObjectData, PointData])
		for (const chunk of chunkArr(serialized, 128))
			S.channel?.send("moveConfigObjects", chunk, { reliable: true, runs: 5, interval: 20 })
	})

	return { state: S, connect, createRoom, joinRoom, leaveRoom, getPing }

	async function moveConfigObjects(data: Array<[objectData: SerializedMapObjectData, fromPos: PointData]>) {
		const amount = data.length,
			objects: MapObject[] = [],
			objectDatas: MapObjectData[] = []

		for (let i = 0; i < amount; i++) {
			const info = data[i]

			objectDatas[i] = deserializeMapObjectData(info[0])
			objectDatas[i].editorMap = editorMap

			const fromPos = info[1],
				item = objectDatas[i].item

			let obj: MapObject, origObj: MapObject
			const posObjects = editorMap.posToObject[fromPos.x]?.[fromPos.y]
			if (posObjects) for (const o of posObjects) {
				if (!o.isDisabled && !o.bgTileType && o.item == item) {
					if (!origObj) origObj = o
					else obj = o
				}
			}
			if (origObj && !obj) {
				obj = origObj
				origObj = null
			}

			objects.push(obj)
			obj.isDisabled = true
			disconnectObject(obj)
		}

		// objects.sort(a => a.item.isBlock ? -1 : 1) NOTE: Might be necessary

		for (let i = 0; i < amount; i++) {
			const obj = objects[i]
			obj.isDisabled = false
			delete objectDatas[i].hullDirection
			moveObject(obj, { x: objectDatas[i].x, y: objectDatas[i].y }, null, { server: true })
			await updateObject(obj, { keepBpStr: true, keepServer: true, objectData: objectDatas[i] })
		}

		for (const o of objects)
			connectObject(o, objects, true)
		editorMap.events.pointer.check(true)
		editorMap.updateBpStr()
	}
}









// - FIX GECKOS.IO -

declare module "@geckos.io/client" {
	interface ClientChannel {
		listen: <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) => void
		listenOnce: <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) => void
		removeListener: (...args: Parameters<ClientChannel["bridge"]["eventEmitter"]["removeListener"]>) => void
		send: <E extends keyof SEvent>(eventName: E, data: SEvent[E], options?: EmitOptions) => void
	}
}

const usedReliableMsgIds: Record<string, number> = Object.create(null)
function addGeckosMethods(proto: ClientChannel) {
	if (Object.hasOwn(proto, "once"))
		return

	delete proto.on

	proto.listen = function <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void, isOnce?: boolean) {
		(this["bridge"] as Bridge).eventEmitter[isOnce ? "once" : "on"](eventName, function (data: SEvent[keyof SEvent] | { MESSAGE: SEvent[keyof SEvent], RELIABLE: 1, ID: string }) {
			try {
				if (data && typeof data == "object" && "MESSAGE" in data && data.RELIABLE === 1) {
					if (usedReliableMsgIds[data.ID])
						return // reliable message is already received
					usedReliableMsgIds[data.ID] = Date.now()
					data = data.MESSAGE
				}
				callback(data as SEvent[E])
			} catch (err) {
				console.error("channel.listen error", err)
			}
		} as any)
	}


	proto.listenOnce = function <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) {
		// @ts-expect-error: .
		this.listen(eventName, callback, true)
	}

	proto.removeListener = function <E extends keyof SEvent>(n: E, cb: (data: SEvent[E]) => void) {
		(this["bridge"] as Bridge).eventEmitter.removeListener(n, cb as any)
	}

	proto.send = function <E extends keyof SEvent>(eventName: E, data: SEvent[E], options: EmitOptions) {
		this.emit(eventName, data as object, options)
	}

	// cleanReliableMessageIds 15 min
	setInterval(() => {
		const now = Date.now()
		for (const [msgId, timestamp] of Object.entries(usedReliableMsgIds)) {
			if (now - timestamp > 15 * 60 * 1000)
				delete usedReliableMsgIds[msgId]
		}
	}, 5 * 60 * 1000)
}
