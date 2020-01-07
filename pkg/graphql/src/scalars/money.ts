import { GraphQLScalarType } from "graphql";
import { GraphQLError } from "graphql/error";
import { Kind } from "graphql/language";
import { format } from "path";

// there is obviously a lot more than this, but this is all we need here.
export type Currency = {
  (n: number): Money;
  readonly code: string; // ISO4217 currency code.
  readonly digits: number; // the "exponent base 10" to convert minor units to major
  format(n: number): string; // this is the transfer format, not the localised format.
};

export type Money = {
  currency: Currency;
  value: number; // integer in minor units
};

// we will store the string as `XXX 1.234` with digits up to the digits limit.
const moneyRe = /^([A-Z]{3}) [0-9]+(|.[0-9]+)$/;
function parseMoneyString(input: string): [string, number, number] {
  const match = input.match(moneyRe);
  if (!match) {
    throw new TypeError("Invalid Money Format");
  }
  const [, code, majorS, minorS] = match;
  const major = safeInt(parseInt(majorS, 10));
  const minor = minorS.length > 1 ? safeInt(parseInt(minorS.slice(1), 10)) : 0;
  return [code, major, minor];
}

function formatMoneyString(curr: Currency, minor: number): string {
  if (curr.digits > 0) {
    // precision here is as much as we get with 6dp.
    return `${curr.code} ${minor.toFixed(6).replace(/(\.[0-9]+)0+$/, "$1")}`;
  }
  const n = minor / 10 ** curr.digits;
  return `${curr.code} ${n.toFixed(curr.digits)}`;
}

const safeInt = (value: number) => {
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
};

export const customMoneyScalar = (
  currencyList: Array<Currency>,
  defaultCurrency: Currency = currencyList[0]
) => {
  const currencyMap = new Map<string, Currency>(
    currencyList.map(c => [c.code, c])
  );
  const serialize = (value: any): string => {
    switch (typeof value) {
      case "string":
        // must be a valid string!
        const [code, major, minor] = parseMoneyString(value);
        const currency = currencyMap.get(code);
        if (!currency) {
          throw new TypeError("Unknown Currency: " + code);
        }
        if (currency.digits < 0) {
          // less than zero can have arbitrary precision
          // but we must reconstruct the actual number for formatting.
          return formatMoneyString(currency, parseFloat(`${major}.${minor}`));
        } else {
          if (minor >= 10 ** currency.digits) {
            throw new TypeError(
              "Sub-Minor Currency denominations are not allowed"
            );
          }
        }
        // OK. return canonical value.
        return formatMoneyString(
          currency,
          10 ** currency.digits * major + minor
        );
      case "number":
        // default currency, in minor units.
        return formatMoneyString(defaultCurrency, value);
      default:
        throw new TypeError("Invalid value given for 'Money' value");
    }
  };
  const deserialize = (v: string): Money => {
    const [code, major, minor] = parseMoneyString(v);
    const currency = currencyMap.get(code);
    if (!currency) {
      throw new TypeError("Unknown Currency: " + code);
    }
    if (currency.digits < 0) {
      // less than zero can have arbitrary precision
      // but we must reconstruct the actual number for formatting.
      return {
        currency,
        value: parseFloat(`${major}.${minor}`)
      };
    } else {
      if (minor >= 10 ** currency.digits) {
        throw new TypeError("Sub-Minor Currency denominations are not allowed");
      }
    }
    return {
      currency,
      value: safeInt(major * 10 ** currency.digits + minor)
    };
  };

  return new GraphQLScalarType({
    name: "Money",
    description:
      "Currency field, supports: " + Array.from(currencyMap.keys()).join(", "),
    serialize,
    parseValue: serialize,
    parseLiteral: ast => {
      if (ast.kind !== Kind.STRING) {
        throw new GraphQLError(
          `Can only parse strings to money but got a: ${ast.kind}`
        );
      }
      return deserialize(ast.value);
    }
  });
};

export const createCurrency = (code: string, digits: number = 2): Currency => {
  const def = (v: number): Money => {
    return { currency: def, value: v };
  };
  def.code = code;
  def.digits = digits;
  def.format = (v: number): string => formatMoneyString(def, v);
  return def;
};

// just a few currencies to start with
export const Currencies = {
  GBP: createCurrency("GBP"),
  EUR: createCurrency("EUR"),
  USD: createCurrency("USD"),
  CAD: createCurrency("CAD"),
  CHF: createCurrency("CHF"),
  JPY: createCurrency("JPY", 0),
  IQD: createCurrency("IQD", 3),
  XAU: createCurrency("XAU", -1)
};

// needs some tests!
export const MoneyScalar = customMoneyScalar([Currencies.GBP]);
