import {
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarType,
  GraphQLScalarValueParser
} from "graphql";
import { GraphQLError } from "graphql/error";
import { Kind } from "graphql/language";

// we should allow other timezones in the output string
// and not force it to be UTC. There are valid use cases
// for non-UTC date times, especially when dealing with
// the future.
const secondPrecisionIsoDate = (d: Date): string =>
  d.toISOString().slice(0, -5) + "Z";

const serialize: GraphQLScalarSerializer<string> = value => {
  // must be a date/string/number
  const v: Date = new Date();
  switch (typeof value) {
    case "string":
      v.setTime(Date.parse(value));
      break;
    case "number":
      v.setTime(value);
      break;
    default:
      if (value instanceof Date) {
        v.setTime(value.getTime());
        break;
      }
      throw new TypeError(
        `Value is not an instance of Date, Date string or number: ${value}`
      );
  }
  // check we have a valid date.
  if (Number.isNaN(v.getTime())) {
    throw new TypeError(`Value is not a valid Date: ${v}`);
  }
  // discard the fractional seconds.
  // JS formats with millisecond precision.
  return secondPrecisionIsoDate(v);
};

const parseValue: GraphQLScalarValueParser<Date> = value => {
  const v = new Date(value);
  // check it's valid
  if (Number.isNaN(v.getTime())) {
    throw new TypeError(`Value is not a valid Date: ${v}`);
  }
  return v;
};

const parseLiteral: GraphQLScalarLiteralParser<Date> = ast => {
  if (ast.kind !== Kind.STRING && ast.kind !== Kind.INT) {
    throw new GraphQLError(
      `Can only parse strings & integers to dates but got a: ${ast.kind}`
    );
  }
  const result = parseValue(
    ast.kind === Kind.INT ? Number(ast.value) : ast.value
  );

  if (
    ast.kind === Kind.STRING &&
    ast.value !== secondPrecisionIsoDate(result!)
  ) {
    throw new GraphQLError(
      `Value is not a valid Date format (YYYY-MM-DDTHH:MM:SSZ): ${ast.value}`
    );
  }
  return result;
};

export const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "Use JavaScript Date object for date+time fields.",
  serialize,
  parseValue,
  parseLiteral
});
