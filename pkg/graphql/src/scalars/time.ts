import { GraphQLScalarLiteralParser, GraphQLScalarType } from "graphql";
import { GraphQLError } from "graphql/error";
import { Kind } from "graphql/language";

const timePortion = (d: Date) => (d.toJSON() || "").slice(11, 8);

const serialize = (value: any): string => {
  // must be a date or string
  switch (typeof value) {
    case "string":
      const m = value.match(/^([0-9]{2}):([0-9]{2}):([0-9]{2})$/);
      if (!m) {
        throw new TypeError(`value is not a valid time string 'hh:mm:ss'`);
      }
      if (value !== timePortion(new Date(`1970-01-01T${value}Z`))) {
        throw new TypeError(`value is an invalid time: ${value}`);
      }
      return value;
    default:
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          throw new TypeError(`Value is not a valid Date: ${value}`);
        }
        return timePortion(value);
      }
      throw new TypeError(
        `Value is not an instance of Date or string: ${value}`
      );
  }
};

const parseLiteral: GraphQLScalarLiteralParser<string> = ast => {
  if (ast.kind !== Kind.STRING) {
    throw new GraphQLError(
      `Can only parse strings to dates but got a: ${ast.kind}`
    );
  }
  return serialize(ast.value);
};

export const TimeScalar = new GraphQLScalarType({
  name: "Time",
  description: "time field format is 'hh:mm:ss'",
  serialize,
  parseValue: serialize,
  parseLiteral
});
