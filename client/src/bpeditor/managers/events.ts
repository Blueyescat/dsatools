import { Body } from "detect-collisions"
import { EditorMap } from "../EditorMap.js"
import { usesTouch } from "../main.js"
import { pointerEvent } from "/main.js"

export function initEvents(editorMap: EditorMap) {
	const { collisions, viewport, app } = editorMap

	class PointerHandler {
		body = collisions.createPoint(undefined, { isCentered: true })
		disabled = false
		target: Body
		lastPointerPoint: { clientX: number, clientY: number }

		constructor() {
			const moveHandler = (e: pointerEvent) => {
				const coords = pointerEvent.getValues(e)
				this.lastPointerPoint = { clientX: coords.clientX, clientY: coords.clientY }
				this.update()
			}
			window.addEventListener(pointerEvent.move, moveHandler)
			if (usesTouch)
				window.addEventListener("touchstart", moveHandler)
			else
				app.canvas.addEventListener("mouseout", () => {
					if (this.target) {
						const target = this.target
						this.target = null
						editorMap.emit("coll-pointerout", { target, relatedTarget: null })
					}
				})
		}

		stop() {
			this.disabled = true
			if (this.target) {
				const target = this.target
				this.target = null
				editorMap.emit("coll-pointerout", { target, relatedTarget: null })
			}
		}

		start() {
			this.disabled = false
			this.check()
		}

		check(force = false) {
			// find collided body with highest zIndex which is set for special cases like expando boxes (zIndexMap)
			// doesn't check draw order which would be redundant since it won't allow overlapping objects of same type
			const collided = collisions.search(this.body)
				.reduce((prev, curr) => {
					return (
						curr.mapObject
						&& collisions.checkCollision(this.body, curr)
						&& (!prev || curr.mapObject.display.zIndex > prev.mapObject.display.zIndex)
					) ? curr : prev
				}, null)

			if (collided) {
				if (!force && collided == this.target)
					return
				const relatedTarget = this.target
				this.target = collided
				editorMap.emit("coll-pointerover", { target: collided, relatedTarget })
			} else {
				if (this.target == null)
					return
				const target = this.target
				this.target = null
				editorMap.emit("coll-pointerout", { target, relatedTarget: collided })
			}
		}

		/** Update body using {@link lastPointerPoint}. */
		update() {
			if (this.lastPointerPoint == null)
				return
			const rect = editorMap.app.canvas.getBoundingClientRect()
			const point = viewport.toWorld({ x: this.lastPointerPoint.clientX - rect.left, y: this.lastPointerPoint.clientY - rect.top })
			this.body.setPosition(point.x, point.y)
			if (!this.disabled)
				this.check()
		}
	}

	return {
		pointer: new PointerHandler()
	}
}
