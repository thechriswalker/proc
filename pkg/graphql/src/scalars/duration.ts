import {
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarType
} from "graphql";
import { GraphQLError } from "graphql/error";
import { Kind } from "graphql/language";
import { type } from "os";

// the duration is based on Golang's time.Duration
// e.g. "10m1s" "400ms" "1.4h"
// but the smallest duration is 1millisecond

// valid unit strings and their millisecond equivalents
const validUnits: Record<string, number> = {
  ms: 1,
  s: 1e3,
  m: 60e3,
  h: 60 * 60e3
};
const unitOrder = ["h", "m", "s", "ms"];

export const serialize: GraphQLScalarSerializer<string> = (
  value: any
): string => {
  let n = deserialize(value);
  // format in the most readable string.
  if (n === 0) {
    return "0s";
  }
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  const processUnit = (unit: number) => {
    if (n < unit) {
      return 0;
    }
    const u = Math.floor(n / unit);
    n = n % unit;
    return u;
  };
  const h = processUnit(validUnits.h);
  const m = processUnit(validUnits.m);
  const s = processUnit(validUnits.s);
  const ms = processUnit(validUnits.ms);
  return (
    sign +
    [h, m, s, ms]
      .map((v, i) => {
        if (v) {
          return v + unitOrder[i];
        }
      })
      .filter(Boolean)
      .join(" ")
  );
};

function parseStringDuration(str: string): number {
  let sign = 1;
  let buffer = str;
  switch (buffer[0]) {
    case "-":
      sign = -1;
    // fallsthrough
    case "+":
      buffer = buffer.slice(1);
      break;
  }
  const throwSyntax = (s?: string, as?: string) => {
    let processing = "";
    if (s !== undefined) {
      processing = ` processing '${s}'`;
    }
    if (as !== undefined) {
      processing += ` as ${as}`;
    }
    throw new SyntaxError(`invalid format for duration: ${str}${processing}`);
  };
  const sections = buffer.split(/([0-9\.]+)(h|ms$|m|s)/g);
  if (sections.length < 3) {
    throwSyntax(undefined, "valid looking string");
  }
  let n = 0;
  let currentValue: number = -1;
  sections.forEach((s, i) => {
    switch (i % 3) {
      case 0:
        // special case for the first one. must be ""
        if (i === 0 && s !== "") {
          throwSyntax(s, "empty string");
        }
        // other cases can be "" or " "
        if (s !== "" && s !== " ") {
          throwSyntax(s, "empty or space");
        }
        break;
      case 1:
        // current numeric value;
        // parseFloat is not enough. it allows things like 1...3 (and 1abd3)
        // so we give our allowed format
        if (!/^[0-9]+(\.[0-9]+|)$/.test(s)) {
          // fail early
          throwSyntax(s, "float format");
        }
        currentValue = parseFloat(s);
        if (
          Number.isNaN(currentValue) ||
          !Number.isFinite(currentValue) ||
          currentValue < 0
        ) {
          throwSyntax(s, "non-negative, non-NaN, finite number");
        }
        break;
      case 2:
        // the unit
        if (s in validUnits === false) {
          throwSyntax(s, "valid unit");
        }
        n += currentValue * validUnits[s];
        break;
    }
  });
  // minimum precision is ms, so we floor whatever we get.
  return sign * Math.floor(n);
}

export const deserialize = (value: any): number => {
  // must be a number or string
  if (typeof value === "number") {
    // if a number, we assume milliseconds
    if (!Number.isFinite(value)) {
      throw new TypeError("value is not finite");
    }
    if (Number.isNaN(value)) {
      throw new TypeError("value is not a number");
    }
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("value is not a (safe) integer");
    }
    return value;
  }
  if (typeof value === "string") {
    // parse
    return parseStringDuration(value);
  }
  throw new TypeError(
    "duration must be a string or number, got: " + typeof value
  );
};

const parseLiteral: GraphQLScalarLiteralParser<number> = ast => {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.INT:
    case Kind.FLOAT:
      return deserialize(ast.value);
    default:
      throw new GraphQLError(
        `Can only parse strings/integers/floats as a duration but got a: ${
          ast.kind
        }`
      );
  }
};

export const DurationScalar = new GraphQLScalarType({
  name: "Duration",
  description: "Durations in second. HH:MM:SS.ssssss",
  serialize,
  parseValue: deserialize,
  parseLiteral
});
