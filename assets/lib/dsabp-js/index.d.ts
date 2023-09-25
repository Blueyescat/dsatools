export declare abstract class BPCmd {
	/**
	 * @returns A new instance with the same properties. (Deep clone)
	 */
	abstract clone(): any;
	/** @private */
	abstract toArray(): any[];
}
/**
 * Used to specify repeated placements along the X+ axis in a single build command.
 * `101` = place 2 objects with a space between. Cannot exceed 64 bits.
 */
export declare class BuildBits {
	/** @private */
	int: bigint;
	/**
	 * @param input Use to initialize the bits by entering a binary string like `"11001"`.
	 *  Left to right. Trailing zeros are ignored.
	 * @throws SyntaxError if input string cannot be converted to a BigInt.
	 */
	constructor(input?: string | number | bigint);
	/**
	 * Sets a bit at an index (makes it `1`).
	 * @throws RangeError if the index is out of [0,63].
	 */
	set(index: number): this;
	/**
	 * Clears a bit at an index (makes it `0`).
	 * @throws RangeError if the index is out of [0,63].
	 */
	clear(index: number): this;
	/**
	 * Toggles a bit at an index.
	 * @param force If specified, it works as a shortcut for {@link set} (true) and {@link clear} (false).
	 * @throws RangeError if the index is out of [0,63].
	 */
	toggle(index: number, force?: boolean): this;
	/** Checks whether a bit at an index is set. */
	isSet(index: number): boolean;
	/** Checks whether no bit is set. */
	isZero(): boolean;
	/**
	 * Checks whether there is only one bit and it is set to `1`, which is likely
	 * just so that a shape can be specified in the encoded data.
	 */
	isOne(): boolean;
	/**
	 * Removes leading zero bits. (Note that trailing zeros don't work anyway)
	 * @example
	 * const bits = new BuildBits("10100") // 101
	 * bits.del(0) // 001
	 * bits.trimLeadZeros() // 1
	 */
	trimLeadZeros(): this;
	/** @returns Amount of all the bits. */
	get size(): number;
	[Symbol.iterator](): Iterator<boolean>;
	/** @returns Booleans representing the set and unset bits. */
	toArray(): boolean[];
	/** @returns A string of 1's and 0's representing the set and unset bits. */
	toString(): string;
	/** @hidden */
	get [Symbol.toStringTag](): string;
	/** Checks whether this bits equals to another. */
	equals(target: BuildBits): boolean;
	/** @returns A new instance with the same bits. */
	clone(): BuildBits;
}
export interface C<T> {
	new (...args: any[]): T;
	maps: any;
	getMap: any;
	getReverseMap: any;
}
/**
 * An alternative to TS Enums. Simple, efficient, and compatible with IntelliSense.
 *
 * An enum constant is an instance of the derived class. References to instances are stored in maps for fast lookups.
 * The derived class can add static or non-static members to store more data or to have more methods on the enum.
 * A constant must have a "main value" (enumValue) that can be anything (preferably a primitive) and is used with the reverse mapping.
 * Easy to add NoReverseEnum and NoValueEnum if ever needed.
 */
/** @hidden */
export declare class Enum<V> {
	/** @hidden */
	static readonly maps: Map<string, [
		Map<string, Enum<any>>,
		Map<any, string>
	]>;
	/**
	 * Enum names to constant instances.
	 *
	 * Can be used to get the names and values of all constants in this enum.
	 */
	static getMap<CT>(this: C<CT>): Map<string, CT>;
	/** Enum values to names. */
	static getReverseMap<CT extends {
		enumValue: any;
	}>(this: C<CT>): Map<CT["enumValue"], string>;
	/**
	 * Returns a constant with the specified name, or undefined if not found. (Case-sensitive)
	 *
	 * Shortcut to using {@link getMap}.
	 */
	static getByName<CT>(this: C<CT>, name: string): CT | undefined;
	/**
	 * Returns a constant with the specified value, or undefined if not found.
	 *
	 * Shortcut to using {@link getReverseMap} and {@link getMap}.
	 */
	static getByValue<CT extends {
		enumValue: any;
	}>(this: C<CT>, value: CT["enumValue"]): CT | undefined;
	/** @hidden */
	static end(): void;
	constructor(value: V);
	/** The name of the constant, i.e. the member name. */
	enumName: string;
	/** The value of the constant. */
	enumValue: V;
	/** @returns "Enum.MEMBER" */
	toString(): string;
}
/**
 * The item names, IDs and data are taken directly from the game source.
 *
 * The item data may be unstable because it is not edited or checked, including the
 * property names. If you use it, it is up to you to test it and handle the game changes.
 * The major version won't be incremented for any breaking changes to it.
 *
 * <small>Generated using test.drednot.io version: `Fri Sep 22 17:00:10 MDT 2023 / 4c521f8`</small>
 */
export declare class Item extends Enum<number> {
	readonly name: string;
	readonly description: string;
	readonly stackable: boolean;
	readonly rarity: number;
	readonly image?: string;
	/**
	 * Each object in this array represents build info with different rotations, usually 1 or 2.
	 *
	 * The object will have a `buildDirection` property, except when there is only 1 build info.
	 */
	readonly buildInfo?: Array<Partial<{
		bounds: {
			x: number;
			y: number;
		};
		shape: {
			verts: {
				x: number;
				y: number;
			}[];
		};
		allow_non_solids: boolean;
		image: string;
		image_only: boolean;
		snap_y: boolean;
		offset: {
			x: number;
			y: number;
		};
		require_blocks: {
			x: number;
			y: number;
			block: "_BUILD_SURFACE" | "AIR" | "HULL_CORNER" | "HULL_H" | "HULL_V" | "INTERIOR_BLOCK" | "LADDER" | "WALKWAY" | "ITEM_NET" | "RAMP_1" | "RAMP_2" | "RAMP_3" | "RAMP_4" | "COLOR_PANEL" | "HYPER_RUBBER" | "ICE_GLASS" | "ANNIHILATOR";
		}[];
		allow_solids: boolean;
		snap_x: boolean;
		buildDirection: "HORIZONTAL" | "VERTICAL";
		allow_world: boolean;
		block: number;
		block_shaped: boolean;
		block_is_colored: boolean;
		allow_any: boolean;
		build_angle: "Any" | "Fixed";
		is_lockdown_override: boolean;
		offset2: {
			x: number;
			y: number;
		};
	}>>;
	readonly blacklist_autobuild?: boolean;
	readonly fab_type?: "Legacy" | "Starter" | "Munitions" | "Engineering" | "Machine" | "Equipment";
	constructor(id: any, name: any, description: any, stackable: any, rarity: any, image?: any, buildInfo?: any, blacklist_autobuild?: any, fab_type?: any);
	/** The value of the constant (in this case, the ID of the item). */
	enumValue: number;
	/** The ID of the item. Alias to {@link enumValue}. */
	get id(): number;
	get isBuildable(): boolean;
	get isBlock(): boolean;
	/** Returns an {@link Item} with the specified ID, or undefined if not found. Alias to {@link Item.getByValue | getByValue}. */
	static getById(id: number): Item;
	static NULL: Item;
	/**Iron*/
	static RES_METAL: Item;
	/**Explosives*/
	static RES_GUNPOWDER: Item;
	/**Hyper Rubber*/
	static RES_HYPER_RUBBER: Item;
	/**Flux Crystals*/
	static RES_FLUX: Item;
	/**Thruster Fuel*/
	static RES_FUEL: Item;
	/**Scrap Metal*/
	static SCRAP_METAL: Item;
	/**Volleyball*/
	static BALL_VOLLEY: Item;
	/**Golden Volleyball*/
	static BALL_VOLLEY_GOLD: Item;
	/**Basketball*/
	static BALL_BASKET: Item;
	/**Golden Basketball*/
	static BALL_BASKET_GOLD: Item;
	/**Beach Ball*/
	static BALL_BEACH: Item;
	/**Football*/
	static BALL_SOCCER: Item;
	/**Wrench*/
	static WRENCH: Item;
	/**Item Shredder*/
	static SHREDDER: Item;
	/**Golden Item Shredder*/
	static SHREDDER_GOLD: Item;
	/**Repair Tool*/
	static REPAIR_TOOL: Item;
	/**Handheld Pusher*/
	static HAND_PUSHER: Item;
	/**Ship Shield Booster*/
	static SHIELD_BOOSTER: Item;
	/**Ship Embiggener*/
	static SHIP_EMBIGGENER: Item;
	/**Ship Shrinkinator*/
	static SHIP_SHRINKINATOR: Item;
	/**Backpack*/
	static EQUIPMENT_BACKPACK: Item;
	/**Speed Skates*/
	static EQUIPMENT_SPEED_SKATES: Item;
	/**Booster Boots*/
	static EQUIPMENT_BOOSTER_BOOTS: Item;
	/**Launcher Gauntlets*/
	static EQUIPMENT_LAUNCHER_GAUNTLETS: Item;
	/**Construction Gauntlets*/
	static EQUIPMENT_CONSTRUCTION_GAUNTLETS: Item;
	/**Rocket Pack*/
	static EQUIPMENT_ROCKET_PACK: Item;
	/**Hover Pack*/
	static EQUIPMENT_HOVER_PACK: Item;
	/**Manifest Scanner*/
	static SCANNER_MANIFEST: Item;
	/**BoM Scanner*/
	static SCANNER_BOM: Item;
	/**Starter Wrench*/
	static WRENCH_STARTER: Item;
	/**Starter Shredder*/
	static SHREDDER_STARTER: Item;
	/**Hand Cannon*/
	static HAND_CANNON: Item;
	/**Blueprint Scanner*/
	static SCANNER_BLUEPRINT: Item;
	/**Sandbox RCD*/
	static RCD_SANDBOX: Item;
	/**Flux RCD*/
	static RCD_FLUX: Item;
	/**Shield Core*/
	static SHIELD_CORE: Item;
	/**Standard Ammo*/
	static AMMO_STANDARD: Item;
	/**ScatterShot Ammo*/
	static AMMO_SCATTER: Item;
	/**Flak Ammo*/
	static AMMO_FLAK: Item;
	/**Sniper Ammo*/
	static AMMO_SNIPER: Item;
	/**Punch Ammo*/
	static AMMO_PUNCH: Item;
	/**Yank Ammo*/
	static AMMO_YANK: Item;
	/**Slug Ammo*/
	static AMMO_SLUG: Item;
	/**Trash Ammo*/
	static AMMO_TRASH: Item;
	/**Booster Fuel (Low Grade)*/
	static FUEL_BOOSTER_LOW: Item;
	/**Booster Fuel (High Grade)*/
	static FUEL_BOOSTER_HIGH: Item;
	/**Void Orb*/
	static VOID_ORB: Item;
	/**Turret Booster - Rapid Fire*/
	static TURRET_BOOSTER_RAPID: Item;
	/**Turret Booster - Rapid Fire (Depleted)*/
	static TURRET_BOOSTER_RAPID_USED: Item;
	/**Turret Booster - Preservation*/
	static TURRET_BOOSTER_PRESERVATION: Item;
	/**Turret Booster - Preservation (Depleted)*/
	static TURRET_BOOSTER_PRESERVATION_USED: Item;
	/**Helm (Packaged)*/
	static HELM: Item;
	/**Helm (Starter, Packaged)*/
	static HELM_STARTER: Item;
	/**Comms Station (Packaged)*/
	static COMMS_STATION: Item;
	/**Sign (Packaged)*/
	static SIGN: Item;
	/**Spawn Point (Packaged)*/
	static SPAWN_POINT: Item;
	/**Door (Packaged)*/
	static DOOR: Item;
	/**Cargo Hatch (Packaged)*/
	static ITEM_HATCH: Item;
	/**Cargo Hatch (Starter, Packaged)*/
	static ITEM_HATCH_STARTER: Item;
	/**Cargo Ejector (Packaged)*/
	static ITEM_EJECTOR: Item;
	/**Turret Controller (Packaged)*/
	static TURRET_CONTROLLER: Item;
	/**RC Turret (Packaged)*/
	static TURRET_REMOTE: Item;
	/**RC Turret (Starter, Packaged)*/
	static TURRET_REMOTE_STARTER: Item;
	/**Burst Turret (Packaged)*/
	static TURRET_BURST: Item;
	/**Auto Turret (Packaged)*/
	static TURRET_AUTO: Item;
	/**Thruster (Packaged)*/
	static THRUSTER: Item;
	/**Thruster (Starter, Packaged)*/
	static THRUSTER_STARTER: Item;
	/**Iron Block*/
	static BLOCK: Item;
	/**Hyper Rubber Block*/
	static BLOCK_HYPER_RUBBER: Item;
	/**Hyper Ice Block*/
	static BLOCK_ICE_GLASS: Item;
	/**Ladder*/
	static BLOCK_LADDER: Item;
	/**Walkway*/
	static BLOCK_WALKWAY: Item;
	/**Item Net*/
	static BLOCK_ITEM_NET: Item;
	/**Paint*/
	static PAINT: Item;
	/**Expando Box (Packaged)*/
	static EXPANDO_BOX: Item;
	/**Safety Anchor*/
	static FREEPORT_ANCHOR: Item;
	/**Pusher (Packaged)*/
	static PUSHER: Item;
	/**Item Launcher (Packaged)*/
	static ITEM_LAUNCHER: Item;
	/**DEPRECATED ITEM*/
	static LOADER: Item;
	/**Recycler (Packaged)*/
	static RECYCLER: Item;
	/**Fabricator (Legacy, Packaged)*/
	static FABRICATOR_GOLD: Item;
	/**Fabricator (Starter, Packaged)*/
	static FABRICATOR_STARTER: Item;
	/**Fabricator (Munitions, Packaged)*/
	static FABRICATOR_MUNITIONS: Item;
	/**Fabricator (Engineering, Packaged)*/
	static FABRICATOR_ENGINEERING: Item;
	/**Fabricator (Machine, Packaged)*/
	static FABRICATOR_MACHINE: Item;
	/**Fabricator (Equipment, Packaged)*/
	static FABRICATOR_EQUIPMENT: Item;
	/**Loader (Packaged)*/
	static LOADER_NEW: Item;
	/**Lockdown Override Unit*/
	static LOCKDOWN_OVERRIDE_GREEN: Item;
	/**Annihilator Tile*/
	static BLOCK_ANNIHILATOR: Item;
	/**Fluid Tank*/
	static FLUID_TANK: Item;
	/**Shield Generator*/
	static SHIELD_GENERATOR: Item;
	/**Shield Projector*/
	static SHIELD_PROJECTOR: Item;
	/**Enhanced Turret Controller*/
	static TURRET_CONTROLLER_NEW: Item;
	/**Bulk Ejector (Packaged)*/
	static BULK_EJECTOR: Item;
	/**Bulk Loading Bay Designator (Packaged)*/
	static BULK_BAY_MARKER: Item;
	/**Navigation Unit (Starter, Packaged)*/
	static NAV_UNIT: Item;
	/**Eternal Bronze Wrench*/
	static ETERNAL_WRENCH_BRONZE: Item;
	/**Eternal Silver Wrench*/
	static ETERNAL_WRENCH_SILVER: Item;
	/**Eternal Gold Wrench*/
	static ETERNAL_WRENCH_GOLD: Item;
	/**Eternal Flux Wrench*/
	static ETERNAL_WRENCH_FLUX: Item;
	/**Eternal Platinum Wrench*/
	static ETERNAL_WRENCH_PLATINUM: Item;
	/**Gold Null Trophy*/
	static TROPHY_NULL: Item;
	/**Bug Hunter Trophy*/
	static TROPHY_BUG_HUNTER: Item;
	/**Silver Null Trophy*/
	static TROPHY_NULL_SILVER: Item;
	/**Bronze Wrench*/
	static PAT_WRENCH_BRONZE: Item;
	/**Silver Wrench*/
	static PAT_WRENCH_SILVER: Item;
	/**Gold Wrench*/
	static PAT_WRENCH_GOLD: Item;
	/**Platinum Wrench*/
	static PAT_WRENCH_PLATINUM: Item;
	/**Flux Wrench*/
	static PAT_WRENCH_FLUX: Item;
	/**Lesser Cap*/
	static COS_LESSER_CAP: Item;
	/**Goofy Glasses*/
	static COS_GOOFY_GLASSES: Item;
	/**Shades*/
	static COS_SHADES: Item;
	/**Top Hat*/
	static COS_TOP_HAT: Item;
	/**Demon Horns*/
	static COS_HORNS: Item;
	/**Alien Mask*/
	static COS_MASK_ALIEN: Item;
	/**Clown Mask*/
	static COS_MASK_CLOWN: Item;
	/**Goblin Mask*/
	static COS_MASK_GOBLIN: Item;
	/**Pumpkin*/
	static COS_PUMPKIN: Item;
	/**Witch Hat*/
	static COS_WITCH_HAT: Item;
	/**Wild Gremlin (Red)*/
	static GREMLIN_RED: Item;
	/**Wild Gremlin (Orange)*/
	static GREMLIN_ORANGE: Item;
	/**Wild Gremlin (Yellow)*/
	static GREMLIN_YELLOW: Item;
}
/**
 * The shape names and vertices are taken directly from the game source. The names may not be
 * descriptive, but you don't usually need to refer to them by name. Additionally, the constants
 * have a comment that visually represents the shape with braille ascii art, generated from the vertices.
 *
 * The {@link vertices} are sorted to prevent them from overlapping.
 *
 * <small>Generated using test.drednot.io version: `Fri Sep 22 17:00:10 MDT 2023 / 4c521f8`</small>
 */
export declare class Shape extends Enum<number> {
	readonly vertices: {
		x: number;
		y: number;
	}[];
	constructor(v: number, vertices: {
		x: number;
		y: number;
	}[]);
	/**⣿⣿⣿⣿\
	   ⣿⣿⣿⣿*/
	static BLOCK: Shape;
	/**⣷⣄     \
	   ⣿⣿⣷⣄*/
	static RAMP_UR: Shape;
	/**⣿⣿⡿⠋\
	   ⡿⠋    &#8198;*/
	static RAMP_DR: Shape;
	/**⠈⠻⣿⣿\
	 *       ⠈⠻*/
	static RAMP_DL: Shape;
	/**&#8198;    ⢀⣴\
	   ⢀⣴⣿⣿*/
	static RAMP_UL: Shape;
	/**&#8198;        \
	   ⣿⣿⣿⣿*/
	static SLAB_U: Shape;
	/**⣿⣿     \
	   ⣿⣿    &#8198;*/
	static SLAB_R: Shape;
	/**⣿⣿⣿⣿\
	 *          &#8198;*/
	static SLAB_D: Shape;
	/**&#8198;    ⣿⣿\
	 *       ⣿⣿*/
	static SLAB_L: Shape;
	/**&#8198;        \
	   ⣷⣦⣄⡀*/
	static HALF_RAMP_1_U: Shape;
	/**⣿⠏     \
	   ⠏      &#8198;*/
	static HALF_RAMP_1_R: Shape;
	/**⠈⠙⠻⢿\
	 *          &#8198;*/
	static HALF_RAMP_1_D: Shape;
	/**&#8198;      ⣰\
	 *       ⣰⣿*/
	static HALF_RAMP_1_L: Shape;
	/**⣷⣦⣄⡀\
	   ⣿⣿⣿⣿*/
	static HALF_RAMP_2_U: Shape;
	/**⣿⣿⣿⠏\
	   ⣿⣿⠏  &#8198;*/
	static HALF_RAMP_2_R: Shape;
	/**⣿⣿⣿⣿\
	   ⠈⠙⠻⢿*/
	static HALF_RAMP_2_D: Shape;
	/**&#8198;  ⣰⣿⣿\
	   ⣰⣿⣿⣿*/
	static HALF_RAMP_2_L: Shape;
	/**&#8198;        \
	   ⢀⣠⣴⣾*/
	static HALF_RAMP_1_UI: Shape;
	/**⣆       \
	   ⣿⣆    &#8198;*/
	static HALF_RAMP_1_RI: Shape;
	/**⡿⠟⠋⠁\
	 *          &#8198;*/
	static HALF_RAMP_1_DI: Shape;
	/**&#8198;    ⠹⣿\
	 *         ⠹*/
	static HALF_RAMP_1_LI: Shape;
	/**⢀⣠⣴⣾\
	   ⣿⣿⣿⣿*/
	static HALF_RAMP_2_UI: Shape;
	/**⣿⣿⣆   \
	   ⣿⣿⣿⣆*/
	static HALF_RAMP_2_RI: Shape;
	/**⣿⣿⣿⣿\
	   ⡿⠟⠋⠁*/
	static HALF_RAMP_2_DI: Shape;
	/**⠹⣿⣿⣿\
	 *     ⠹⣿⣿*/
	static HALF_RAMP_2_LI: Shape;
	/**⣷⣦⣄⡀\
	 *          &#8198;*/
	static HALF_RAMP_3_U: Shape;
	/**&#8198;    ⣿⠏\
	 *       ⠏  &#8198;*/
	static HALF_RAMP_3_R: Shape;
	/**&#8198;        \
	   ⠈⠙⠻⢿*/
	static HALF_RAMP_3_D: Shape;
	/**&#8198;  ⣰     \
	   ⣰⣿    &#8198;*/
	static HALF_RAMP_3_L: Shape;
	/**⢀⣠⣴⣾\
	 *          &#8198;*/
	static HALF_RAMP_3_UI: Shape;
	/**&#8198;    ⣆   \
	 *       ⣿⣆*/
	static HALF_RAMP_3_RI: Shape;
	/**&#8198;        \
	   ⡿⠟⠋⠁*/
	static HALF_RAMP_3_DI: Shape;
	/**⠹⣿     \
	 *     ⠹    &#8198;*/
	static HALF_RAMP_3_LI: Shape;
	/**&#8198;        \
	   ⣿⣿    &#8198;*/
	static QUARTER_UR: Shape;
	/**⣿⣿     \
	 *          &#8198;*/
	static QUARTER_DR: Shape;
	/**&#8198;    ⣿⣿\
	 *          &#8198;*/
	static QUARTER_DL: Shape;
	/**&#8198;        \
	 *       ⣿⣿*/
	static QUARTER_UL: Shape;
	/**&#8198;        \
	   ⣷⣄    &#8198;*/
	static QUARTER_RAMP_UR: Shape;
	/**⡿⠋     \
	 *          &#8198;*/
	static QUARTER_RAMP_DR: Shape;
	/**&#8198;    ⠙⢿\
	 *          &#8198;*/
	static QUARTER_RAMP_DL: Shape;
	/**&#8198;        \
	 *       ⣠⣾*/
	static QUARTER_RAMP_UL: Shape;
	/**⣿⣿⣷⣄\
	   ⣿⣿⣿⣿*/
	static BEVEL_UR: Shape;
	/**⣿⣿⣿⣿\
	   ⣿⣿⡿⠋*/
	static BEVEL_DR: Shape;
	/**⣿⣿⣿⣿\
	   ⠈⠻⣿⣿*/
	static BEVEL_DL: Shape;
	/**⢀⣴⣿⣿\
	   ⣿⣿⣿⣿*/
	static BEVEL_UL: Shape;
}
export declare const PREFIX = "DSA:";
/** The mode of a pusher config. */
export declare class PusherMode extends Enum<number> {
	static PUSH: PusherMode;
	static PULL: PusherMode;
	static DO_NOTHING: PusherMode;
}
/** The pickup or drop point of a loader config. */
export declare class LoaderPoint extends Enum<number> {
	static TOP_LEFT: LoaderPoint;
	static TOP: LoaderPoint;
	static TOP_RIGHT: LoaderPoint;
	static LEFT: LoaderPoint;
	static RIGHT: LoaderPoint;
	static BOTTOM_LEFT: LoaderPoint;
	static BOTTOM: LoaderPoint;
	static BOTTOM_RIGHT: LoaderPoint;
}
/** The priority of a loader config. */
export declare class LoaderPriority extends Enum<number> {
	static LOW: LoaderPriority;
	static NORMAL: LoaderPriority;
	static HIGH: LoaderPriority;
}
/** The mode of a filter config. */
export declare class FilterMode extends Enum<number> {
	static ALLOW_ALL: FilterMode;
	static BLOCK_FILTER_ONLY: FilterMode;
	static ALLOW_FILTER_ONLY: FilterMode;
	static BLOCK_ALL: FilterMode;
}
export declare class FixedAngle extends Enum<number> {
	static RIGHT: FixedAngle;
	static UP: FixedAngle;
	static LEFT: FixedAngle;
	static DOWN: FixedAngle;
}
export interface DecoderOptions {
	/**
	 * A config command is an array in `[CmdType, null | configMessage]` format.
	 * `null` means that the config command is empty, and the game won't change config of the target object.
	 * `configMessage` contains the config values, and it will be referred to as "config data" in the docs.
	 *
	 * Setting this option to `true` tells the decoder to ignore the config data while decoding a config command, but take the raw data.
	 * The `null` is still read. Whether the config data is not decoded can be checked using {@link ConfigCmd#isRaw | ConfigCmd#isRaw}.
	 *
	 * A {@link Blueprint} containing non-decoded {@link ConfigCmd}s can still be encoded.
	 * The raw data can be decoded individually using the {@link decodeConfigCmd} function, when needed.
	 *
	 * Consider enabling this if you don't need to read all the config commands,
	 * to avoid unnecessary use of resources and decode a little faster.
	 */
	ignoreConfigCmdData?: boolean;
}
/**
 * All the properties can be set, and are required for a valid blueprint.
 */
export interface BlueprintOptions {
	/**
	 * Blueprint format version. 0 by default. At the time of writing, the game only accepts `0` and `-1`
	 * and considers them the same. Any further updates may require changes in the library.
	 * @defaultValue `0`
	 */
	version?: number;
	/**
	 * Width of the blueprint area in square. [1, 100] integer.
	 * @defaultValue `1`
	 */
	width?: number;
	/**
	 * Height of the blueprint area in square. [1, 100] integer.
	 * @defaultValue `1`
	 */
	height?: number;
	/**
	 * All commands of the blueprint.
	 * @example
	 * for (const cmd of bp.commands) {
	 * 	if (cmd instanceof BuildCmd) {
	 * 		console.log(cmd.item.name)
	 * 	}
	 * }
	 * @defaultValue `[]`
	 */
	commands?: Array<BPCmd>;
}
/**
 * All the properties can be set. Set to `undefined` to remove a property. {@link x}, {@link y}, {@link item} are required for a valid command.
 */
export interface BuildCmdOptions {
	/**
	 * X-coord, horizontal offset from the **middle** of the left bottom square of the blueprint area. Can go down to `-0.5`.
	 */
	x?: number;
	/**
	 * Y-coord, vertical offset from the **middle** of left bottom square of the blueprint area. Can go down to `-0.5`.
	 */
	y?: number;
	/** The item to build. See the {@link Item} enum. */
	item?: Item;
	/** A {@link BuildBits} instance. */
	bits?: BuildBits;
	/** Shape of the block to be placed. */
	shape?: Shape;
}
/**
 * All the properties can be set. Set to `undefined` to remove a property, `null` to use {@link ConfigCmd.defaults} during encoding.
 * @example
 * new ConfigCmd() // empty config
 * new ConfigCmd({ loader: null }) // default loader config
 * new ConfigCmd({ loader: { dropPoint: LoaderPoint.BOTTOM } }) // loader config with drop point bottom, rest default
 * cmd.loader.priority = null // change priority of existing loader config to default
 */
export interface ConfigCmdOptions {
	/** What the filter for hatches and loaders should do. */
	filterMode?: FilterMode;
	/**  */
	filterItems?: [
		Item,
		Item,
		Item
	];
	/** Used for expando boxes. [0, 360] float. */
	angle?: number;
	/** Used for shield generators. */
	fixedAngle?: FixedAngle;
	/**  */
	pusher?: PusherConfig;
	/**  */
	loader?: LoaderConfig;
}
/**
 * All the properties can be set. Set to `undefined` to remove a property, `null` to use {@link ConfigCmd.defaults} during encoding.
 */
export interface LoaderConfig {
	/**  */
	pickupPoint?: LoaderPoint;
	/**  */
	dropPoint?: LoaderPoint;
	/**  */
	priority?: LoaderPriority;
	/**  */
	stackLimit?: number;
	/** [20, 1200] float, in ticks. (1200/20 = 60 seconds cycle time in game) */
	cycleTime?: number;
	/**  */
	requireOutputInventory?: boolean;
	/**  */
	waitForStackLimit?: boolean;
}
/**
 * All the properties can be set. Set to `undefined` to remove a property, `null` to use {@link ConfigCmd.defaults} during encoding.
 */
export interface PusherConfig {
	/** Pusher mode when it not hitting an item included in {@link ConfigCmd.filterItems}. */
	defaultMode?: PusherMode;
	/** Pusher mode when it is hitting an item included in {@link ConfigCmd.filterItems}. */
	filteredMode?: PusherMode;
	/** [0, 360] float. */
	angle?: number;
	/** [0, 20] float. */
	targetSpeed?: number;
	/** Whether the filter should *also* check for items in a container that the beam hits. */
	filterByInventory?: boolean;
	/** [0, 1000] float. */
	maxBeamLength?: number;
}
export declare class Blueprint implements BlueprintOptions {
	version: BlueprintOptions["version"];
	width: BlueprintOptions["width"];
	height: BlueprintOptions["height"];
	commands: BlueprintOptions["commands"];
	/**
	 * @param input Defaults to a 1x1 blueprint with no commands and version 0.
	 */
	constructor(input?: BlueprintOptions);
	/** Changes multiple properties of the blueprint. */
	set(input: BlueprintOptions): this;
	/** @private */
	fillFromArray(arr: any[], shallow?: boolean): this;
	/** @private */
	toArray(shallow?: boolean): any[];
	/**
	 * @returns A new instance with the same properties. (Deep clone)
	 */
	clone(): Blueprint;
}
export declare class ConfigCmd extends BPCmd implements ConfigCmdOptions {
	/**
	 * An object for default config values, intented to match the game's defaults.
	 * Used for properties that are `null` during encoding.
	 *
	 * You can modify this as you wish, so that you don't have to depend on the defaults of the library.
	 * See the object definition in [ConfigCmd.ts](https://github.com/Blueyescat/dsabp-js/blob/main/src/ConfigCmd.ts).
	 */
	static get defaults(): Required<ConfigCmdOptions>;
	static set defaults(input: Required<ConfigCmdOptions>);
	/** @private */ rawData: Uint8Array;
	filterMode: ConfigCmdOptions["filterMode"];
	filterItems: ConfigCmdOptions["filterItems"];
	angle: ConfigCmdOptions["angle"];
	fixedAngle: ConfigCmdOptions["fixedAngle"];
	pusher: ConfigCmdOptions["pusher"];
	loader: ConfigCmdOptions["loader"];
	/**
	 * @param input If omitted, the config will be empty.
	 * The game won't modify the existing config of an already placed object if the config command is empty.
	 */
	constructor(input?: ConfigCmdOptions);
	/** Changes multiple properties of the command. */
	set(input: ConfigCmdOptions): this;
	/** [cmdType, cfgMsg: null | any[] | Uint8Array] @private */
	fillFromArray(arr: any[]): this;
	/** @private */
	fillDataFromArray(data: any[]): this;
	/** @private */
	toArray(): any[];
	/**
	 * Checks whether the data of this command is not decoded. Comes from decoding a blueprint with
	 * {@link DecoderOptions.ignoreConfigCmdData} = `true`.
	 */
	get isRaw(): boolean;
	/**
	 * Checks whether this command has the same configuration as the target command.
	 */
	equals(target: ConfigCmd): boolean;
	clone(): ConfigCmd;
}
/**
 * Internally created by the {@link decode}, {@link decodeSync}, {@link decodeConfigCmd} and {@link decodeConfigCmdSync} functions.
 *
 * There doesn't seem to be any benefit to using the same instance,
 * but it is possible to do so only with the sync methods.
 */
export declare class Decoder {
	#private;
	options: DecoderOptions;
	constructor();
	/** {@inheritDoc decodeSync} */
	decodeSync(input: string, options?: DecoderOptions): Blueprint;
	/** {@inheritDoc decodeConfigCmdSync} */
	decodeConfigCmdSync(cmd: ConfigCmd): ConfigCmd;
	/** @private */
	decodeConfigCmdData(rawCmd: Uint8Array): any;
}
/**
 * Internally created by the {@link encode} and	{@link encodeSync} methods.
 *
 * There doesn't seem to be any benefit to using the same instance,
 * but it is possible to do so only with the sync method.
 */
export declare class Encoder {
	#private;
	constructor();
	/** {@inheritDoc encode} */
	encodeSync(bp: Blueprint): string;
}
export declare class BuildCmd extends BPCmd implements BuildCmdOptions {
	x: BuildCmdOptions["x"];
	y: BuildCmdOptions["y"];
	item: BuildCmdOptions["item"];
	bits: BuildCmdOptions["bits"];
	shape: BuildCmdOptions["shape"];
	constructor(input?: BuildCmdOptions);
	/** Changes multiple properties of the command. */
	set(input: BuildCmdOptions): this;
	/** @private */
	fillFromArray(arr: any[]): this;
	/** @private */
	toArray(): any[];
	clone(): BuildCmd;
}
/**
 * Synchronously decodes a blueprint string.
 * Supports the "DSA:" prefix (case-insensitive).
 * @param input The blueprint string.
 * @param options Decoding options.
 * @example
 * import { decodeSync } from "dsabp-js"
 *
 * const bp = decodeSync(str)
 */
export declare function decodeSync(input: string, options?: DecoderOptions): Blueprint;
/**
 * Asynchronously decodes a blueprint string.
 * Supports the "DSA:" prefix (case-insensitive).
 * @param input The blueprint string.
 * @param options Decoding options.
 * @example
 * import { decode } from "dsabp-js"
 *
 * const bp = await decode(str)
 */
export declare function decode(input: string, options?: DecoderOptions): Promise<Blueprint>;
/**
 * Synchronously decodes the data of a {@link ConfigCmd} containing raw data.
 * See {@link DecoderOptions.ignoreConfigCmdData} for more info.
 * @returns The same input instance, with decoded data.
 */
export declare function decodeConfigCmdSync(cmd: ConfigCmd): ConfigCmd;
/**
 * Asynchronously decodes the data of a {@link ConfigCmd} containing raw data.
 * See {@link DecoderOptions.ignoreConfigCmdData} for more info.
 * @returns The same input instance, with decoded data.
 */
export declare function decodeConfigCmd(cmd: ConfigCmd): Promise<ConfigCmd>;
/**
 * Synchronously encodes a {@link Blueprint} into a blueprint string.
 * Does not include the "DSA:" prefix, consider adding it on a public app.
 * @param input The blueprint to encode.
 * @example
 * import { encodeSync, PREFIX } from "dsabp-js"
 *
 * const str = PREFIX + encodeSync(bp)
 */
export declare function encodeSync(input: Blueprint): string;
/**
 * Asynchronously encodes a {@link Blueprint} into a blueprint string.
 * Does not include the "DSA:" prefix, consider adding it on a public app.
 * @param input The blueprint to encode.
 * @example
 * import { encode, PREFIX } from "dsabp-js"
 *
 * const str = PREFIX + await encode(bp)
 */
export declare function encode(input: Blueprint): Promise<string>;

export as namespace dsabp;

export {};
