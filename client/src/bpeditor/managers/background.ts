import { getImage } from "dsabp-js-img"
import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js"
import { EditorMap } from "../EditorMap.js"
import { app } from "../main.js"

export async function initBackground(editorMap: EditorMap) {
	const { viewport, squareSize } = editorMap

	const container = new Container({
		eventMode: "none",
		zIndex: -2
	})

	/* STAR BG */
	let imgStar: Texture
	async function getStarImage() {
		imgStar = await Assets.load(await getImage("star"))
	}
	await getStarImage()

	const min = 0.06
	async function updateBg() {
		const { width, height } = app.renderer,
			reqSpriteAmount = Math.floor((width * height) / 1400), // px per star
			children = container.children as Sprite[]
		for (let i = 0; i < reqSpriteAmount; i++) {
			const sprite = i < children.length ? children[i] : container.addChild(new Sprite())
			sprite.texture = imgStar

			sprite.position.set(Math.random() * width, Math.random() * height)
			const sR = Math.random(),
				max = Math.random() > 0.92 ? 0.32 : 0.15,
				cR = Math.random()
			sprite.scale.set(1 * sR * (max - min) + min)
			sprite.tint = (cR < 0.6 ? 0xE4E4E4 : (cR < 0.8 ? 0xAFD1E9 : 0xC6BB95))
		}

		// remove excess sprites - won't be decreased for now
		/* if (children.length > reqSpriteAmount)
			container.removeChildren(reqSpriteAmount, children.length) */
	}
	app.stage.addChild(container)

	// window.onresize was delayed or something, pixi's resizeTo also use it
	let timer: number, lastWidth = 0, lastHeight = 0
	new ResizeObserver(entries => {
		clearTimeout(timer)
		timer = setTimeout(() => {
			const rect = entries[0].contentRect

			app.renderer.resize(rect.width, rect.height)
			updateGrid()

			if (lastWidth >= rect.width && lastHeight >= rect.height)
				return

			updateBg()

			viewport.resize(lastWidth = rect.width, lastHeight = rect.height)
		}, 40)
	}).observe(app.canvas.parentElement)

	timer = setTimeout(updateBg, 40)

	/* GRID */
	let isGridOn = false
	const gridGraph = new Graphics({ zIndex: -2, visible: false })

	function updateGrid() {
		if (!isGridOn) return
		const scale = gridGraph.scale = viewport.scaled
		gridGraph.clear()

		const gridSize = Math.max(squareSize, (Math.round((squareSize / scale) / squareSize) * squareSize * 1.5) - (squareSize * 5))

		const { x: anchorX, y: anchorY } = viewport.toGlobal({ x: -squareSize / 2, y: -squareSize / 2 })

		const width = app.screen.width / scale
		const height = app.screen.height / scale

		for (let x = (anchorX / scale) % gridSize; x <= width; x += gridSize) {
			gridGraph.moveTo(x, 0)
			gridGraph.lineTo(x, height)
		}

		for (let y = (anchorY / scale) % gridSize; y <= height; y += gridSize) {
			gridGraph.moveTo(0, y)
			gridGraph.lineTo(width, y)
		}

		gridGraph.stroke({ width: 1 / scale, color: 0x666666, alpha: 1 })
	}
	app.stage.addChild(gridGraph)

	const origOnUpdate: () => void = viewport.scale["_observer"]._onUpdate
	viewport.scale["_observer"]._onUpdate = scale => {
		origOnUpdate.call(viewport.scale["_observer"], scale)
		updateGrid()
	}

	function toggleGrid(state: boolean) {
		isGridOn = gridGraph.visible = state
		if (state) updateGrid()
		else gridGraph.clear()
	}

	return { isGridOn, toggleGrid, container, getStarImage, updateBg }
}
