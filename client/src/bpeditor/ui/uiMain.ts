import { EditorMap } from "../EditorMap.js"

import { initBpStr } from "./win-man/bpStr.js"
import { initBuildOrder } from "./win-man/buildOrder.js"
import { initCollabMenu } from "./win-man/collabMenu.js"
import { initExportImage } from "./win-man/exportImage.js"
import { initFindReplace } from "./win-man/findReplace.js"
import { initItemMatList } from "./win-man/itemMatList.js"
import { initPusherFocuser } from "./win-man/pusherFocuser.js"
import { initWelcome } from "./win-man/welcome.js"
import { initHotbar } from "./hotbar.js"

type Manager<T extends (a: any) => any> = Awaited<ReturnType<T>>

let editorMap: EditorMap

const winMan = {} as {
	welcome: Manager<typeof initWelcome>,
	bpStr: Manager<typeof initBpStr>,
	itemMatList: Manager<typeof initItemMatList>,
	findReplace: Manager<typeof initFindReplace>,
	buildOrder: Manager<typeof initBuildOrder>,
}

function setEditorMap(to: EditorMap) {
	editorMap = to
}

function initUI() {
	winMan.welcome = initWelcome()
	winMan.bpStr = initBpStr()
	winMan.itemMatList = initItemMatList()
	winMan.findReplace = initFindReplace()
	winMan.buildOrder = initBuildOrder()
	initPusherFocuser()
	initCollabMenu()
	initExportImage()
	initHotbar()
}

import("./menuBar.js").then(() =>
	import("/assets/autoInputSave.js")
)

export { editorMap, initUI, setEditorMap, winMan }

