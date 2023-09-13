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
/** The mode of a pusher config. */
export declare enum PusherMode {
	PUSH = 0,
	PULL = 1,
	DO_NOTHING = 2
}
/** The pickup or drop point of a loader config. */
export declare enum LoaderPoint {
	TOP_LEFT = 0,
	TOP = 1,
	TOP_RIGHT = 2,
	LEFT = 3,
	RIGHT = 4,
	BOTTOM_LEFT = 5,
	BOTTOM = 6,
	BOTTOM_RIGHT = 7
}
/** The priority of a loader config. */
export declare enum LoaderPriority {
	LOW = 0,
	NORMAL = 1,
	HIGH = 2
}
/** The mode of a filter config. */
export declare enum FilterMode {
	ALLOW_ALL = 0,
	BLOCK_FILTER_ONLY = 1,
	ALLOW_FILTER_ONLY = 2,
	BLOCK_ALL = 3
}
export declare enum FixedAngle {
	RIGHT = 0,
	UP = 1,
	LEFT = 2,
	DOWN = 3
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
	 * 		console.log(cmd.item)
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
	/** Integer ID of the item to build. */
	item?: number;
	/** A {@link BuildBits} instance. */
	bits?: BuildBits;
	/** Shape index of the tile to be placed. */
	shape?: number;
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
	/** Array of 3 item IDs in integer. */
	filterItems?: [
		number,
		number,
		number
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
	/** @inheritDoc */ version: BlueprintOptions["version"];
	/** @inheritDoc */ width: BlueprintOptions["width"];
	/** @inheritDoc */ height: BlueprintOptions["height"];
	/** @inheritDoc */ commands: BlueprintOptions["commands"];
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
	/** @inheritDoc */ filterMode: ConfigCmdOptions["filterMode"];
	/** @inheritDoc */ filterItems: ConfigCmdOptions["filterItems"];
	/** @inheritDoc */ angle: ConfigCmdOptions["angle"];
	/** @inheritDoc */ fixedAngle: ConfigCmdOptions["fixedAngle"];
	/** @inheritDoc */ pusher: ConfigCmdOptions["pusher"];
	/** @inheritDoc */ loader: ConfigCmdOptions["loader"];
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
	 *
	 * @see {@link DecoderOptions.ignoreConfigCmdData} for more info.
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
	/** @inheritDoc decodeSync */
	decodeSync(input: string, options?: DecoderOptions): Blueprint;
	/** @inheritDoc decodeConfigCmdSync */
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
	/** @inheritDoc encode */
	encodeSync(bp: Blueprint): string;
}
export declare class BuildCmd extends BPCmd implements BuildCmdOptions {
	/** @inheritDoc */ x: BuildCmdOptions["x"];
	/** @inheritDoc */ y: BuildCmdOptions["y"];
	/** @inheritDoc */ item: BuildCmdOptions["item"];
	/** @inheritDoc */ bits: BuildCmdOptions["bits"];
	/** @inheritDoc */ shape: BuildCmdOptions["shape"];
	constructor(input?: BuildCmdOptions);
	/** Changes multiple properties of the command. */
	set(input: BuildCmdOptions): this;
	/** @private */
	fillFromArray(arr: any[]): this;
	/** @private */
	toArray(): any[];
	clone(): BuildCmd;
}
export declare const PREFIX = "DSA:";
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
 * @see {@link DecoderOptions.ignoreConfigCmdData} for more info.
 * @returns The same input instance, with decoded data.
 */
export declare function decodeConfigCmdSync(cmd: ConfigCmd): ConfigCmd;
/**
 * Asynchronously decodes the data of a {@link ConfigCmd} containing raw data.
 * @see {@link DecoderOptions.ignoreConfigCmdData} for more info.
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
