export interface Statement {
  query: string;
  text: string;
  sql: string;

  strings: ReadonlyArray<string>;
  values: ReadonlyArray<any>;
  concat(...next: Array<Statement | string | number>): Statement;
  concat(s: TemplateStringsArray, ...v: Array<any>): Statement;
  append(...next: Array<Statement | string | number>): Statement;
  append(s: TemplateStringsArray, ...v: Array<any>): Statement;
  clone(): Statement;
}

class SQLStatement implements Statement {
  constructor(private pStrings: Array<string>, private pValues: Array<any>) {}

  // postgres
  get text(): string {
    return this.pStrings.reduce((p, c, i) => `${p}$${i}${c}`).trim();
  }

  // sequelize
  get query(): string {
    return this.sql;
  }

  get values(): ReadonlyArray<any> {
    return this.pValues;
  }
  get strings(): ReadonlyArray<string> {
    return this.pStrings;
  }

  // typescript needs this, despite the fact it is overridden immediately.
  get sql(): string {
    // the actual implementation is Object.defineProperty'd after the initial declaration
    return "";
  }

  public concat(...next: Array<Statement | string | number>): Statement;
  public concat(s: TemplateStringsArray, ...v: Array<any>): Statement;
  public concat(...args: Array<any>): Statement {
    // basically clone and append.
    return this.clone().append(...args);
  }

  public append(...next: Array<Statement | string | number>): Statement;
  public append(s: TemplateStringsArray, ...v: Array<any>): Statement;
  public append(...args: Array<any>): Statement {
    if (args.length === 0) {
      return this; // nothing to do!
    }
    // this is where the magic happens.
    // first were we called as a tagged template or a function.

    // the first argument is a template strings array if it is an array
    // and it's raw property is an array
    let next: Array<Statement | string | number>;
    if (isTemplateStringsArray(args[0])) {
      const [strings, ...values] = args;
      // we need to un-nest here.
      next = [createUnnestedStatement(strings.slice(), values)];
    } else {
      next = args;
    }
    // now merge the strings and values down.
    next.forEach(arg => {
      const previousFinalString = this.pStrings.pop()!;
      switch (typeof arg) {
        case "string":
        // falls through
        case "number":
          // append to previous final string.
          // unless the previous string was empty.
          this.pStrings.push(
            previousFinalString
              ? ensureWhitespaceJoin(previousFinalString, "" + arg)
              : "" + arg
          );
          break;
        default:
          // SQLStatement
          // we need to merge.
          // first combine the first and last strings prev/curr
          const innerValues = arg.values;
          if (innerValues.length === 0) {
            // this is one string. so we need to merge it all.
            this.pStrings.push(
              ensureWhitespaceJoin(previousFinalString, arg.strings[0])
            );
          } else {
            // we have at least one value and at least two strings.
            const [first, ...others] = arg.strings;
            // combine the first and prevLast
            this.pStrings.push(
              ensureWhitespaceJoin(previousFinalString, first),
              ...others
            );
            this.pValues.push(...innerValues);
          }
      }
    });

    return this;
  }

  public clone(): SQLStatement {
    return new SQLStatement(this.pStrings.slice(), this.pValues.slice());
  }
}
Object.defineProperty(SQLStatement.prototype, "sql", {
  enumerable: true,
  get(): string {
    return this.pStrings.join("?").trim();
  }
});

class EmptyStatement extends SQLStatement {
  constructor() {
    super([""], []);
  }
  public append(...args: Array<any>): Statement {
    throw new TypeError("Cannot mutate the Empty statement");
  }
}

// un-nests any values that are also statements.
// statements are always un-nested, so this doesn't have to be recursive
function createUnnestedStatement(
  strings: Array<string>,
  values: Array<any>
): Statement {
  if (strings.length === 0) {
    throw new TypeError(
      "template strings must not be called directly with bad arguments!"
    );
  }
  const outStrings: Array<string> = [strings.shift()!];
  const outValues: Array<any> = [];

  values.forEach(v => {
    const nextString = strings.shift()!;
    if (v instanceof SQLStatement) {
      // we need to unnest (not recursively though...).
      const innerValues = v.values;
      const prevLast = outStrings.pop()!;
      if (innerValues.length === 0) {
        // this is one string. so we need to merge it all.
        outStrings.push(
          ensureWhitespaceJoin(prevLast, v.strings[0], nextString)
        );
      } else {
        // we have at least one value and at least two strings.
        const [first, ...others] = v.strings;
        // combine the first and prevLast
        const nextLast = others.pop()!;
        outStrings.push(
          ensureWhitespaceJoin(prevLast, first),
          ...others,
          ensureWhitespaceJoin(nextLast, nextString)
        );
        outValues.push(...v.values);
      }
    } else {
      // no need to unnest, just push the current string/value.
      outValues.push(v);
      outStrings.push(nextString);
    }
  });
  return new SQLStatement(outStrings, outValues);
}

function ensureWhitespaceJoin(...strings: Array<string>): string {
  return strings.reduce((prev, curr) => {
    // if (!prev) {
    //   return curr;
    // }
    if (!curr) {
      return prev;
    }
    return prev.trimRight() + " " + curr.trimLeft();
  }, "");
}

function isTemplateStringsArray(x: any): x is TemplateStringsArray {
  // we have to ignore this. Array.isArray() tells typescript raw doesn't exist, but
  // it does...
  // @ts-ignore
  return Array.isArray(x) && Array.isArray(x.raw);
}

export const sql = (s: TemplateStringsArray, ...v: Array<any>): Statement =>
  createUnnestedStatement(s.slice(), v);

export const raw = (str: string): Statement => new SQLStatement([str], []);

// this is useful when you have a ternary statement, but don't want to add anything
// in one case, e.g. sql`SELECT id {getBar ? sql`, bar` : Empty} FROM foo`
export const Empty = new EmptyStatement();

// A convenience wrapper to allow you to easily map over an array of entries
// then only tricky bit is when you wish to add comma's etc. use mapJoin in that case
export const map = <T>(
  arr: Array<T>,
  fn: (v: T, i: number, a: Array<T>) => Statement | string | number
): Statement => {
  return raw("").append(...arr.map(fn));
};

// similar to map but covers the common case where you want to separate the parts
// with a string (like a comma or " AND " )
export const mapJoin = <T>(
  separator: string,
  arr: Array<T>,
  fn: (v: T, i: number, a: Array<T>) => Statement | string | number
): Statement => {
  return arr.reduce((p, v, i, a) => {
    if (i !== 0) {
      p.append(separator);
    }
    return p.append(fn(v, i, a));
  }, raw(""));
};

// just join the statements, no mapping
export const join = (
  separator: string,
  arr: Array<Statement | string | number>
): Statement => mapJoin(separator, arr, x => x);

export const like = (input: string) =>
  input.replace(/[\[\]_%]/g, c => `[${c}]`);
