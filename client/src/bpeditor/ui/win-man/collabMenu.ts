import { editorMap } from "../uiMain.js"
import { Dialog } from "/Dialog.js"
import { addTooltip, elByCls, reposTooltip } from "/main.js"

export function initCollabMenu() {
	const body = /*html*/`
		<p class="offline" style="display: none;">You are offline</p>
		<div class="container">
			<p class="tooltip-ref" data-show-above style="display: flex;">
				<input type="text" class="id inherit-font" placeholder="Room ID (Random)" minlength="1" maxlength="16" spellcheck="false" autocomplete="off"
					style="font-family: monospace; text-transform: lowercase; flex: 1; padding: 8px; text-align: center;" 
				>
				<small class="tooltip-content" style="visibility: hidden;"></small>
			</p>
			<p>
				<button class="button-create inherit-font">Create</button> <button class="button-join inherit-font">Join</button> <button class="button-leave inherit-font">Leave</button>
			</p>
			<p class="info"></p>
			<p>Ping: <span class="ping"></span></p>
		</div>
	`
	const { state, createRoom, joinRoom, leaveRoom, getPing } = editorMap.collab,
		COPY_TTP = "Click to copy"

	new Dialog({
		id: "dialog-collab",
		title: "Collaborate (Experimental Feature)",
		draggable: { key: "collab" },
		body,
		onCreate(dialog) {
			document.getElementById("button-menu-collab").addEventListener("click", () => dialog.toggle())

			const btnCreate = elByCls<HTMLButtonElement>(dialog, "button-create"),
				btnJoin = elByCls<HTMLButtonElement>(dialog, "button-join"),
				btnLeave = elByCls(dialog, "button-leave"),
				elId = elByCls<HTMLInputElement>(dialog, "id"),
				elInfo = elByCls(dialog, "info"),
				elPing = elByCls(dialog, "ping"),
				ttpRef = elByCls(dialog, "tooltip-ref"),
				ttpContent = elByCls(ttpRef, "tooltip-content")

			addTooltip(ttpRef)

			btnCreate.addEventListener("click", async () => {
				if (btnJoin.classList.contains("disabled"))
					return
				const id = elId.value.trim().toLowerCase().substring(0, 16)
				toggleButtons(false)
				createRoom(id || null)
					.then(roomId => {
						elId.value = roomId
						elInfo.textContent = "Room ready."
					})
					.catch(err => {
						elInfo.textContent = (err?.message ?? err)?.replace?.("TypeError:", "Error:")
						toggleButtons(true)
					})
			})

			btnJoin.addEventListener("click", () => {
				if (btnJoin.classList.contains("disabled"))
					return
				const id = elId.value.trim().toLowerCase()
				if (!id)
					return
				toggleButtons(false)
				joinRoom(id)
					.then(roomId => {
						elId.value = roomId
						elInfo.textContent = "Joined the room."
						toggleButtons(false)
					})
					.catch(err => {
						elInfo.textContent = err
						toggleButtons(true)
					})
			})

			btnLeave.addEventListener("click", () => {
				if (leaveRoom()) {
					elInfo.textContent = "Left the room."
					toggleButtons(true)
				}
			})

			editorMap.on("collab-status", (status, message) => {
				switch (status) {
					case "connecting":
						return elInfo.textContent = "Connecting..."
					case "disconnected": {
						if (!state.roomId) // no reconnect
							toggleButtons(true)
						return elInfo.textContent = "Disconnected"
					} case "reconnected": {
						elId.textContent = state.roomId
						return elInfo.textContent = "Reconnected, rejoining the room..."
					} case "rejoinedRoom":
						return toggleButtons(false), elInfo.textContent = "Rejoined the room."
					case "rejoinRoomFailed":
						return elInfo.textContent = message
				}
			})

			function toggleButtons(on: boolean) {
				btnCreate.classList.toggle("disabled", !on)
				btnJoin.classList.toggle("disabled", !on)
				ttpContent.style.visibility = on ? "hidden" : ""
			}

			ttpContent.textContent = COPY_TTP
			elId.addEventListener("click", () => {
				elId.select()
				if (ttpContent.style.visibility != "hidden") {
					navigator.clipboard.writeText(elId.value)
						.then(() =>
							ttpContent.textContent = "Copied!"
						).catch(() =>
							ttpContent.textContent = "Unable to copy to clipboard: no permission."
						).finally(() => {
							reposTooltip(ttpRef, ttpContent)
							setTimeout(() => (ttpContent.textContent = COPY_TTP, reposTooltip(ttpRef, ttpContent)), 2500)
						})
				}
			})

			const updateOnLine = () => dialog.classList.toggle("offline", !navigator.onLine)
			updateOnLine()
			window.addEventListener("online", updateOnLine)
			window.addEventListener("offline", updateOnLine)

			let connInfoInterval: number
			const startConnInfo = () => {
				connInfoInterval = setInterval(async () => {
					if (state.channel && document.hasFocus()) {
						const ping = await getPing().catch(() => { })
						if (ping !== null)
							elPing.textContent = `${ping ?? "--"}ms`
					}
				}, 1000)
			}
			dialog.addEventListener("open", () => {
				startConnInfo()
				if (state.roomId) {
					elId.value = state.roomId
					toggleButtons(false)
				}
			})
			dialog.addEventListener("close", () => clearInterval(connInfoInterval))
		}
	})
}
