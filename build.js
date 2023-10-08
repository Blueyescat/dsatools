import { context, build as esbuild } from "esbuild"
import { readFile, readdir, rm } from "fs/promises"
import { minify as minifyHtml } from "html-minifier-terser"
import path from "path"

const watch = process.argv.includes("-w")
const entry = "./src/**"
const outDir = "./dist/"
const libDir = "/lib/"
const outLibDir = outDir.slice(0, -1) + libDir

const externals = new Set(["zoomist/css"])

console.info(time(), "cleaning")
for (const file of await readdir(outDir).catch(() => { }) ?? [])
	await rm(path.join(outDir, file), { recursive: true })

const srcCtx = await context({
	packages: "external",
	entryPoints: [entry],
	loader: {
		".css": "copy", // no sourcemap
		".webmanifest": "copy",
		".json": "copy",
		".html": "copy",
		".ejs": "copy",
		".woff": "copy",
		".png": "copy",
		".webp": "copy",
	},
	outdir: outDir,
	target: "es2022",
	format: "esm",
	platform: "browser",
	bundle: true,
	minify: true,
	sourcemap: true,
	plugins: [resolvePackagesPl(), minifyHtmlPl(), buildLogsPl()]
})

if (watch) {
	console.info(time(), "watching for changes\n")
	await srcCtx.watch()
} else {
	await srcCtx.rebuild()
	process.exit(0)
}

//

function resolvePackagesPl() {
	return {
		name: "resolvePackages",
		setup(build) {
			// filter out non-module imports
			build.onResolve({ filter: /^[^./]|^[^.][^.]?$/ }, async args => {
				if (args.external || !args.kind.includes("import") || /\.\w*$/.test(args.path))
					return
				// collect the import name and edit in the import statement
				externals.add(args.path)
				return {
					path: libDir + args.path + ".js",
					external: true
				}
			})
		}
	}
}

function minifyHtmlPl() {
	return {
		name: "minifyHtml",
		setup(build) {
			build.onLoad({ filter: /\.(html|ejs)$/ }, async args => {
				let contents = await readFile(args.path, "utf8")
				contents = await minifyHtml(contents, {
					collapseWhitespace: true,
					conservativeCollapse: true,
					preserveLineBreaks: true,
					collapseBooleanAttributes: true,
					minifyCSS: true,
					minifyJS: { module: true },
					quoteCharacter: "\"",
					removeComments: true,
					removeRedundantAttributes: true,
					sortAttributes: true,
					sortClassName: true
				})
				return { contents, loader: "default" }
			})
		}
	}
}

function buildLogsPl() {
	return {
		name: "buildLogs",
		setup(build) {
			build.onEnd(async result => {
				// put dist files of externals into outLibDir
				const libResult = await esbuild({
					entryPoints: Array.from(externals),
					outdir: outLibDir,
					target: "es2022",
					format: "esm",
					platform: "browser"
				})
				const warns = result.warnings.length + libResult.warnings.length
				const errs = result.errors.length + libResult.errors.length
				console.info(time(), (watch ? "[watch] " : "")
					+ `${errs ? "build failed" : "built"} with`
					+ ` ${warns} warnings ${errs} errors`)
			})
		}
	}
}

function time() {
	return new Date().toISOString().substring(14, 23)
}
