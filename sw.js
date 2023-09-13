// changing this file makes a browser update the active SW, and changing cacheName makes it re-cache all files
const cacheName = "dsatools-v1"

const cacheUrls = ["/", ..."items/ main.css main.js app.webmanifest https://x.dsatools.workers.dev?https://pub.drednot.io/test/econ/item_schema.json".split(" ")]

for (const p of ("sw-reg.js goatc.min.js icomoon.woff header.html"
	+ " footer.html icons/64.webp icons/80m.webp icons/96.webp icons/144.webp icons/512.png"
	+ " autoInputSave.js lib/pica/pica.min.js lib/zoomist/zoomist.min.js lib/zoomist/zoomist.min.css"
	+ " lib/dsabp-js/index.min.js").split(" "))
	cacheUrls.push("assets/" + p)

for (const p of " main.css main.js converter.js worker.js assets/bg_ship.png assets/color-palettes.json".split(" "))
	cacheUrls.push("img2pixar/" + p)

for (const p of " main.css main.js operations.js assets/items.js".split(" "))
	cacheUrls.push("bpeditor/" + p)

const fetchFirstList = /\/item_schema.json/

self.addEventListener("install", e => {
	e.waitUntil(
		caches.open(cacheName).then(cache =>
			Promise.all(cacheUrls.map(url =>
				cache.add(url).catch(e => console.error(e.message, url))
			))
		)
	)
	self.skipWaiting()
})

self.addEventListener("fetch", e => {
	if (e.request.method != "GET" || !e.request.url.startsWith("http"))
		return
	e.respondWith(
		(async () => {
			const cache = await caches.open(cacheName)
			const fetchFirst = fetchFirstList.test(e.request.url)
			if (!fetchFirst) {
				// without .url, misses some random files
				const cacheRes = await cache.match(e.request.url, { ignoreSearch: true })
				if (cacheRes) return cacheRes
			}
			return fetch(e.request).then(res => {
				cache.put(e.request.url.split("?")[0], res.clone()) // firefox caches with params
				return res
			}).catch(async () => {
				if (fetchFirst) {
					const cacheRes = await cache.match(e.request.url, { ignoreSearch: true })
					if (cacheRes) return cacheRes
				}
				return Response.error()
			})
		})()
	)
})

self.addEventListener("activate", e => {
	e.waitUntil(
		caches.keys().then(keys =>
			Promise.all(
				keys.reduce((arr, key) => (
					key != cacheName && arr.push(caches.delete(key)), arr
				), [self.clients.claim()])
			)
		)
	)
})
