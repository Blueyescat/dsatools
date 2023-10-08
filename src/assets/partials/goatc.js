/*! sends non-personal analytics data to https://goatcounter.com. @author Blueyescat */
(() => {
	let w = window, d = document, lastClick = {}
	function count(path = location.pathname, isEvent, options = {}) {
		if (location.hostname == "dsa.fr.to" && !(w.callPhantom || w._phantom || w.phantom
			|| w.__nightmare
			|| d.__selenium_unwrapped || d.__webdriver_evaluate || d.__driver_evaluate
			|| navigator.webdriver))
			fetch("https://a.dsatools.workers.dev?" + new URLSearchParams({
				p: path,
				r: d.referrer,
				t: isEvent && !options.t ? "" : d.title,
				e: !!isEvent,
				s: [screen.width, screen.height, devicePixelRatio],
				q: location.search,
				b: 0
			}).toString(), { method: "POST", mode: "no-cors", keepalive: true }
			).catch(() => { })
	}

	if (d.visibilityState == "visible")
		count()
	else
		d.addEventListener("visibilitychange", function f() {
			if (d.visibilityState == "visible") {
				count()
				d.removeEventListener("visibilitychange", f)
			}
		})
	w.addEventListener("appinstalled", () => count("pwa_install", true))
	w.addEventListener("click", e => {
		let el = e.target
		if (el.matches("button,input[type=radio],input[type=checkbox],a")) {
			let id = el.id || el.textContent || el.name || el.parentElement?.textContent
			if (el.type == "radio") id += "-" + el.parentElement?.textContent
			if (el.type == "checkbox") id += "-" + el.checked
			if (!(Date.now() - lastClick[id] <= 2000))
				(lastClick[id] = Date.now(), count("click_" + id, true))
		}
	})
})()
