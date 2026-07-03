const prefix = "dsatools_bpeditor_",
	strgKeySession = prefix + "session",
	strgKeyRecentBps = prefix + "recent",
	strgKeySettings = prefix + "settings"

export let sessionId = sessionStorage.getItem(strgKeySession)
if (!sessionId) resetSessionId()
export function resetSessionId() {
	sessionStorage.setItem(strgKeySession, sessionId = Date.now().toString())
}

/* RECENT BLUEPRINTS */
export type RecentBps = Record<string, { date: number, str: string }>
export function getRecentBps() {
	return (JSON.parse(localStorage.getItem(strgKeyRecentBps)) ?? {}) as RecentBps
}
export function saveRecentBp(data: RecentBps, str: string | null, sessionToReplaceIfCurrentEmpty?: string) {
	if (sessionToReplaceIfCurrentEmpty && !data[sessionId])
		delete data[sessionToReplaceIfCurrentEmpty]
	data[sessionId] = { date: Date.now(), str }
	saveRecentBps(data)
}
export function saveRecentBps(data: RecentBps) {
	localStorage.setItem(strgKeyRecentBps, JSON.stringify(data))
}

/* SETTINGS */
export const enum SettingsBool {
	hideHeader = 1 << 0,
	hideWelcomeNewcomers = 1 << 1
}

class BitField<T extends number> {
	declare val: number
	constructor(val: number = 0) { this.val = val }
	enable(flag: T) { this.val |= flag }
	disable(flag: T) { this.val &= ~flag }
	has(flag: T) { return (this.val & flag) != 0 }
	toJSON() { return `BF(${this.val})` }
}

class Settings {
	bools: BitField<SettingsBool>

	load() {
		const item = localStorage.getItem(strgKeySettings)
		if (item) {
			Object.assign(this, JSON.parse(item, (key, value) => {
				if (typeof value == "string" && value.startsWith("BF("))
					return new BitField(parseInt(value.slice(3, -1)))
				return value
			}))
		}

		// DEFAULTS
		this.bools ??= new BitField<SettingsBool>()

		return this
	}
	save() {
		localStorage.setItem(strgKeySettings, JSON.stringify(this))
	}
}

let settingsInstance: Settings
export const getSettings = () => {
	return (settingsInstance ??= new Settings()).load()
}

//
const strgKeyOldHideHeader = "dsatools_bpeditor_hideHeader"
if (localStorage.getItem(strgKeyOldHideHeader)) {
	const settings = getSettings()
	settings.bools.enable(SettingsBool.hideHeader)
	settings.save()
	localStorage.removeItem(strgKeyOldHideHeader)
}
