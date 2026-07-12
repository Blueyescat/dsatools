import { context, build as esbuild, formatMessages } from "esbuild"
import { watch as fsWatch } from "fs"
import { readFile, readdir, rename, rm, writeFile } from "fs/promises"
import { minify as minifyHtml } from "html-minifier-terser"
import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"
import pathM from "path"

const watch = process.argv.includes("-w"),
	srcDir = "./src/",
	outDir = "./dist/",
	libDir = "/lib/",
	outLibDir = pathM.join(outDir, libDir),
	minify = !watch,
	sourcemap = true,

	// html files aren't scanned, manually add here to allow link tags with lib/
	externals = new Set(["zoomist/css"]),
	// keep bundled with their importer instead of separate files (not a must-have, decreases web requests)
	keepBundled = [
		"@geckos.io/common/lib/",
		"@yandeu/events" // used by geckos client
	],
	// only exports actually imported (from src/ or other packages) get pulled into dist/lib/
	treeShakenLibs = ["pixi.js"]

/** @type {import("html-minifier-terser").Options} */
const htmlOptions = {
	collapseWhitespace: true,
	conservativeCollapse: true,
	collapseBooleanAttributes: true,
	minifyCSS: true,
	minifyJS: { module: true },
	quoteCharacter: "\"",
	removeComments: true,
	removeRedundantAttributes: true,
	sortAttributes: true,
	sortClassName: true
}

/** @type {import("esbuild").BuildOptions} */
const commonBuildOptions = {
	target: "es2022",
	supported: { "class-static-blocks": false },
	format: "esm",
	platform: "browser",
	bundle: true,
	minify
}

console.info(time(), "Cleaning")
for (const file of await readdir(outDir).catch(() => { }) ?? [])
	await rm(pathM.join(outDir, file), { recursive: true })

const srcCtx = await context({
	...commonBuildOptions,
	packages: "external",
	entryPoints: [`${srcDir}**`],
	loader: {
		".webmanifest": "copy",
		".json": "copy",
		".html": "copy",
		".ejs": "copy",
		".woff": "copy",
		".png": "copy",
		".webp": "copy",
		".svg": "copy",
		".md": "copy",
		".mp4": "copy",
		".gif": "copy",
	},
	outdir: outDir,
	logLevel: "silent",
	sourcemap,
	plugins: [buildStartLogPl(), mdToHtmlPl(), resolvePackagesPl(), ...(watch ? [] : [minifyHtmlPl()]), buildWithLogsPl()]
})

//

function buildStartLogPl() {
	return {
		name: "buildStartLog",
		/** @param {import("esbuild").PluginBuild} build */
		setup(build) {
			build.onStart(() => console.info(time(), (watch ? "[watch] " : "") + "Building..."))
		}
	}
}

// scans src (and extra files) for imports from target lib and returns the export names
async function getUsedExports(lib, extraFiles = new Set()) {
	// get runtime exports
	const { metafile } = await esbuild({
		stdin: { contents: `export * from "${lib}"`, resolveDir: srcDir },
		bundle: true,
		write: false,
		format: "esm",
		platform: "browser",
		metafile: true
	})
	const exports = new Set(Object.values(metafile.outputs)[0].exports)

	const escapedLib = lib.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	const s = `\\s*`
	const fromLib = `${s}from${s}["']${escapedLib}["']`
	const namedRegex = new RegExp(`import${s}\\{([^}]+)\\}${fromLib}`, "g") // import {}
	const defaultRegex = new RegExp(`import\\s+\\w+${s}(?:,${s}\\{[^}]*\\})?${fromLib}`) // import x | import x, {}
	const namespaceRegex = new RegExp(`import${s}\\*${s}as\\s+\\w+${fromLib}`) // import * as x

	const names = new Set()

	const scanFile = async (filePath, displayName) => {
		const contents = await readFile(filePath, "utf8")

		if (namespaceRegex.test(contents) || defaultRegex.test(contents))
			throw `default/* ${lib} import in ${displayName} not allowed`

		for (const [, imports] of contents.matchAll(namedRegex))
			for (const name of imports.split(",").map(s => s.trim().split(/\s+as\s+/)[0]))
				if (name == "default")
					throw `"default as" ${lib} import in ${displayName} not allowed`
				else if (exports.has(name))
					names.add(name)
	}

	for (const file of await readdir(srcDir, { withFileTypes: true, recursive: true })) {
		if (!file.isFile() || !/\.(js|ts)$/.test(file.name))
			continue
		await scanFile(pathM.join(file.path, file.name), file.name)
	}

	for (const path of extraFiles) {
		if (!/\.(js|ts|mjs|cjs)$/.test(path))
			continue
		await scanFile(path, pathM.relative(process.cwd(), path))
	}

	return [...names].sort()
}

async function generateSwContent() {
	const manuals = ["/", "https://dt.tmp.bz/p?https://pub.drednot.io/test/econ/item_schema.json"]

	const patterns = [
		{ path: "/", exclude: "assets lib sw.ts", recursive: false, folders: true },
		{ path: "/assets/", exclude: "changelog/", recursive: true },
		{ path: "/img2pixar/", recursive: true },
		{ path: "/bpbin/", recursive: false },
		{ path: "/bptools/", recursive: true },
		{ path: "/bpeditor/", recursive: true },
		{ path: "/lib/", recursive: true }
	]

	const paths = []
	for (const pattern of patterns) {
		const exclude = pattern.exclude ? pattern.exclude.split(" ") : null
		for (const file of
			await readdir(pathM.join(outDir, pattern.path), { withFileTypes: true, recursive: pattern.recursive, encoding: "utf8" }).catch(() => { }) ?? []
		) {
			if (!pattern.folders && !file.isFile())
				continue
			const name = file.name
			const path = pathM.relative(outDir, file.path).split(pathM.sep).join("/")
			const basePath = pattern.path.slice(1)
			const fullPath = (path ? path + "/" : "") + name
			if (name == "index.html" || name.endsWith(".ejs") || name.endsWith(".map")
				|| exclude?.some(x =>
					x.endsWith("/")
						? fullPath.startsWith(basePath + x)
						: x == name
				)
			)
				continue
			paths.push({ parent: (path != "" ? path + "/" : ""), file: name })
		}
	}

	const merged = {}
	paths.forEach(({ parent, file }) =>
		(merged[parent] ??= []).push(file)
	)

	const content = Object.entries(merged).map(([parent, files]) =>
		(files.length > 2)
			? `...["${files.join(`","`)}"]${parent != "" ? `.map(f=>"${parent}"+f)` : ""}`
			: `"${files.map(f => parent + f).join(`", "`)}"`
	)

	return (await readFile(`${srcDir}sw.ts`, "utf8")).replace(
		/(?<=\/\*@build_cacheUrls>\*\/)(.*?)(?=\/\*@build_cacheUrls<\*\/)/,
		`"${manuals.join(`","`)}",` + content
	)
}

function resolvePackagesPl() {
	return {
		name: "resolvePackages",
		/** @param {import("esbuild").PluginBuild} build */
		setup(build) {
			// filter out non-external imports
			build.onResolve({ filter: /.*/ }, async ({ kind, path, resolveDir, external, importer }) => {
				if (path.startsWith("data:") || kind == "url-token")
					return { path, external: true }

				if (
					(kind == "import-statement" || kind == "dynamic-import")
					&& /^\.?\/|^\.\.?/.test(path)
					&& (resolveDir.includes(`${pathM.sep}src${pathM.sep}`) || resolveDir.endsWith(`${pathM.sep}src`))
				)
					return { path, external: true }

				// if a package is importing one of its own files (relative path), or importing something from keepBundled,
				// keep it bundled/inlined - anything else is split into shared files in /lib/
				const shouldKeepBundled = keepBundled.some(p =>
					p.endsWith("/")
						? path.startsWith(p)
						: path == p || path.replace(/\.js$/, "") == p.replace(/\.js$/, "")
				)
				if (external || kind == "entry-point" || (importer.includes("node_modules") && (/^\.\.?\//.test(path) || shouldKeepBundled)))
					return

				// collect the import name, and edit the import path
				if (!treeShakenLibs.includes(path))
					externals.add(path)
				return {
					path: pathM.posix.join(libDir, path + (path.endsWith(".js") ? "" : ".js")),
					external: true
				}
			})
		}
	}
}

// shortened https://gist.github.com/ycmjason/370f9a476648b0a8ce6130e1cb0c2893
async function asyncReplace(str, regex, replacer) {
	const substrs = []
	let i = 0, match
	for (; (match = regex.exec(str)); i = regex.lastIndex)
		substrs.push(str.slice(i, match.index), await replacer(...match))
	return substrs.join("") + str.slice(i)
}

function minifyHtmlPl() {
	const regexHtmlTemplate = /\/\*html\*\/`([\s\S]+?)(?:(?<=^|>|\t)`|`(?=,|]))/gm
	return {
		name: "minifyHtml",
		/** @param {import("esbuild").PluginBuild} build */
		setup(build) {
			build.onLoad({ filter: /\.(html|ejs|js|ts)$/ }, async ({ path }) => {
				let contents = await readFile(path, "utf8")

				if (!watch) {
					if (path.endsWith(".ts") || path.endsWith(".js"))
						contents = await asyncReplace(contents, regexHtmlTemplate,
							async (match, html) => "`" + await minifyHtml(html, htmlOptions) + "`"
						)
					else
						contents = await minifyHtml(contents, htmlOptions)
				}

				return { contents, loader: "default" }
			})
		}
	}
}

/**
 * bundles and puts externals into outLibDir recursively, supporting nested externals
 * @returns set of source file paths that got bundled
 * @param {import("esbuild").BuildResult} result
 */
async function bundleExternals(result) {
	const built = new Set()
	const srcPaths = new Set()
	while (externals.size) {
		const entryPoints = Array.from(externals).filter(p => !built.has(p))
		externals.clear()
		entryPoints.forEach(p => built.add(p))
		const libResult = await esbuild({
			entryPoints: entryPoints.map(p => ({ in: p, out: p.replace(/\.js$/, "") })),
			outdir: outLibDir,
			plugins: [resolvePackagesPl()],
			metafile: true, // needed to know which real files got bundled in
			...commonBuildOptions
		})
		result.errors.push(...libResult.errors)
		result.warnings.push(...libResult.warnings)

		for (const input of Object.keys(libResult.metafile.inputs))
			srcPaths.add(pathM.resolve(input))
	}
	return srcPaths
}

function buildWithLogsPl() {
	return {
		name: "buildLogs",
		/** @param {import("esbuild").PluginBuild} build */
		setup(build) {
			build.onEnd(async result => {
				const libSrcFilePaths = await bundleExternals(result)

				for (const lib of treeShakenLibs) {
					const libResult = await esbuild({
						stdin: {
							contents: watch
								? `export * from '${lib}'`
								// re-export only actually used exports, scanning src
								// and libSrcFilePaths so e.g. pixi-viewport's imports from pixi.js are included
								: `export{${(await getUsedExports(lib, libSrcFilePaths)).join(",")}}from'${lib}'`,
							resolveDir: srcDir
						},
						outfile: pathM.join(outLibDir, lib.endsWith(".js") ? lib : lib + ".js"),
						...commonBuildOptions
					})
					result.errors.push(...libResult.errors)
					result.warnings.push(...libResult.warnings)
				}

				const swResult = await esbuild({
					stdin: { contents: await generateSwContent(), loader: "ts" },
					outfile: pathM.join(outDir, "sw.js"),
					...commonBuildOptions
				})

				result.errors.push(...swResult.errors)
				result.warnings.push(...swResult.warnings)

				if (watch) {
					if (result.errors.length)
						await formatMessages(result.errors, { kind: "error", color: true }).then(strings => console.error(strings.join("\n").trim()))
					if (result.warnings.length)
						await formatMessages(result.warnings, { kind: "warning", color: true }).then(strings => console.warn(strings.join("\n").trim()))
				}

				await generateChangelog()

				console.info(time(), (watch ? "[watch] " : "")
					+ `${result.errors.length ? "\x1b[31mBUILD FAILED" : "\x1b[32mBuilt"}\x1b[0m with`
					+ ` ${result.warnings.length} warnings${result.errors.length ? ` ${result.errors.length} errors` : ""}`)
			})
		}
	}
}

function mdToHtmlPl() {
	const name = "mdToHtml"
	return {
		name,
		/** @param {import("esbuild").PluginBuild} build */
		setup(build) {
			const outPaths = []
			build.onStart(() => { outPaths.length = 0 })
			build.onLoad({ filter: /\.html\.md$/ }, async ({ path }) => {
				outPaths.push(pathM.join(outDir, pathM.relative(srcDir, path)))
				const html = DOMPurify.sanitize(await marked(await readFile(path, "utf8")))
				const contents = watch ? html : await minifyHtml(html, htmlOptions)
				return { contents, loader: "default" }
			})
			build.onEnd(async result => {
				if (!result.errors.length)
					for (const path of outPaths)
						await rename(path, path.replace(/\.md$/, ""))
			})
		}
	}
}

function time() {
	return new Date().toLocaleTimeString()
}

/* changelog */
const CHANGELOG_HTML = /*html*/`<!DOCTYPE html><html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Changelog</title>
	<link rel="stylesheet" href="/main.css">
</head>
<body style="background: unset;">
	<div class="container-grid"><!--entries--></div>
	<script>
		for (const el of document.querySelectorAll("time"))
			el.textContent = new Date(el.getAttribute("datetime")).toLocaleDateString()
	</script>
</body>
</html>`

async function generateChangelog() {
	let firstDate
	const entries = []
	for (let section of
		(await readFile("../changelog.md", "utf8"))
			.split(/^---\s*$/m).map(s => s.trim())
	) {
		let date = null
		// extract date and remove it
		section = section.replace(/(\d{4}-\d{2}-\d{2})/, (_, d) => {
			return date = d, ""
		})
		if (date) firstDate ??= date

		// convert remaining dates
		section = section.replace(/\d{4}-\d{2}-\d{2}/g, d => `<time datetime="${d}"></time>`)

		// append date into heading or create one
		const lines = section.split(/\r?\n/)
		const firstLine = lines[0]?.trim()
		if (firstLine?.match(/^(#{1,6})\s+/))
			lines[0] = firstLine + ` (<time datetime="${date}"></time>)`
		else
			lines.unshift(`### <time datetime="${date}"></time>`)

		entries.push(DOMPurify.sanitize(
			marked.parse(lines.join("\n").trim())

		).replaceAll("<a href", "<a target=\"_blank\" href"))
	}

	await writeFile(pathM.join(outDir, "changelog.html"),
		`<!--${firstDate}-->` + CHANGELOG_HTML.replace("<!--entries-->",
			entries.map(html => `<div class="card">${html}</div>`).join("\n")
		)
	)
}

//
if (watch) {
	console.info(time(), "watching for changes\n")
	await srcCtx.watch()
	let changelogTimer
	fsWatch("../changelog.md", () => {
		clearTimeout(changelogTimer)
		changelogTimer = setTimeout(() => srcCtx.rebuild(), 100)
	})
} else {
	await srcCtx.rebuild()
	process.exit(0)
}
