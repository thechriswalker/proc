/**
 * This holds the environment gathered configuration
 */

export type Getter<T> = (key: string, fallback?: T) => T;
// this returns a parsed value and the raw value (if present)
type ValueAndRaw<T> = {
  value: T | undefined;
  raw: string | undefined;
};
type MaybeGetter<T> = (key: string) => ValueAndRaw<T>;

export interface Configuration {
  getString: Getter<string>;
  getInteger: Getter<number>;
  getFloat: Getter<number>;
  getBoolean: Getter<boolean>;
}

export const validBooleanStrings: Readonly<{ [k: string]: boolean }> = {
  true: true,
  1: true,
  y: true,
  yes: true,
  false: false,
  0: false,
  n: false,
  no: false
};

// export named for testing
export function createConfiguration(src: {
  [key: string]: string | undefined;
}): Configuration {
  // take a copy of the src, remove any of the undefined's.
  // I'd give the type signature just string, but this makes it compatible with
  // process.env
  const source: { [key: string]: string } = Object.entries(src).reduce<{
    [key: string]: string;
  }>((s, [k, v]) => {
    if (v !== undefined) {
      s[k] = v;
    }
    return s;
  }, {});

  // the string one doesn't need memoization
  const getString: MaybeGetter<string> = (key: string) => ({
    value: source[key],
    raw: source[key]
  });

  // memoize getting integer values.
  const intMemo: { [k: string]: ValueAndRaw<number> } = {};
  const getInt: MaybeGetter<number> = (key: string) => {
    if (key in intMemo === false) {
      const raw = source[key];
      // Yes, we use parseFloat because parseInt coerce's to integer when a valid
      // float is in the string. This way we keep the precision and then check whether
      // the float is actually an integer (and within safe range). Which is stricter
      // than parseInt(raw, 10);
      const n = parseFloat(raw);
      const isInt =
        Number.isInteger(n) &&
        n <= Number.MAX_SAFE_INTEGER &&
        n >= Number.MIN_SAFE_INTEGER;
      intMemo[key] = {
        value: isInt ? n : undefined,
        raw
      };
    }
    return intMemo[key];
  };

  // memoize getting float values
  const floatMemo: { [k: string]: ValueAndRaw<number> } = {};
  const getFloat: MaybeGetter<number> = (key: string) => {
    if (key in floatMemo === false) {
      const raw = source[key];
      const n = parseFloat(raw);
      // Number.isNaN because NaN is the only value we dissallow, infinity is fine
      floatMemo[key] = {
        value: Number.isNaN(n) ? undefined : n,
        raw
      };
    }
    return floatMemo[key];
  };

  // memoize getting boolean values
  const boolMemo: { [k: string]: ValueAndRaw<boolean> } = {};
  const getBool: MaybeGetter<boolean> = (key: string) => {
    if (key in boolMemo === false) {
      const raw = source[key];
      boolMemo[key] = {
        value: validBooleanStrings[raw],
        raw
      };
    }
    return boolMemo[key];
  };

  // this wraps the simpler functions into the fallback ones.
  function wrap<T>(kind: string, getter: MaybeGetter<T>): Getter<T> {
    return function wrapped(key: string, fallback?: T): T {
      const v = getter(key);
      if (v.value !== undefined) {
        return v.value;
      }
      if (v.raw !== undefined) {
        // this means even though there might be a fallback, we should throw here
        // because there is a value set, but it cannot be coerced to the type
        // we want.
        throw new MistypedConfigurationKeyError(kind, key, v.raw);
      }
      if (fallback === undefined) {
        throw new MissingConfigurationKeyError(kind, key);
      }
      return fallback;
    };
  }

  // Create an object conforming to our interface
  return Object.create(null, {
    getString: { value: wrap("string", getString) },
    getInteger: { value: wrap("integer", getInt) },
    getFloat: { value: wrap("float", getFloat) },
    getBoolean: { value: wrap("boolean", getBool) }
  });
}

// idea stolen from foghorn...
export class MissingConfigurationKeyError extends Error {
  constructor(kind: string, key: string) {
    super(`Configuration missing (required) ${kind} value at key: "${key}"`);
    this.name = "MissingConfigurationKeyError";
  }
}
export class MistypedConfigurationKeyError extends Error {
  constructor(kind: string, key: string, found: string) {
    super(
      `Configuration expected a ${kind} value at key: "${key}", got: "${found}"`
    );
    this.name = "MistypedConfigurationKeyError";
  }
}
