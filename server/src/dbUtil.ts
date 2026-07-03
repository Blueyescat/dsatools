import { BpDB } from "./index.js"
import { randomUUID } from "crypto"

export function get(id) {
	if (id == null) return null
	return BpDB.get(id)
}

export async function set(id, data) {
	if (!data) return
	try {
		return await BpDB.put(id, data)
	} catch (err) {
		return console.error("DB ERROR set", id, err)
	}
}

export function exists(id) {
	if (id == null) return false
	return BpDB.doesExist(id)
}

function getNewId() {
	const id = randomUUID().slice(0, 6)
	if (exists(id))
		return getNewId()
	return id
}

export async function create<T extends Record<string, any>>(data: T): Promise<void | { id: string } & T> {
	const id = getNewId()
	try {
		await BpDB.put(id, data)
		return { id, ...data }
	} catch (err) {
		return console.error("DB ERROR create", id, err)
	}
}
