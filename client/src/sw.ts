export { }
declare let self: ServiceWorkerGlobalScope

// changing this file makes the browser update the active SW, and changing cacheName makes it re-cache all files
const cacheName = "dsatools41."

const cacheUrls = [
	/*@build_cacheUrls>*/"/","https://dt.tmp.bz/p?https://pub.drednot.io/test/econ/item_schema.json",...["app.webmanifest","bpbin","bpeditor","bptools","Dialog.js","img2pixar","items","main.css","main.js","sw.js","Toast.js"],...["autoInputSave.js","drag-drop-touch.esm.js","footer.html","goatc.js","header.html","icomoon.woff","sw-reg.js","throbber.js"].map(f=>"assets/"+f),...["144.svg","180a.svg","32.png","wheel.svg"].map(f=>"assets/icons/"+f),...["anchor.png","bg_ship.png","bulk_bay_marker.png","bulk_ejector.png","comms_station.png","corner.png","door_full.png","exbox_base.png","exbox_border.png","exbox_center.png","exbox_corner.png","exbox_mid.png","fab_lod.png","fab_t_engineering.png","fab_t_equipment.png","fab_t_legacy.png","fab_t_munitions.png","fab_t_starter.png","helm_wheel.png","helm_wheel_starter.png","hull_mount.png","item_ejector_compact.png","item_hatch.png","item_hatch_patch.png","item_hatch_starter.png","item_launcher.png","loader_arrow.png","loader_base.png","loader_flux.png","loader_hand.png","loader_priority.png","lockdown_override_green.png","msu.png","msu_top.png","nav_unit.png","pusher.png","pusher_beam.png","rcd_flux.png","rcd_sandbox.png","recycler.png","shield_generator.png","shield_matrix_idle.png","shield_projector_1.png","sign.png","spawn.png","star.png","tank.png","thruster.png","thruster_base.png","thruster_starter.png","tiles_subworld.png","turret_action.png","turret_action_acute.png","turret_action_auto.png","turret_action_burst.png","turret_action_obtuse.png","turret_action_rc_starter.png","turret_auto_spinner.png","turret_barrel.png","turret_barrel_burst.png","turret_barrel_obtuse.png","turret_base.png","turret_controller.png","turret_controller_new.png"].map(f=>"assets/game-images/"+f),...["arrow_in.png","arrow_out.png","asterisk_green.png","cross.png","page_dark.png","page_light.png"].map(f=>"assets/game-images/silk/"+f),"assets/game-images/immui/arrow_angle.png",...["converter.js","main.css","main.js","worker.js"].map(f=>"img2pixar/"+f),"img2pixar/assets/bg_ship.png", "img2pixar/assets/color-palettes.json",...["main.css","main.js","operations.js"].map(f=>"bptools/"+f),...["checkPlacement.js","EditorMap.js","main.css","main.js","MapObject.js","SelectBox.js","toolExport.js","util.js"].map(f=>"bpeditor/"+f),...["AngleInput.js","FilterModeInput.js","FixedAngleInput.js","hotbar.js","itemPicker.js","ItemSlot.js","LoaderPointsInput.js","LoaderPriorityInput.js","menuBar.js","MultiItemInput.js","PusherModeInput.js","shapePicker.js","uiMain.js"].map(f=>"bpeditor/ui/"+f),...["bpStr.js","buildOrder.js","collabMenu.js","exportImage.js","findReplace.js","itemMatList.js","pusherFocuser.js","welcome.js"].map(f=>"bpeditor/ui/win-man/"+f),...["ConfigMenu.js","EjectorConfigMenu.js","ExpandoBoxConfigMenu.js","HatchConfigMenu.js","LoaderConfigMenu.js","PusherConfigMenu.js","ShieldGeneratorConfigMenu.js"].map(f=>"bpeditor/ui/config-menu/"+f),...["background.js","boxExpander.js","collab.js","configs.js","debug.js","events.js","highlight.js","history.js","mods.js","placement.js","pointer.js","pusherBeams.js","selection.js","shapePlacement.js","webStorage.js"].map(f=>"bpeditor/managers/"+f),...["guide.html","InvertBackFilter.js","pusher_beam_idle.png"].map(f=>"bpeditor/assets/"+f),...["connectObject.js","createObject.js","deleteObject.js","disconnectObject.js","importBlueprint.js","moveObject.js","updateObject.js"].map(f=>"bpeditor/actions/"+f),...["but-unzip.js","detect-collisions.js","dsabp-js-img.js","dsabp-js.js","pica.js","pixi-viewport.js","pixi.js","zoomist.js"].map(f=>"lib/"+f),"lib/zoomist/css.css","lib/@geckos.io/client.js"/*@build_cacheUrls<*/
]

const fetchFirstList = new RegExp(`/item_schema.json$|^https://(test\\.)?drednot\\.io/`),
	noCacheList = /\/bpbin\/\w+|\/\/res.cloudinary.com\/|\/assets\/changelog\|?noCache/

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
			const cache = await caches.open(cacheName),
				noCache = noCacheList.test(url) || location.hostname.startsWith("localhost"),
				fetchFirst = !noCache && (fetchFirstList.test(url))

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
