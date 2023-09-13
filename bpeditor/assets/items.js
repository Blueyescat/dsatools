const items = {1:"Iron",2:"Explosives",4:"Hyper Rubber",5:"Flux Crystals",6:"Thruster Fuel",50:"Scrap Metal",51:"Volleyball",52:"Golden Volleyball",53:"Basketball",54:"Golden Basketball",55:"Beach Ball",56:"Football",100:"Wrench",101:"Item Shredder",102:"Golden Item Shredder",103:"Repair Tool",104:"Handheld Pusher",105:"Ship Shield Booster",106:"Ship Embiggener",107:"Ship Shrinkinator",108:"Backpack",109:"Speed Skates",110:"Booster Boots",111:"Launcher Gauntlets",112:"Construction Gauntlets",113:"Rocket Pack",114:"Hover Pack",115:"Manifest Scanner",116:"BoM Scanner",117:"Starter Wrench",118:"Starter Shredder",119:"Hand Cannon",120:"Blueprint Scanner",121:["Sandbox RCD",2],122:["Flux RCD",2],123:"Shield Core",150:"Standard Ammo",151:"ScatterShot Ammo",152:"Flak Ammo",153:"Sniper Ammo",154:"Punch Ammo",155:"Yank Ammo",156:"Slug Ammo",157:"Trash Ammo",159:"Booster Fuel (Low Grade)",160:"Booster Fuel (High Grade)",161:"Void Orb",162:"Turret Booster - Rapid Fire",163:"Turret Booster - Rapid Fire (Depleted)",164:"Turret Booster - Preservation",165:"Turret Booster - Preservation (Depleted)",215:["Helm",2],216:["Helm (Starter)",2],217:["Comms Station",2],218:["Sign",0],219:["Spawn Point",2],220:["Door",2],221:["Cargo Hatch",0],222:["Cargo Hatch (Starter)",0],223:["Cargo Ejector",2,0],224:["Turret Controller (Basic)",2,0],226:["RC Turret",2,0],227:["RC Turret (Starter)",2,0],228:["Burst Turret",2,0],229:["Auto Turret",2,0],230:["Thruster",2,0],231:["Thruster (Starter)",0,0],232:["Iron Block",1],233:["Hyper Rubber Block",1],234:["Hyper Ice Block",1],235:["Ladder",1],236:["Walkway",1],237:["Item Net",1],239:["Paint",0],240:["Expando Box (Basic)",2],241:["Safety Anchor",2],242:["Pusher",0],243:["Item Launcher",0],244:"DEPRECATED ITEM",245:["Recycler",2],246:["Fabricator (Legacy)",2],247:["Fabricator (Starter)",2],248:["Fabricator (Munitions)",2],249:["Fabricator (Engineering)",2],250:["Fabricator (Machine)",2],251:["Fabricator (Equipment)",2],252:["Loader",0],253:["Lockdown Override Unit",0],254:["Annihilator Tile",1],255:["Fluid Tank",2],256:["Shield Generator",2],257:["Shield Projector",0],258:["Enhanced Turret Controller",0],259:["Bulk Ejector",2],260:["Bulk Loading Bay Designator",0],261:["Navigation Unit (Starter)",0],300:"Eternal Bronze Wrench",301:"Eternal Silver Wrench",302:"Eternal Gold Wrench",303:"Eternal Flux Wrench",304:"Eternal Platinum Wrench",305:"Gold Null Trophy",306:"Bug Hunter Trophy",307:"Silver Null Trophy",308:"Bronze Wrench",309:"Silver Wrench",310:"Gold Wrench",311:"Platinum Wrench",312:"Flux Wrench",313:"Lesser Cap",314:"Goofy Glasses",315:"Shades",316:"Top Hat",317:"Demon Horns",318:"Alien Mask",319:"Clown Mask",320:"Goblin Mask",321:"Pumpkin",322:"Witch Hat",323:"Wild Gremlin (Red)",324:"Wild Gremlin (Orange)",325:"Wild Gremlin (Yellow)"}
export default {
	get ids() { return Object.keys(items) },
	/** @returns {string} */
	getName(id) { return Array.isArray(items[id]) ? items[id][0] : items[id] },
	isPlaceable(id) { return Array.isArray(items[id]) && items[id][1] >= 0 },
	isSmallMac(id) { return Array.isArray(items[id]) && items[id][1] == 0 },
	isBlock(id) { return Array.isArray(items[id]) && items[id][1] == 1 },
	isBigMac(id) { return Array.isArray(items[id]) && items[id][1] == 2 },
	isHull(id) { return Array.isArray(items[id]) && items[id][2] == 0 },
}