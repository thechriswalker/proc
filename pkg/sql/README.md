# ES6 tagged template strings for SQL

I _love_ [`sql-template-strings`](https://github.com/felixfbecker/node-sql-template-strings),
except for one thing. Immutablility. There were a number of discussions about adding it,
either via a `.concat` method, or by allowing nesting templates.

Personally I like both approaches. so used both

- nested querys: the inner queries are copied, not mutated.
- `.append` will copy the arguments, not mutate, but will mutate the original query.
- `.concat` will copy the arguments, not mutate and will not mutate the original query returning a new object.

Otherwise the API is similar, the `sql`, `raw` method both produce an `SQLStatement`, which has
(apart from the properties and methods required for actually making the queries) the following
properties:

- `.concat(...next: Array<SQLStatement|string>): SQLStatement` concatenates all the queries together in order, producing a _new_ statement.
- `.concat(s: TemplateStringArray, v: any[]): SQLStatement` the tagged template string version of `concatenate`, but of course can only work on a single input.
- `.append(...next: Array<SQLStatement|string>): SQLStatement` like concatenate, but mutates the query it is called on.
- `.append(s: TemplateStringArray, v: any[]): SQLStatement` the tagged template string version of the `append`.
- `.clone()` explicit copy of the statement - note that the values array is shallow copied.

**NB** I have not implemented the bind syntax yet. I plan to at some point but have no need for it yet.

There are also some useful helper functions:

- `join(separator: string, arr: Array<Statement | string | number>): Statement`: joins the statements together in order, using the given seprator (note that spaces between statements will be added as needed).
- `mapJoin<T>(separator: string, arr: Array<T>, fn: (v: T, i: number, a: Array<T>) => Statement | string | number): Statement`: the same as join but allows you to pass an array of anything, and a mapping function to produce a Statement or primitive.
- `like(str: string): string`: escapes a string for a SQL LIKE clause. It wraps `_`,`%`,`[`,`]` in square brackets. _This may or may not be enough in your SQL server._

This allows you to do things like:

```typescript
import { sql, mapJoin, like } from "@proc/sql";

// like a database response...
const bigArrayOfThings = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];

// find articles with all the names in (simplistic search)
const query = sql`
  SELECT title, body
  FROM articles
  WHERE ${mapJoin("AND", bigArrayOfThings, ({ id }) => {
    // create a LIKE clause
    const matcher = `%${like(id)}%`;
    sql`body LIKE ${matcher}`;
  })};
`;
```
