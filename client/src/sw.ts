export { }
declare let self: ServiceWorkerGlobalScope

// changing this file makes the browser update the active SW, and changing cacheName makes it re-cache all files
const cacheName = "dsatools41,"

const cacheUrls = [
	/*@build_cacheUrls>*/""/*@build_cacheUrls<*/
]

const fetchFirstList = new RegExp(`/item_schema.json$|^https://(test\\.)?drednot\\.io/`),
	noCacheList = /\/bpbin\/\w+|\/\/res.cloudinary.com\/|\/assets\/changelog|\?noCache/

self.addEventListener("install", e => {
	e.waitUntil(
		caches.open(cacheName).then(cache => (
			Promise.all(cacheUrls.map(url =>
				cache.add(url).catch(err => console.error(err.message, url))
			))
		))
	)
	self.skipWaiting()
})

const stripTrailingSlash = (url: string) => {
	if (!url.startsWith(location.origin + "/p?"))
		url = url.split("?")[0]
	return url.endsWith("/") ? url.slice(0, -1) : url
}

self.addEventListener("fetch", e => {
	if (e.request.method != "GET" || !e.request.url.startsWith("http"))
		return
	const url = stripTrailingSlash(e.request.url)
	e.respondWith(
		(async () => {
			const cache = await caches.open(cacheName)
			const noCache = noCacheList.test(e.request.url) || location.hostname.startsWith("localhost")
			const fetchFirst = !noCache && (fetchFirstList.test(url))

			if (!noCache && (!navigator.onLine || !fetchFirst)) {
				const cacheRes = await cache.match(url)
				if (cacheRes) return cacheRes
			}

			if (!navigator.onLine)
				return Response.error()

			return fetch(e.request).then(res => { //
				if (!noCache)
					cache.put(url, res.clone())
				return res
			}).catch(async () => {
				if (fetchFirst) {
					const cacheRes = await cache.match(e.request.url)
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
					key != cacheName && arr.push(caches.delete(key) as any), arr
				), [self.clients.claim()])
			)
		)
	)
})
