/*! dsabp-js v0.1.0 @license GPL-3.0 https://github.com/Blueyescat/dsabp-js */

// src/BPCmd.ts
var BPCmd = class {
};

// src/BuildBits.ts
var BuildBits = class {
  int;
  constructor(input) {
    if (input == null) {
      this.int = 0n;
      return;
    }
    if (typeof input == "string") {
      input = "0b" + reverse(input);
    } else if (typeof input != "number" && typeof input != "bigint") {
      throw new TypeError("input must be a number, bigint or string");
    }
    this.int = BigInt(input);
  }
  set(index) {
    if (index < 0 || index > 63)
      throw new RangeError("index must be between [0,63]");
    this.int |= mask(index);
    return this;
  }
  clear(index) {
    if (index < 0 || index > 63)
      throw new RangeError("index must be between [0,63]");
    this.int &= ~mask(index);
    return this;
  }
  toggle(index, force) {
    if (index < 0 || index > 63)
      throw new RangeError("index must be between [0,63]");
    if (typeof force == "undefined")
      this.int ^= mask(index);
    else if (force === true)
      this.set(index);
    else if (force === false)
      this.clear(index);
    return this;
  }
  isSet(index) {
    if (index < 0 || index > 63)
      return false;
    return !!(this.int & mask(index));
  }
  isZero() {
    return this.int == 0n;
  }
  isOne() {
    return this.int == 1n;
  }
  trimLeadZeros() {
    if (this.int)
      this.int /= -this.int & this.int;
    return this;
  }
  get size() {
    return this.int.toString(2).length;
  }
  *[Symbol.iterator]() {
    for (const b of reverse(this.int.toString(2))) {
      yield b == "1";
    }
  }
  toArray() {
    return Array.from(this);
  }
  toString() {
    return reverse(this.int.toString(2));
  }
  get [Symbol.toStringTag]() {
    return this.toString();
  }
  equals(target) {
    return this.int === target?.int;
  }
  clone() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
};
function mask(i) {
  return 1n << BigInt(i);
}
function reverse(str) {
  if (str.length < 1)
    return str;
  return str.split("").reduce((r, c) => c + r);
}

// src/constants.ts
var PREFIX = "DSA:";

// src/BuildCmd.ts
var BuildCmd = class extends BPCmd {
  x;
  y;
  item;
  bits;
  shape;
  constructor(input) {
    super();
    for (const prop in this)
      Object.defineProperty(this, prop, { configurable: false });
    if (input != null) {
      if (Object.getPrototypeOf(input) != Object.prototype)
        throw new TypeError("input must be an Object literal");
      this.set(input);
    }
  }
  set(input) {
    return Object.assign(this, input);
  }
  fillFromArray(arr) {
    this.x = arr[1 /* X */];
    this.y = arr[2 /* Y */];
    this.item = arr[3 /* ITEM */];
    this.bits = typeof arr[4 /* BITS */] != "undefined" ? new BuildBits(arr[4 /* BITS */]) : void 0;
    this.shape = arr[5 /* SHAPE */];
    return this;
  }
  toArray() {
    const arr = [];
    arr[0 /* TYPE */] = 0 /* BUILD */;
    if (this.x !== void 0)
      arr[1 /* X */] = this.x;
    if (this.y !== void 0)
      arr[2 /* Y */] = this.y;
    if (this.item !== void 0)
      arr[3 /* ITEM */] = this.item;
    if (this.bits !== void 0)
      arr[4 /* BITS */] = this.bits.int;
    if (this.shape !== void 0 && this.shape != 0) {
      arr[5 /* SHAPE */] = this.shape;
      if (typeof arr[4 /* BITS */] == "undefined")
        arr[4 /* BITS */] = 1n;
    }
    return arr;
  }
  clone() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    if (this.bits)
      clone.bits = this.bits.clone();
    return clone;
  }
};

// src/types.ts
var PusherMode = /* @__PURE__ */ ((PusherMode2) => {
  PusherMode2[PusherMode2["PUSH"] = 0] = "PUSH";
  PusherMode2[PusherMode2["PULL"] = 1] = "PULL";
  PusherMode2[PusherMode2["DO_NOTHING"] = 2] = "DO_NOTHING";
  return PusherMode2;
})(PusherMode || {});
var LoaderPoint = /* @__PURE__ */ ((LoaderPoint2) => {
  LoaderPoint2[LoaderPoint2["TOP_LEFT"] = 0] = "TOP_LEFT";
  LoaderPoint2[LoaderPoint2["TOP"] = 1] = "TOP";
  LoaderPoint2[LoaderPoint2["TOP_RIGHT"] = 2] = "TOP_RIGHT";
  LoaderPoint2[LoaderPoint2["LEFT"] = 3] = "LEFT";
  LoaderPoint2[LoaderPoint2["RIGHT"] = 4] = "RIGHT";
  LoaderPoint2[LoaderPoint2["BOTTOM_LEFT"] = 5] = "BOTTOM_LEFT";
  LoaderPoint2[LoaderPoint2["BOTTOM"] = 6] = "BOTTOM";
  LoaderPoint2[LoaderPoint2["BOTTOM_RIGHT"] = 7] = "BOTTOM_RIGHT";
  return LoaderPoint2;
})(LoaderPoint || {});
var LoaderPriority = /* @__PURE__ */ ((LoaderPriority2) => {
  LoaderPriority2[LoaderPriority2["LOW"] = 0] = "LOW";
  LoaderPriority2[LoaderPriority2["NORMAL"] = 1] = "NORMAL";
  LoaderPriority2[LoaderPriority2["HIGH"] = 2] = "HIGH";
  return LoaderPriority2;
})(LoaderPriority || {});
var FilterMode = /* @__PURE__ */ ((FilterMode2) => {
  FilterMode2[FilterMode2["ALLOW_ALL"] = 0] = "ALLOW_ALL";
  FilterMode2[FilterMode2["BLOCK_FILTER_ONLY"] = 1] = "BLOCK_FILTER_ONLY";
  FilterMode2[FilterMode2["ALLOW_FILTER_ONLY"] = 2] = "ALLOW_FILTER_ONLY";
  FilterMode2[FilterMode2["BLOCK_ALL"] = 3] = "BLOCK_ALL";
  return FilterMode2;
})(FilterMode || {});
var FixedAngle = /* @__PURE__ */ ((FixedAngle2) => {
  FixedAngle2[FixedAngle2["RIGHT"] = 0] = "RIGHT";
  FixedAngle2[FixedAngle2["UP"] = 1] = "UP";
  FixedAngle2[FixedAngle2["LEFT"] = 2] = "LEFT";
  FixedAngle2[FixedAngle2["DOWN"] = 3] = "DOWN";
  return FixedAngle2;
})(FixedAngle || {});

// src/ConfigCmd.ts
var defaults = {
  filterMode: 0 /* ALLOW_ALL */,
  filterItems: [0, 0, 0],
  angle: 0,
  fixedAngle: 0 /* RIGHT */,
  pusher: {
    defaultMode: 2 /* DO_NOTHING */,
    filteredMode: 0 /* PUSH */,
    angle: 0,
    targetSpeed: 20,
    filterByInventory: false,
    maxBeamLength: 1e3
  },
  loader: {
    pickupPoint: 3 /* LEFT */,
    dropPoint: 4 /* RIGHT */,
    priority: 1 /* NORMAL */,
    stackLimit: 16,
    cycleTime: 20,
    requireOutputInventory: false,
    waitForStackLimit: false
  }
};
var msgKey_prop = {
  filter_config: "filterMode",
  filter_items: "filterItems",
  angle: "angle",
  angle_fixed: "fixedAngle",
  config_pusher: "pusher",
  config_loader: "loader"
};
for (const key in msgKey_prop) {
  msgKey_prop[msgKey_prop[key]] = key;
}
var ConfigCmd = class extends BPCmd {
  static get defaults() {
    return defaults;
  }
  static set defaults(input) {
    if (input != null && Object.getPrototypeOf(input) != Object.prototype)
      throw new TypeError("defaults can only be set to an Object literal");
    defaults = input;
  }
  rawData;
  filterMode;
  filterItems;
  angle;
  fixedAngle;
  pusher = {};
  loader = {};
  constructor(input) {
    super();
    for (const prop in this)
      Object.defineProperty(this, prop, { configurable: false });
    if (input != null) {
      if (Object.getPrototypeOf(input) != Object.prototype)
        throw new TypeError("input must be an Object literal");
      this.set(input);
    }
  }
  set(input) {
    return Object.assign(this, input);
  }
  fillFromArray(arr) {
    if (arr[1 /* DATA */] == null)
      return this;
    if (arr[1 /* DATA */] instanceof Uint8Array)
      return this.rawData = arr[1 /* DATA */], this;
    arr = arr[1 /* DATA */];
    for (let i = 0; i < arr.length; i++) {
      if (i <= 1)
        continue;
      if (typeof arr[i] == "string" && arr[i + 1] === 0) {
        const msgKey = arr[i];
        let val = arr[i + 2];
        if (Array.isArray(val))
          val = cfgArrToObj(msgKey, val) ?? val;
        this[msgKey_prop[msgKey] ?? msgKey] = val;
        i += 2;
      }
    }
    return this;
  }
  fillDataFromArray(data) {
    const arr = [];
    arr[0 /* TYPE */] = 1 /* CONFIG */;
    arr[1 /* DATA */] = data;
    return this.fillFromArray(arr);
  }
  toArray() {
    const arr = [];
    arr[0 /* TYPE */] = 1 /* CONFIG */;
    if (this.isRaw) {
      arr[1 /* DATA */] = this.rawData;
      return arr;
    }
    arr[1 /* DATA */] = [0, 0];
    for (const prop of Object.keys(this)) {
      let val = structuredClone(this[prop]);
      const msgKey = msgKey_prop[prop] ?? prop;
      if (val === void 0)
        continue;
      if (val === null || Object.getPrototypeOf(val) == Object.prototype) {
        if (val !== null && !Object.keys(val).length)
          continue;
        val = cfgObjToArr(msgKey, val);
      } else if (!Array.isArray(val)) {
        val = [val];
      }
      arr[1 /* DATA */].push(msgKey, 0, val);
    }
    return arr;
  }
  get isRaw() {
    return this.rawData instanceof Uint8Array;
  }
  equals(target) {
    return deepEquals(this, target);
  }
  clone() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    if (this.rawData)
      clone.rawData = new Uint8Array(this.rawData);
    return clone;
  }
};
function deepEquals(a, b) {
  if (a === b)
    return true;
  if (a?.constructor !== b?.constructor)
    return false;
  const keysA = Object.keys(a);
  return a && b && typeof a === "object" && typeof b === "object" ? keysA.length === Object.keys(b).length && keysA.every((key) => deepEquals(a[key], b[key])) : a === b;
}
function cfgArrToObj(key, arr) {
  switch (key) {
    case "filter_config" /* FILTER_CONFIG */:
    case "angle" /* ANGLE */:
    case "angle_fixed" /* ANGLE_FIXED */:
      return arr[0];
    case "filter_items" /* FILTER_ITEMS */:
      return arr;
    case "config_loader" /* LOADER */:
      return {
        pickupPoint: arr[0 /* PICKUP_POINT */],
        dropPoint: arr[1 /* DROP_POINT */],
        priority: arr[2 /* PRIORTY */],
        stackLimit: arr[3 /* STACK_LIMIT */],
        cycleTime: arr[4 /* CYCLE_TIME */],
        requireOutputInventory: arr[5 /* REQUIRE_OUTPUT_INVENTORY */],
        waitForStackLimit: arr[6 /* WAIT_FOR_STACK_LIMIT */]
      };
    case "config_pusher" /* PUSHER */:
      return {
        defaultMode: arr[0 /* DEFAULT_MODE */],
        filteredMode: arr[1 /* FILTERED_MODE */],
        angle: arr[2 /* ANGLE */],
        targetSpeed: arr[3 /* TARGET_SPEED */],
        filterByInventory: arr[4 /* FILTER_BY_INVENTORY */],
        maxBeamLength: arr[5 /* MAX_BEAM_LENGTH */]
      };
  }
}
function cfgObjToArr(key, obj) {
  const a = [];
  if (obj !== null) {
    for (const key2 in obj)
      if (obj[key2] === null)
        delete obj[key2];
  }
  switch (key) {
    case "config_loader" /* LOADER */:
      obj = { ...defaults.loader, ...obj };
      a[0 /* PICKUP_POINT */] = obj.pickupPoint;
      a[1 /* DROP_POINT */] = obj.dropPoint;
      a[2 /* PRIORTY */] = obj.priority;
      a[3 /* STACK_LIMIT */] = obj.stackLimit;
      a[4 /* CYCLE_TIME */] = obj.cycleTime;
      a[5 /* REQUIRE_OUTPUT_INVENTORY */] = obj.requireOutputInventory;
      a[6 /* WAIT_FOR_STACK_LIMIT */] = obj.waitForStackLimit;
      break;
    case "config_pusher" /* PUSHER */: {
      obj = { ...defaults.pusher, ...obj };
      a[0 /* DEFAULT_MODE */] = obj.defaultMode;
      a[1 /* FILTERED_MODE */] = obj.filteredMode;
      a[2 /* ANGLE */] = obj.angle;
      a[3 /* TARGET_SPEED */] = obj.targetSpeed;
      a[4 /* FILTER_BY_INVENTORY */] = obj.filterByInventory;
      a[5 /* MAX_BEAM_LENGTH */] = obj.maxBeamLength;
      break;
    }
  }
  return a;
}

// src/Blueprint.ts
var Blueprint = class {
  version;
  width;
  height;
  commands;
  constructor(input) {
    for (const prop in this)
      Object.defineProperty(this, prop, { configurable: false });
    if (typeof input == "undefined") {
      this.version = 0;
      this.width = 1;
      this.height = 1;
      this.commands = [];
    } else if (input != null && Object.getPrototypeOf(input) == Object.prototype) {
      this.version = input.version ?? 0;
      this.width = input.width ?? 1;
      this.height = input.height ?? 1;
      if (input.commands != null) {
        if (!Array.isArray(input.commands))
          throw new TypeError("input.commands must be an array");
        this.commands = input.commands;
      } else {
        this.commands = [];
      }
    } else {
      throw new TypeError("input must be an Object literal");
    }
  }
  set(input) {
    return Object.assign(this, input);
  }
  fillFromArray(arr, shallow) {
    this.version = arr[0 /* VER */];
    this.width = arr[1 /* WIDTH */];
    this.height = arr[2 /* HEIGHT */];
    this.commands = shallow ? arr[3 /* CMDS */] : arr[3 /* CMDS */].map((cmd) => {
      if (cmd[0 /* TYPE */] == 0 /* BUILD */)
        return new BuildCmd().fillFromArray(cmd);
      if (cmd[0 /* TYPE */] == 1 /* CONFIG */)
        return new ConfigCmd().fillFromArray(cmd);
    });
    return this;
  }
  toArray(shallow) {
    const arr = [];
    arr[0 /* VER */] = this.version;
    arr[1 /* WIDTH */] = this.width;
    arr[2 /* HEIGHT */] = this.height;
    arr[3 /* CMDS */] = shallow ? this.commands : this.commands.map((c) => c.toArray());
    return arr;
  }
  clone() {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    if (this.commands)
      clone.commands = this.commands.map((c) => c.clone());
    return clone;
  }
};

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  var n = new u8(e - s);
  n.set(v.subarray(s, e));
  return n;
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf || st.i != 2;
  var noSt = st.i;
  if (!buf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (noBuf)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (noBuf)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (noBuf)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; bt += 4) {
          buf[bt] = buf[bt - dt];
          buf[bt + 1] = buf[bt + 1 - dt];
          buf[bt + 2] = buf[bt + 2 - dt];
          buf[bt + 3] = buf[bt + 3 - dt];
        }
        bt = end;
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt == buf.length ? buf : slc(buf, 0, bt);
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i = 0; i < d.length; ++i) {
    if (d[i])
      t.push({ s: i, f: d[i] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i2].f ? i0++ : i2++];
    r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i = 1; i < s; ++i) {
    if (t2[i].s > maxSym)
      maxSym = t2[i].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i < s; ++i) {
      var i2_1 = t2[i].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i;
    }
    for (; i >= 0 && dt; --i) {
      var i2_3 = t2[i].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i = 1; i <= s; ++i) {
    if (c[i] == cln && i != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i = 0; i < cl.length; ++i)
    l += cf[i] * cl[i];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i = 0; i < s; ++i)
    out[o + i + 4] = dat[i];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i = 0; i < lclt.length; ++i)
    ++lcfreq[lclt[i] & 31];
  for (var i = 0; i < lcdt.length; ++i)
    ++lcfreq[lcdt[i] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p + 3 * i, lct[clim[i]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i2) {
      return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i + 2 < s; ++i) {
      var hv = hsh(i);
      var imod = i & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i) {
        var rem = s - i;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
          li = lc_1 = eb = 0, bs = i;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i + l] == dat[i + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
      }
    }
    for (i = Math.max(i, wi); i < s; ++i) {
      syms[li++] = dat[i];
      ++lf[dat[i]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i, st.w = wi;
    }
  } else {
    for (var i = st.w || 0; i < s + lst; i += 65535) {
      var e = i + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 12 + opt.mem, pre, post, st);
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// src/injBrowser.ts
var b64toUi8 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
var ui8tob64 = (ui8) => btoa(String.fromCharCode.apply(null, ui8));
function createWorker() {
  const insideWorker = async (info) => {
    let lib;
    self.addEventListener("message", async (e) => {
      const data = e.data;
      while (!lib)
        await new Promise((r) => setTimeout(r, 0));
      if (data.cmd == "decode") {
        try {
          data.result = new lib.Decoder().decodeSync(data.args.input, data.args.options).toArray();
        } catch (err2) {
          data.err = err2;
        }
        delete data.args;
        self.postMessage(data);
      } else if (data.cmd == "decodeConfigCmd") {
        try {
          data.result = new lib.Decoder().decodeConfigCmdData(data.args.rawData);
        } catch (err2) {
          data.err = err2;
        }
        delete data.args;
        self.postMessage(data);
      } else if (data.cmd == "encode") {
        try {
          const bp = new lib.Blueprint().fillFromArray(data.args.input);
          data.result = new lib.Encoder().encodeSync(bp);
        } catch (err2) {
          data.err = err2;
        }
        delete data.args;
        self.postMessage(data);
      }
    });
    if (info.bundleInfo.format == "iife") {
      importScripts(info.path);
      lib = globalThis[info.bundleInfo.globalName];
    } else
      lib = await import(info.path);
  };
  const workerData = {
    path: import.meta.url,
    bundleInfo: { format: "esm", globalName: "dsabp" }
  };
  return new Worker(URL.createObjectURL(new Blob([
    `(${insideWorker.toString()})(${JSON.stringify(workerData)})`
  ], { type: "text/javascript;charset=utf-8" })));
}

// src/Decoder.ts
var arrTypeMap = {
  [0 /* NONE */]: 2 /* TOP */,
  [2 /* TOP */]: 3 /* CMDS */,
  [3 /* CMDS */]: 4 /* CMD */,
  [4 /* CMD */]: 5 /* CFG */
};
var Decoder = class {
  #textDecoder;
  #bytes;
  #view;
  #pos;
  #lastArrType;
  options;
  constructor() {
    this.#textDecoder = new TextDecoder("utf-8");
  }
  #init(buff, lastArrType) {
    this.#bytes = new Uint8Array(buff);
    this.#view = new DataView(buff.buffer);
    this.#pos = 0;
    this.#lastArrType = lastArrType ?? 0 /* NONE */;
  }
  decodeSync(input, options = {}) {
    if (typeof input != "string")
      throw new TypeError("input must be a string");
    if (input.substring(0, PREFIX.length).toUpperCase() == PREFIX)
      input = input.substring(PREFIX.length);
    if (typeof options.ignoreConfigCmdData == "undefined")
      options.ignoreConfigCmdData = false;
    this.options = options;
    let inflated;
    if (typeof zlib_inflateRawSync != "undefined") {
      const b64decoded = Buffer.from(input, "base64");
      inflated = zlib_inflateRawSync(b64decoded);
    } else {
      const b64decoded = b64toUi8(input);
      inflated = inflateSync(b64decoded);
    }
    this.#init(inflated, 0 /* NONE */);
    return new Blueprint().fillFromArray(this.#read(), true);
  }
  decodeConfigCmdSync(cmd) {
    if (!(cmd instanceof ConfigCmd))
      throw new TypeError(`input must be a ${ConfigCmd.name}`);
    if (!cmd.isRaw)
      return cmd;
    const dataArr = this.decodeConfigCmdData(cmd.rawData);
    cmd.rawData = void 0;
    return cmd.fillDataFromArray(dataArr);
  }
  decodeConfigCmdData(rawCmd) {
    this.#init(rawCmd, 4 /* CMD */);
    return this.#read();
  }
  #read() {
    while (this.#pos < this.#bytes.length) {
      const b = this.#bytes[this.#pos++];
      if (b <= 63)
        return b;
      if (b <= 127)
        return b - 128;
      switch (b) {
        case 144 /* ARRAY_BEGIN */:
          return this.#readArray();
        case 128 /* U8 */:
          return this.#readU8();
        case 129 /* U16 */:
          return this.#readU16();
        case 130 /* U32 */:
          return this.#readU32();
        case 131 /* U64 */:
          return this.#readU64();
        case 132 /* I8 */:
          return this.#readI8();
        case 133 /* I16 */:
          return this.#readI16();
        case 134 /* I32 */:
          return this.#readI32();
        case 135 /* I64 */:
          return this.#readI64();
        case 136 /* F32 */:
          return this.#readF32();
        case 137 /* F64 */:
          return this.#readF64();
        case 143 /* NULL */:
          return null;
        case 141 /* TRUE */:
          return true;
        case 142 /* FALSE */:
          return false;
        case 148 /* BYTES_L1 */:
          return this.#readBytes(this.#getU8(), 1);
        case 149 /* BYTES_L2 */:
          return this.#readBytes(this.#getU16(), 2);
        case 150 /* BYTES_L4 */:
          return this.#readBytes(this.#getU32(), 4);
        case 138 /* STR_L1 */:
          return this.#readStr(this.#getU8(), 1);
        case 139 /* STR_L2 */:
          return this.#readStr(this.#getU16(), 2);
        case 140 /* STR_L4 */:
          return this.#readStr(this.#getU32(), 4);
      }
      throw new Error(`unsupported byte: ${b} (0x${b.toString(16)})`);
    }
  }
  #readArray() {
    const arr = [];
    const prevArrType = this.#lastArrType;
    this.#lastArrType = arrTypeMap[prevArrType] ?? 1 /* UNKNOWN */;
    const currArrType = this.#lastArrType;
    while (this.#pos < this.#bytes.length) {
      if (this.#bytes[this.#pos] == 145 /* ARRAY_END */) {
        this.#pos++;
        this.#lastArrType = prevArrType;
        if (currArrType == 4 /* CMD */) {
          if (arr[0 /* TYPE */] === 0 /* BUILD */)
            return new BuildCmd().fillFromArray(arr);
          if (arr[0 /* TYPE */] === 1 /* CONFIG */)
            return new ConfigCmd().fillFromArray(arr);
        }
        return arr;
      }
      arr.push(this.#read());
    }
  }
  #readU8() {
    const v = this.#view.getUint8(this.#pos);
    this.#pos++;
    return v;
  }
  #readU16() {
    const v = this.#view.getUint16(this.#pos, true);
    this.#pos += 2;
    return v;
  }
  #readU32() {
    const v = this.#view.getUint32(this.#pos, true);
    this.#pos += 4;
    return v;
  }
  #readU64() {
    const v = this.#view.getBigUint64(this.#pos, true);
    this.#pos += 8;
    return v;
  }
  #readI8() {
    const v = this.#view.getInt8(this.#pos);
    this.#pos++;
    return v;
  }
  #readI16() {
    const v = this.#view.getInt16(this.#pos, true);
    this.#pos += 2;
    return v;
  }
  #readI32() {
    const v = this.#view.getInt32(this.#pos, true);
    this.#pos += 4;
    return v;
  }
  #readI64() {
    const v = this.#view.getBigInt64(this.#pos, true);
    this.#pos += 8;
    return v;
  }
  #readF32() {
    const v = this.#view.getFloat32(this.#pos, true);
    this.#pos += 4;
    return v;
  }
  #readF64() {
    const v = this.#view.getFloat64(this.#pos, true);
    this.#pos += 8;
    return v;
  }
  #getU8() {
    return this.#view.getUint8(this.#pos);
  }
  #getU16() {
    return this.#view.getUint16(this.#pos, true);
  }
  #getU32() {
    return this.#view.getUint32(this.#pos, true);
  }
  #readStr(byteLength, headerOffset) {
    const offset = this.#pos + headerOffset;
    const str = this.#textDecoder.decode(this.#bytes.slice(offset, offset + byteLength));
    this.#pos += headerOffset + byteLength;
    return str;
  }
  #readBytes(byteLength, headOffset) {
    const readConfig = this.options.ignoreConfigCmdData !== true && this.#lastArrType == 4 /* CMD */;
    const offset = this.#pos + headOffset;
    const arr = this.#bytes.slice(offset, offset + byteLength);
    this.#pos = offset;
    if (readConfig)
      return this.#read();
    this.#pos += byteLength;
    return arr;
  }
};

// src/Encoder.ts
var Encoder = class _Encoder {
  #textEncoder;
  #bytes;
  #view;
  #pos;
  constructor() {
    this.#textEncoder = new TextEncoder();
  }
  #init(size) {
    this.#view = new DataView(new ArrayBuffer(size));
    this.#bytes = new Uint8Array(this.#view.buffer);
    this.#pos = 0;
  }
  encodeSync(bp) {
    if (!(bp instanceof Blueprint))
      throw new TypeError(`input must be an instance of ${Blueprint.name}`);
    const initSize = bp.commands.length ? Math.max(bp.commands.length * 20, 512) : 4096;
    this.#init(initSize);
    this.#write(bp.toArray(true));
    const encoded = this.#bytes.slice(0, this.#pos);
    if (typeof zlib_deflateRawSync != "undefined") {
      const deflated = zlib_deflateRawSync(encoded, { level: 9 });
      return deflated.toString("base64");
    } else {
      const deflated = deflateSync(encoded, { level: 9 });
      return ui8tob64(deflated);
    }
  }
  #encodeArray(arr) {
    this.#init(128);
    this.#write(arr);
    return this.#bytes.slice(0, this.#pos);
  }
  #write(obj) {
    if (typeof obj == "number" || typeof obj == "bigint") {
      this.#writeNumber(obj);
    } else if (typeof obj == "boolean") {
      this.#writeU8(obj ? 141 /* TRUE */ : 142 /* FALSE */);
    } else if (typeof obj == "string") {
      this.#writeStr(obj);
    } else if (obj == null) {
      this.#writeU8(143 /* NULL */);
    } else if (Array.isArray(obj)) {
      this.#writeArr(obj);
    } else if (obj instanceof Uint8Array) {
      this.#writeBin(obj);
    } else if (obj instanceof BuildCmd) {
      this.#writeArr(obj.toArray());
    } else if (obj instanceof ConfigCmd) {
      const arr = obj.toArray();
      if (Array.isArray(arr[1 /* DATA */]))
        arr[1 /* DATA */] = new Uint8Array(new _Encoder().#encodeArray(arr[1 /* DATA */]));
      this.#writeArr(arr);
    } else {
      throw new Error(`unsupported object: ${obj.constructor?.name} ${obj}`);
    }
  }
  #writeNumber(v, isSigned) {
    let isBigInt = typeof v == "bigint";
    if (isBigInt && v <= 4294967295) {
      v = Number(v);
      isBigInt = false;
    }
    if (!Number.isSafeInteger(v) && !isBigInt) {
      this.#writeU8(136 /* F32 */);
      this.#writeF32(v);
      return;
    }
    if (v >= -64 && v <= -1)
      return this.#writeI8(64 | v & 127);
    else if (v >= 0 && v <= 63)
      return this.#writeI8(v);
    if (v < 0 || isSigned) {
      if (-128 <= v && v <= 127) {
        this.#writeU8(132 /* I8 */);
        this.#writeU8(v);
      } else if (-32768 <= v && v <= 32767) {
        this.#writeU8(133 /* I16 */);
        this.#writeI16(v);
      } else if (-2147483648 <= v && v <= 2147483647) {
        this.#writeU8(134 /* I32 */);
        this.#writeI32(v);
      } else {
        this.#writeU8(135 /* I64 */);
        this.#writeI64(BigInt(v));
      }
    } else {
      if (v <= 255) {
        this.#writeU8(128 /* U8 */);
        this.#writeU8(v);
      } else if (v <= 65535) {
        this.#writeU8(129 /* U16 */);
        this.#writeU16(v);
      } else if (v <= 4294967295) {
        this.#writeU8(130 /* U32 */);
        this.#writeU32(v);
      } else {
        this.#writeU8(131 /* U64 */);
        this.#writeU64(BigInt(v));
      }
    }
  }
  #writeStr(v) {
    const utf8arr = this.#textEncoder.encode(v);
    const len = utf8arr.byteLength;
    if (len <= 255) {
      this.#writeU8(138 /* STR_L1 */);
      this.#writeU8(len);
    } else if (len <= 65535) {
      this.#writeU8(139 /* STR_L2 */);
      this.#writeU16(len);
    } else if (len <= 4294967295) {
      this.#writeU8(140 /* STR_L4 */);
      this.#writeU32(len);
    }
    this.#ensureSize(len);
    this.#bytes.set(utf8arr, this.#pos);
    this.#pos += len;
  }
  #writeArr(arr) {
    this.#writeU8(144 /* ARRAY_BEGIN */);
    for (const v of arr)
      this.#write(v);
    this.#writeU8(145 /* ARRAY_END */);
  }
  #writeBin(obj) {
    const size = obj.byteLength;
    if (size <= 255) {
      this.#writeU8(148 /* BYTES_L1 */);
      this.#writeU8(size);
    } else if (size <= 65535) {
      this.#writeU8(149 /* BYTES_L2 */);
      this.#writeU16(size);
    } else if (size <= 4294967295) {
      this.#writeU8(150 /* BYTES_L4 */);
      this.#writeU32(size);
    }
    this.#writeU8arr(obj);
  }
  #writeU8(v) {
    this.#ensureSize(1);
    this.#view.setUint8(this.#pos, v);
    this.#pos++;
  }
  #writeU16(v) {
    this.#ensureSize(2);
    this.#view.setUint16(this.#pos, v, true);
    this.#pos += 2;
  }
  #writeU32(v) {
    this.#ensureSize(4);
    this.#view.setUint32(this.#pos, v, true);
    this.#pos += 4;
  }
  #writeU64(v) {
    this.#ensureSize(8);
    this.#view.setBigUint64(this.#pos, v, true);
    this.#pos += 8;
  }
  #writeI8(v) {
    this.#ensureSize(1);
    this.#view.setInt8(this.#pos, v);
    this.#pos++;
  }
  #writeI16(v) {
    this.#ensureSize(2);
    this.#view.setInt16(this.#pos, v, true);
    this.#pos += 2;
  }
  #writeI32(v) {
    this.#ensureSize(4);
    this.#view.setInt32(this.#pos, v, true);
    this.#pos += 4;
  }
  #writeI64(v) {
    this.#ensureSize(8);
    this.#view.setBigInt64(this.#pos, v, true);
    this.#pos += 8;
  }
  #writeF32(v) {
    this.#ensureSize(4);
    this.#view.setFloat32(this.#pos, v, true);
    this.#pos += 4;
  }
  #writeU8arr(values) {
    this.#ensureSize(values.length);
    this.#bytes.set(values, this.#pos);
    this.#pos += values.length;
  }
  #ensureSize(size) {
    const req = this.#pos + size;
    if (req <= this.#view.byteLength)
      return;
    const buff = new ArrayBuffer(Math.max(req, this.#view.byteLength + 128));
    const bytes = new Uint8Array(buff);
    const view = new DataView(buff);
    bytes.set(this.#bytes);
    this.#view = view;
    this.#bytes = bytes;
  }
};

// src/util.ts
var isNode = globalThis.process?.release?.name == "node";
var isWorkerThread = isNode ? !isMainThread : typeof WorkerGlobalScope != "undefined" && self instanceof WorkerGlobalScope;
var wkMsgId = 0;
var wkRequests = {};
var worker = isWorkerThread ? null : (isNode ? node_createWorker : createWorker)();
function handleWkMessage(data) {
  if (data.err)
    wkRequests[data.id].rej(data.err);
  else
    wkRequests[data.id].res(data.result);
  delete wkRequests[data.id];
}
if (!isWorkerThread) {
  if (isNode)
    worker.on("message", handleWkMessage);
  else
    worker.addEventListener("message", (e) => handleWkMessage(e.data));
}
function wkPromise(id) {
  return new Promise((res, rej) => wkRequests[id] = { res, rej });
}
async function decodeAsync(input, options) {
  const id = wkMsgId++;
  worker.postMessage({ id, cmd: "decode", args: { input, options } });
  return new Blueprint().fillFromArray(
    await wkPromise(id)
  );
}
function decodeConfigCmdAsync(rawData) {
  const id = wkMsgId++;
  worker.postMessage({ id, cmd: "decodeConfigCmd", args: { rawData } });
  return wkPromise(id);
}
function encodeAsync(input) {
  const id = wkMsgId++;
  worker.postMessage({ id, cmd: "encode", args: { input: input.toArray() } });
  return wkPromise(id);
}

// src/index.ts
function decodeSync(input, options) {
  return new Decoder().decodeSync(input, options);
}
async function decode(input, options) {
  return decodeAsync(input, options);
}
function decodeConfigCmdSync(cmd) {
  return new Decoder().decodeConfigCmdSync(cmd);
}
async function decodeConfigCmd(cmd) {
  if (!(cmd instanceof ConfigCmd))
    throw new TypeError(`input must be a ${ConfigCmd.name}`);
  if (!cmd.isRaw)
    return cmd;
  const dataArr = await decodeConfigCmdAsync(cmd.rawData);
  cmd.rawData = void 0;
  return cmd.fillDataFromArray(dataArr);
}
function encodeSync(input) {
  return new Encoder().encodeSync(input);
}
function encode(input) {
  return encodeAsync(input);
}
export {
  BPCmd,
  Blueprint,
  BuildBits,
  BuildCmd,
  ConfigCmd,
  Decoder,
  Encoder,
  FilterMode,
  FixedAngle,
  LoaderPoint,
  LoaderPriority,
  PREFIX,
  PusherMode,
  decode,
  decodeConfigCmd,
  decodeConfigCmdSync,
  decodeSync,
  encode,
  encodeSync
};
//# sourceMappingURL=index.js.map
