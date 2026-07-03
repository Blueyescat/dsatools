import { Decoder } from "dsabp-js"
import { getHullRenderer, getImage, getPaintImage, imagesPath, setCustomImagePathHandler } from "dsabp-js-img"
import { Assets } from "pixi.js"
import { updateObject, UpdateObjectOptions } from "../actions/updateObject.js"
import { editorMap } from "../main.js"
import { toggleThrobber } from "/assets/throbber.js"
import { Dialog } from "/Dialog.js"
import { elByCls } from "/main.js"
import { toast } from "/Toast.js"

interface Mod {
	path: string
	url: string
}

export type Mods = Record<string, Mod>

export async function initMods() {
	setCustomImagePathHandler(path => mods[getImageId(path)]?.url)

	const mods: Mods = {},
		openImportDialogs = new Set<Dialog>()
	let database: IDBDatabase | null = null,
		onChange: () => void,
		unzipFn: typeof import("but-unzip").unzip,
		inflateFn: Parameters<typeof unzipFn>[1]

	// import stuff
	async function importFromDataTransfer(item: DataTransferItem) {
		if (item.type == "application/x-zip-compressed")
			return importFromZip(item.getAsFile())

		const rootEntry = item.webkitGetAsEntry() as FileSystemEntry
		if (rootEntry?.isDirectory) {
			const rootName = rootEntry.name,
				blobs: Record<string, Blob> = {}
			for (const fileEntry of await traverse(rootEntry as FileSystemDirectoryEntry)) {
				blobs[fileEntry.fullPath.slice(rootName.length + 1)] =
					await new Promise(resolve => fileEntry.file(
						file => resolve(file),
						e => { throw e }
					))
			}
			return { rootName, blobs }
		}
	}

	async function importFromZip(zipFile: File) {
		if (!unzipFn) // 1kb but still
			({ unzip: unzipFn, inflateRaw: inflateFn = Decoder.fflate_inflateSync } = await import("but-unzip"))

		const zipItems = unzipFn(new Uint8Array(await zipFile.arrayBuffer()), inflateFn),
			blobs: Record<string, Blob> = {}

		for (const item of zipItems)
			if (!item.filename.endsWith("/"))
				blobs["/" + item.filename] = new Blob([await item.read() as Uint8Array<ArrayBuffer>])

		return { rootName: zipFile.name, blobs }
	}

	function importFromFileList(list: FileList) {
		const rootName = list[0]?.webkitRelativePath.split("/")[0],
			blobs: Record<string, Blob> = {}
		for (const file of list)
			blobs[file.webkitRelativePath.slice(rootName.length)] = file
		return { rootName, blobs }
	}

	async function importFromAndUpdate(target: DataTransferItemList | File | FileList) {
		const importList: { rootName: string, blobs: Record<string, Blob> }[] = []
		try {
			if (target instanceof DataTransferItemList) { // have to handle datatransfer items without delay...
				const promises: Promise<{ rootName: string, blobs: Record<string, Blob> }>[] = []
				for (const item of target) {
					const promise = importFromDataTransfer(item)
					promise.then(data => data && importList.push(data))
					promises.push(promise)
				}
				await Promise.allSettled(promises)
			} else if (target instanceof File && target.type == "application/x-zip-compressed")
				importList.push(await importFromZip(target))
			else if (target instanceof FileList)
				importList.push(importFromFileList(target))
		} catch (err) {
			toast({ body: "Error loading the mod pack!", color: "#F00", duration: 6000 })
			console.error("Error importing mods", err)
		}

		if (!importList)
			return

		for (const dialog of openImportDialogs)
			await new Promise(resolve => {
				dialog.addEventListener("close", resolve, { once: true })
				dialog.close()
			})

		for (const { rootName, blobs } of importList) {
			await new Promise<void>(resolve => {
				const impModCount = Object.keys(blobs).length,
					currModCount = Object.keys(mods).length,
					removeModsHtml = currModCount > 0 ? /*html*/`
						<p style="text-align: right;"><button class="button-replace" style="font-size: 0.9em;">Remove Current Mods and Import</button></p>
					` : ""

				openImportDialogs.add(new Dialog({
					title: "Importing Asset Mod Pack",
					body: /*html*/`
						<p>Pack: <code style="font-weight: bold;">${rootName}</code></p>
						<p style="smaller">This pack contains <b>${impModCount}</b> mod${impModCount == 1 ? "" : "s"}. <b>${currModCount}</b> mod${currModCount == 1 ? " is" : "s are"} currently loaded.</p>
						${removeModsHtml}
						<p style="text-align: right;"><button class="button-add" style="font-size: 0.9em;">Add to Current Mods</button></p>
					`,
					footer: { closeButton: "Cancel" },
					backdrop: true,
					removeOnClose: true,
					onCreate(dialog) {
						const btnReplace = elByCls<HTMLButtonElement>(dialog, "button-replace"),
							btnAdd = elByCls<HTMLButtonElement>(dialog, "button-add"),
							load = () => loadFiles(blobs).then(() => update(true, true))

						btnReplace?.addEventListener("click", () =>
							removeMods(false).then(load).then(() => dialog.close())
						)
						btnAdd.addEventListener("click", () =>
							load().then(() => dialog.close())
						)

						dialog.addEventListener("open", () => (btnReplace ?? btnAdd).focus())
						dialog.addEventListener("close", () => { openImportDialogs.delete(dialog); resolve() })
					},
				}).open(true))
			})
		}
	}

	// database operations
	function initDatabase() {
		return new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("dsatools_bpeditor", 1)
			request.onsuccess = e => resolve(database = (e.target as IDBOpenDBRequest).result)
			request.onupgradeneeded = e => {
				(e.target as IDBOpenDBRequest).result.createObjectStore("modFiles", { keyPath: "path" })
			}
			request.onerror = reject
		})
	}

	async function loadFiles(blobs: Record<string, Blob>) {
		await new Promise((resolve, reject) => {
			const tx = database.transaction("modFiles", "readwrite")
			const store = tx.objectStore("modFiles")
			for (const path in blobs)
				store.put({ path, file: blobs[path] })
			tx.oncomplete = resolve
			tx.onabort = e => reject((e.target as IDBTransaction).error)
		})
		toast({ body: `Mods have been changed. Assets updated.`, color: "#0F0", duration: 8000 })
	}

	async function removeMods(updateAssets = true) {
		await new Promise((resolve, reject) => {
			const tx = database.transaction("modFiles", "readwrite")
			const store = tx.objectStore("modFiles")
			store.clear()
			tx.oncomplete = resolve
			tx.onabort = e => reject((e.target as IDBTransaction).error)
		})
		await update(false, updateAssets)
		toast({ body: `All mods have been removed.${updateAssets ? " Assets updated." : ""}`, color: "#0F0", duration: 8000 })
	}

	// update
	async function updateFile(path: string, file: Blob): Promise<void> {
		const id = getImageId(path)
		const url = URL.createObjectURL(file)
		const modFile: Mod = { path, url }
		URL.revokeObjectURL(mods[id]?.url)
		mods[id] = modFile
	}

	async function update(readDB: boolean, relAssets: boolean) {
		const oldUrls = relAssets && Object.keys(mods).reduce((o, id) => (o[mods[id].url] = id, o), Object.create(null) as Record<string, string>)
		for (const id in mods)
			delete mods[id]
		if (readDB)
			await new Promise<void>((resolve, reject) => {
				const tx = database.transaction("modFiles", "readonly")
				const store = tx.objectStore("modFiles")
				const req = store.getAll()
				tx.oncomplete = () => {
					const fileDatas = req.result as Array<{ path: string, file: Blob }>
					fileDatas.forEach(data => updateFile(data.path, data.file))
					resolve()
				}
				tx.onabort = e => reject((e.target as IDBTransaction).error)
			})
		if (relAssets)
			await updateAssets(oldUrls)
		onChange?.()
	}

	async function updateDOM(oldUrls: Record<string, string>) {
		const itemProxyURL = `${location.origin}/p?https://test.drednot.io/img/`
		const absGameImagesURL = new URL(imagesPath, location.href).href

		async function getNewSrc(src: string): Promise<string | undefined> {
			const oldFileId = oldUrls[src]
			if (oldFileId) { // this src is a mod
				const currModUrl = mods[oldFileId]?.url
				if (currModUrl) // still modded
					return currModUrl
				else // no longer modded, re-get default image
					return oldFileId.startsWith("item/")
						? itemProxyURL + oldFileId + ".png" // use proxy for item urls (temp?)
						: (await getImage(oldFileId))?.src
			} else { // this src isn't a mod, check if it is something we care about
				let id: string
				if (src.startsWith(absGameImagesURL)) // is a gameImages url
					id = src.substring(absGameImagesURL.length)
				else if (src.startsWith(itemProxyURL)) // is an item proxy url
					id = src
				// else, we don't care about this src

				if (id) {
					id = getImageId(id)
					const modData = mods[id]
					if (modData) // no change unless modded now
						return modData.url
				}
			}
		}

		const dialog = document.getElementById("dialog-mods")
		for (const el of document.querySelectorAll<HTMLElement>("img[src], [style*=background][style*=url]")) {
			if (dialog?.contains(el))
				continue
			if (el instanceof HTMLImageElement && el.src) {
				const newSrc = await getNewSrc(el.src)
				if (newSrc) el.src = newSrc
			} else if (el.style.backgroundImage) {
				const url = el.style.backgroundImage.slice(5, -2)
				const newSrc = await getNewSrc(url)
				if (newSrc) el.style.backgroundImage = "url(" + newSrc + ")"
			}
		}
	}

	async function updateGraphics() {
		Assets.cache.reset()

		if (editorMap?.initialized) {
			const { bpRenderer, objects, pusherBeams, background, placement } = editorMap

			// pusher beams
			await pusherBeams.generateTextures()

			// objects
			bpRenderer.clearCache()

			let imgPaint: UpdateObjectOptions["image"]
			const imgHull: Record<string, UpdateObjectOptions["image"]> = {}

			const updateOpts: UpdateObjectOptions = { keepBody: true, keepBpStr: true, keepServer: true }
			for (const obj of objects) {
				const { item, bgTileType } = obj
				if (item)
					delete updateOpts.image
				else if (bgTileType)
					updateOpts.image = bgTileType == "paint"
						? imgPaint ??= await getPaintImage()
						: imgHull[bgTileType] ??= (await getHullRenderer(bpRenderer, bgTileType == "wallC" ? "HULL_CORNER" : (bgTileType == "wallH" ? "HULL_H" : "HULL_V")).render())[0].image
				await updateObject(obj, updateOpts)
			}

			// background
			background.getStarImage().then(() => background.updateBg())

			// place preview
			placement.update()
		}
	}

	async function updateAssets(oldUrls: Record<string, string>) {
		toggleThrobber("Updating assets...")
		await updateDOM(oldUrls)
		await updateGraphics()
		toggleThrobber(false)
	}

	// drag events
	window.addEventListener("dragover", e =>
		e.dataTransfer.types.includes("Files") && e.preventDefault()
	)
	window.addEventListener("drop", e => {
		if (e.dataTransfer.types.includes("Files")) {
			e.preventDefault()
			importFromAndUpdate(e.dataTransfer.items)
		}
	})

	// util
	async function traverse(dirEntry: FileSystemDirectoryEntry) {
		const entries: FileSystemFileEntry[] = [],
			reader = dirEntry.createReader()
		let currEntries: FileSystemEntry[]
		do {
			currEntries = await new Promise<FileSystemEntry[]>(res =>
				reader.readEntries(res, console.error)
			)

			if (currEntries)
				for (const entry of currEntries) {
					if (entry.isFile)
						entries.push(entry as FileSystemFileEntry)
					else
						entries.push(...await traverse(entry as FileSystemDirectoryEntry))
				}
		} while (currEntries?.length)
		return entries
	}

	function getImageId(path: string): string | null {
		let relPath: string
		if (path.startsWith("/img/"))
			relPath = path.substring(5)
		else {
			const s = path.split("drednot.io/img/")
			relPath = s[s.length - 1]
		}
		return relPath.split(".")[0]
	}

	// init
	await initDatabase()
	await update(true, false)

	return {
		mods,
		importFromAndUpdate,
		removeMods,
		setChangeCb(cb: typeof onChange) {
			onChange = cb
		}
	}
}
