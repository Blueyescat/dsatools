
import geckos, { iceServers, ServerChannel as SC } from "@geckos.io/server"
import { Request, Response, Server } from "hyper-express"
import { exitFunctions } from "./index.js"

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

	createObject: []
	deleteObjects: []
	moveObject: []
	updateObject: []
	moveConfigObjects: []
}

interface ServerChannel extends SC {
	userData: {
		roomOwner: boolean
	}
}

type Room = {
	channels: Set<ServerChannel>,
	broadcast: OmitFirstParam<typeof sendToRoom>,
	deleteTimer?: NodeJS.Timeout,
	awaitingBp: Set<ServerChannel>,
	startedAt: number
}

export async function initUdpServer(server: Server) {
	const rooms: Record<string, Room> = {}

	const io = geckosWithServer(server, { iceServers })

	function createRoom(channel: ServerChannel, forceId?: string) {
		const roomId = forceId
			? forceId.trim().substring(0, 16).toLowerCase()
			: crypto.randomUUID().substring(0, 4)
		let room = rooms[roomId]
		if (room) {
			if (room.deleteTimer == null) { // room isn't empty
				channel.send("roomOwner", false) // send before roomId
				channel.send("roomId", false)
				return false
			} else {
				room.channels.add(channel)
				clearTimeout(room.deleteTimer)
				delete room.deleteTimer
				console.info(`${channel.id} joined room ${roomId}`)
			}
		} else {
			rooms[roomId] = room = {
				channels: new Set([channel]),
				broadcast: function (...args: Partial<Parameters<OmitFirstParam<typeof sendToRoom>>>) { sendToRoom(this, ...args) },
				awaitingBp: new Set(),
				startedAt: Date.now()
			}
			console.info(`${channel.id} created room ${roomId}`)
		}

		channel.userData.roomOwner = true
		channel.join(roomId)
		channel.send("roomOwner", true) // send before roomId
		channel.send("roomId", roomId)
		room.broadcast("userJoinLeave", [true, channel.id, room.channels.size])
		return roomId
	}

	function joinRoom(channel: ServerChannel, roomId: string) {
		const room = rooms[roomId],
			alreadyInRoom = room?.channels.has(channel)
		if (room && !alreadyInRoom) {
			room.channels.add(channel)
			if (room.deleteTimer) {
				clearTimeout(room.deleteTimer)
				delete room.deleteTimer
				channel.userData.roomOwner = true
			}
			channel.join(roomId)
			channel.send("roomId", roomId)
			channel.send("roomOwner", channel.userData.roomOwner == true)
			room.broadcast("userJoinLeave", [true, channel.id, room.channels.size])
			console.info(`${channel.id} joined room ${roomId}`)
			return true
		}
		channel.send("roomId", alreadyInRoom ? roomId : null)
		return alreadyInRoom
	}

	io.onConnection(channel => {
		addGeckosMethods(channel)

		console.info(`${channel.id} connected`)
		channel.onDisconnect(() => {
			let roomInfo!: string
			if (channel.roomId) {
				const roomId = channel.roomId,
					room = rooms[roomId],
					channels = room.channels
				if (channel.userData.roomOwner) {
					channels.delete(channel)
					if (channels.size == 0) {
						roomInfo = "will be deleted in 30 minutes if nobody joins:"
						room.deleteTimer = setTimeout(() => {
							delete rooms[roomId]
							console.info(`room ${roomId} deleted due to inactivity`)
						}, 30 * 60 * 1000)

					} else {
						const [firstChannel] = channels
						firstChannel.userData.roomOwner = true
						firstChannel.send("roomOwner", true)
						roomInfo = `removed from, and transfered to ${firstChannel.id}:`
					}
				} else {
					channels.delete(channel)
					roomInfo = "removed from"
				}
				room.broadcast("userJoinLeave", [false, channel.id, room.channels.size])
			}
			console.info(`${channel.id} disconnected${roomInfo ? `, ${roomInfo} room ${channel.roomId}` : ""}`)
		})

		// channel.listen("ping", () => channel.emit("ping"))

		channel.listen("createRoom", id => createRoom(channel, id))

		channel.listen("joinRoom", id => joinRoom(channel, id.toLowerCase()))

		// client requests bp
		channel.listen("requestBp", () => {
			const room = rooms[channel.roomId!]
			if (!room)
				return
			for (const owner of room.channels) {
				if (owner.userData.roomOwner) {
					room.awaitingBp.add(channel)
					// request bp from owner client
					owner.emit("requestBp")
					return
				}
			}
		})

		// client sent bp
		channel.listen("bp", ([type, bpStr]) => {
			const room = rooms[channel.roomId!]
			if (!room)
				return
			if (type == "share") {
				room.channels.forEach(c => {
					if (c != channel)
						c.send("bp", [type, bpStr], { reliable: true, runs: 10, interval: 100 })
				})
				room.awaitingBp.clear()
			} else {
				room.awaitingBp.forEach(c => {
					c.send("bp", [type, bpStr], { reliable: true, runs: 10, interval: 100 })
					room.awaitingBp.delete(c)
				})
			}
		})

		// client sent object events
		void (["resizeMap", "createObject", "deleteObjects", "moveObject", "updateObject", "moveConfigObjects"] satisfies (keyof SEvent)[]).forEach(eventName =>
			channel.listen(eventName, data =>
				rooms[channel.roomId!]?.broadcast(eventName, data, { except: channel })
			)
		)
	})
}









// - FIX GECKOS.IO -

declare module "@geckos.io/server" {
	interface ServerChannel {
		listen: <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) => void
		listenOnce: <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) => void
		removeListener: (...args: Parameters<ServerChannel["eventEmitter"]["removeListener"]>) => void
		send: <E extends keyof SEvent>(eventName: E, data: SEvent[E], options?: SendOptions) => void
	}
}

const usedReliableMsgIds: Record<string, number> = Object.create(null)
function addGeckosMethods(proto: ServerChannel) {
	if (Object.hasOwn(proto, "once"))
		return

	delete proto.on

	proto.listen = function <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void, isOnce?: boolean) {
		this.eventEmitter[isOnce ? "once" : "on"](eventName, function (data: SEvent[keyof SEvent] | { MESSAGE: SEvent[keyof SEvent], RELIABLE: 1, ID: string }) {
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
		})
	}


	proto.listenOnce = function <E extends keyof SEvent>(eventName: E, callback: (data: SEvent[E]) => void) {
		// @ts-expect-error: .
		this.listen(eventName, callback, true)
	}

	proto.removeListener = function <E extends keyof SEvent>(n: E, cb: (data: SEvent[E]) => void) {
		this.eventEmitter.removeListener(n, cb)
	}

	proto.send = function <E extends keyof SEvent>(eventName: E, data: SEvent[E], options: SendOptions) {
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

function sendToRoom<E extends keyof SEvent>(room: Room, eventName: E, data: SEvent[E], options?: SendOptions & { except?: SC }) {
	room?.channels.forEach(c => c != options?.except && c.send(eventName, data, options))
}

interface SendOptions {
	interval?: number
	reliable?: boolean
	runs?: number
}

type OmitFirstParam<F> = F extends (x: never, ...args: infer P) => infer R ? (...args: P) => R : never


//
import { bridge, promiseWithTimeout, ServerOptions } from "@geckos.io/server/lib/deps.js"
import { additionalCandidates, close, connection, remoteDescription } from "@geckos.io/server/lib/httpServer/routes.js"
import { cleanup } from "@geckos.io/server/lib/wrtc/nodeDataChannel.js"
function geckosWithServer(server: Server, options: ServerOptions) {
	const io = geckos(options), PREFIX = "/.wrtc/v2"
	io.server = server as any
	server.options(`${PREFIX}/*`, (req: Request, res: Response) =>
		res.status(200).send("200: OK")
	)
	server.post(`${PREFIX}/connections`, (req: any, res: any) =>
		connection(io.connectionsManager, req, res)
	)
	server.post(`${PREFIX}/connections/:id/remote-description`, (req: any, res: any) =>
		remoteDescription(io.connectionsManager, req, res)
	)
	server.get(`${PREFIX}/connections/:id/additional-candidates`, (req: any, res: any) =>
		additionalCandidates(io.connectionsManager, req, res)
	)
	server.post(`${PREFIX}/connections/:id/close`, (req: any, res: any) =>
		close(io.connectionsManager, req, res)
	)
	exitFunctions.push(async () => {
		for (const [_, connection] of Array.from(io.connectionsManager.connections))
			await connection.close()
		await promiseWithTimeout(cleanup(), 2000)
		bridge.removeAllListeners()
	})
	return io
}
