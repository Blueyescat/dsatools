/* Service Worker Register & Update */
navigator.serviceWorker?.register("/sw.js", { scope: "/" }).then(reg => {
	const start = Date.now(), first = !navigator.serviceWorker.controller
	reg.addEventListener("updatefound", () => { // updatefound = reg.installing
		const fade = () => document.getElementById("main-container").style.opacity = "0.2"
		first && fade()
		reg.installing.addEventListener("statechange", e => {
			first || fade()
			if (e.target.state != "activating") return
			if (first)
				return location.reload()
			console.info("SW - Updated")
			if (Date.now() - start <= 4000 // reload to apply update if the page was just loaded
				&& !location.pathname.startsWith("/items")
			) {
				document.getElementById("header-content")?.insertAdjacentHTML("afterbegin", "<h2 style='font-weight:normal;margin:0'>Reloading to update the app!&nbsp;</h2>")
				location.reload()
			}
		})
	})
}).catch(err => {
	console.info("SW registration failed:", err.message)
})
