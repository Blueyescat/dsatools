class Toast extends HTMLElement {
	static localName = "dt-toast"
	static activeToasts = new Set<Toast>()
	static cont: HTMLElement

	#timer: number

	constructor({ body, duration = 5000, color }: { title?: string, icon?: string, body?: string, duration: number, color?: string }) {
		super()

		if (!Toast.cont) {
			Toast.cont = document.createElement("div")
			Toast.cont.id = "dt-toast-container"
			document.body.appendChild(Toast.cont)
		}

		/* const elTitle = document.createElement("strong")
		elTitle.textContent = title
		this.appendChild(elTitle)

		const elIcon = document.createElement("span")
		elIcon.innerHTML = icon
		this.appendChild(elIcon) */

		const elContent = document.createElement("div")
		elContent.className = "content"

		const elBody = document.createElement("p")
		elBody.innerHTML = body
		elContent.appendChild(elBody)

		if (color != null)
			elContent.style.borderBottomColor = color

		this.#timer = window.setTimeout(() => this.dismiss(), duration)

		this.style.animationName = "slide"
		this.addEventListener("animationend", () => {
			this.style.animationName = ""
			this.style.animationDirection = "reverse"
		}, { once: true })

		this.appendChild(elContent)
		Toast.cont.appendChild(this)
		Toast.activeToasts.add(this)

		if (this.offsetTop > window.innerHeight - 200)
			(Toast.activeToasts.values().next().value as Toast).dismiss()
	}

	disconnectedCallback() {
		clearTimeout(this.#timer)
		this.#timer = null
	}

	dismiss(): void {
		Toast.activeToasts.delete(this)
		this.style.animationName = "slide"
		this.addEventListener("animationend", async () => {
			for (let h = Math.round(this.offsetHeight); h > 0; h--) {
				this.style.height = h + "px"
				await new Promise(r => setTimeout(r, 1))
			}
			this.remove()
		}, { once: true })
	}
}

export const toast = (...args: ConstructorParameters<typeof Toast>) => new Toast(...args)

customElements.define(Toast.localName, Toast)
