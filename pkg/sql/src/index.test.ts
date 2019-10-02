import { raw, sql } from "./";

describe("sql template function", () => {
  it("should work with bare strings", () => {
    const { text, values } = sql`SELECT foo FROM bar WHERE x = 1;`;

    expect(values.length).toBe(0);
    expect(text).toBe(`SELECT foo FROM bar WHERE x = 1;`);
  });

  it("should work with interpolated values", () => {
    const { text, values, query } = sql`SELECT foo FROM bar WHERE x = ${1};`;
    expect(values.length).toBe(1);
    expect(values[0]).toBe(1);
    expect(text).toBe(`SELECT foo FROM bar WHERE x = $1;`);
    expect(query).toBe(`SELECT foo FROM bar WHERE x = ?;`);
  });

  it("should allow nested templates", () => {
    const {
      text,
      values
    } = sql`SELECT foo FROM bar WHERE ${sql` x = ${1}  `}  OR    ${sql`y = ${2}`}OR z = ${3};`;
    expect(values.length).toBe(3);
    expect(values[0]).toBe(1);
    expect(values[1]).toBe(2);
    expect(values[2]).toBe(3);
    expect(text).toBe(`SELECT foo FROM bar WHERE x = $1 OR y = $2 OR z = $3;`);
  });

  it("should not mutate nested queries", () => {
    const q = sql`SELECT foo FROM bar WHERE x = ${1}`;

    expect(q.values.length).toBe(1);
    expect(q.values[0]).toBe(1);
    expect(q.text).toBe(`SELECT foo FROM bar WHERE x = $1`);

    const nested = sql`SELECT baz FROM quux WHERE foo = (${q})`;

    // the original should be untouched.
    expect(q.values.length).toBe(1);
    expect(q.values[0]).toBe(1);
    expect(q.text).toBe(`SELECT foo FROM bar WHERE x = $1`);

    // and the nesting should work.
    expect(nested.values.length).toBe(1);
    expect(nested.values[0]).toBe(1);
    expect(nested.text).toBe(
      `SELECT baz FROM quux WHERE foo = ( SELECT foo FROM bar WHERE x = $1 )`
    );
  });

  it("should allow `raw` values literally", () => {
    const $bar = "bar";
    const { text, values } = sql`SELECT foo FROM ${raw($bar)} WHERE x = ${1};`;

    expect(values.length).toBe(1);
    expect(values[0]).toBe(1);
    expect(text).toBe(`SELECT foo FROM bar WHERE x = $1;`);
  });

  it("should mutate the original object on `append`", () => {
    const q = sql`SELECT foo FROM bar WHERE`;

    const q1 = q.append`x = ${1}`;
    const q2 = q.append("AND", sql`y = ${2}`, ";");

    expect(q1).toBe(q);
    expect(q2).toBe(q);

    [q, q1, q2].forEach(({ text, values }) => {
      expect(values.length).toBe(2);
      expect(values[0]).toBe(1);
      expect(values[1]).toBe(2);
      expect(text).toBe(`SELECT foo FROM bar WHERE x = $1 AND y = $2;`);
    });
  });

  it("should not mutate the original object on `concat`", () => {
    const q = sql`SELECT foo FROM bar WHERE`;

    const q1 = q.concat(`x`, sql`= ${1}`, `;`);
    const q2 = q.concat`y = ${2};`;

    expect(q1.values.length).toBe(1);
    expect(q1.values[0]).toBe(1);
    expect(q1.text).toBe(`SELECT foo FROM bar WHERE x = $1;`);
    expect(q2.values.length).toBe(1);
    expect(q2.values[0]).toBe(2);
    expect(q2.text).toBe(`SELECT foo FROM bar WHERE y = $1;`);
  });
});
