import { toggleThrobber } from "./throbber.js"
toggleThrobber(null)
/* service worker register & update */
navigator.serviceWorker?.register("/sw.js", { scope: "/" }).then(reg => {
	const start = Date.now(),
		first = !navigator.serviceWorker.controller
	reg.addEventListener("updatefound", () => { // updatefound = reg.installing
		if (Date.now() - start <= 15000)
			toggleThrobber(first ? "" : "Downloading app update,\npage will reload!", true)
		reg.installing.addEventListener("statechange", e => {
			if (e.target.state != "activating") return
			sessionStorage.setItem("dsatools_showChangelog", "1")
			// reload to apply update only if the page was just loaded, since a diff page may cause update
			if (first || (Date.now() - start <= 20000 && !location.pathname.startsWith("/items")))
				return window.reloadingToUpdate = true, location.reload()
		})
	})
}).catch(err => {
	console.info("SW registration failed:", err.message)
})
