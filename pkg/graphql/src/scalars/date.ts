import { GraphQLScalarLiteralParser, GraphQLScalarType } from "graphql";
import { GraphQLError } from "graphql/error";
import { Kind } from "graphql/language";

const datePortion = (d: Date) => d.toJSON().slice(0, 10);

const serialize = (value: any): string => {
  // must be a date or string
  switch (typeof value) {
    case "string":
      const m = value.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
      if (!m) {
        throw new TypeError(`value is not a valid date string 'YYYY-MM-DD'`);
      }
      // to work out if this is a valid date. we create a date and see if it
      // matches when parsed. This fixes otherwise valid dates like: 2929-02-30 (=> 2020-03-02)
      if (value !== datePortion(new Date(value + "T00:00:00Z"))) {
        throw new TypeError(`value is an invalid date: ${value}`);
      }
      return value;
    default:
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          throw new TypeError(`Value is not a valid Date: ${value}`);
        }
        return datePortion(value);
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

export const DateScalar = new GraphQLScalarType({
  name: "Date",
  description: "Date field format is 'yyyy-mm-dd'",
  serialize,
  parseValue: serialize,
  parseLiteral
});
