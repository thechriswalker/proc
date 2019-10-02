import { createContext } from "@proc/context";
import { UnexpectedQueryTypeError } from "@proc/context-db";
import { createDatabase } from "./index";

describe("Contextual Database Handle", () => {
  const fn = jest.fn();
  const mockPool = {
    query: async (...args: Array<any>) => {
      const r = fn(args);
      const [err, res] = Array.isArray(r) ? r : [null, undefined];
      if (err) {
        throw err;
      } else {
        return res;
      }
    },
    on: () => {
      // empty
    },
    end: () => {
      // empty
    }
  };

  it("should create a db handle", async () => {
    const ctx = createContext();
    const getDatabase = createDatabase({ pool: mockPool } as any);
    const db = getDatabase(ctx);
    fn.mockReset();
    fn.mockReturnValueOnce([null, 1]);
    await db.ping();
    expect(fn).toBeCalled();
    fn.mockReset();
    const err = new Error();
    fn.mockReturnValueOnce([err]);
    expect(db.select("select something", ["value"])).rejects.toBe(err);

    const stats = db.getStatistics();
    expect(stats.length).toBe(1);
    expect(stats[0].query).toBe("select something");
    expect(stats[0].values).toBeDefined();

    // thanks typescript, you couldn't work this one out...
    const { values } = stats[0];
    if (values !== undefined) {
      expect(values.length).toBe(1);
      expect(values[0]).toBe("value");
    }

    const child = ctx.child();
    const childDb = getDatabase(child);

    expect(childDb.getStatistics().length).toBe(0);
    await childDb.select("select ...");
    expect(childDb.getStatistics().length).toBe(1);
    expect(db.getStatistics().length).toBe(1);

    child.done();
    ctx.done();
  });

  // @ts-ignore - it exists, but typescript does know yet
  it.each`
    query                                     | kind
    ${" INSERT foo into bar"}                 | ${"insert"}
    ${" insert foo into bar"}                 | ${"insert"}
    ${" SELECT foo FROM bar"}                 | ${"select"}
    ${"\nselect foo FROM bar"}                | ${"select"}
    ${"update\n foo set bar=?"}               | ${"update"}
    ${"\tUPDATE\tfoo set bar=?"}              | ${"update"}
    ${"DELETE\n from foo where 1"}            | ${"delete"}
    ${"\ndelete\n from foo where 1"}          | ${"delete"}
    ${"     DELETE\n       from foo where 1"} | ${"delete"}
    ${"explain select foo"}                   | ${"explain"}
    ${" Explain select foo"}                  | ${"explain"}
    ${"  \n  \n\tEXPLAIN select foo"}         | ${"explain"}
  `(
    "should bail if you try mis-typed queries `$query` => `$kind`",
    async ({ query, kind }) => {
      const ctx = createContext();
      const getDatabase = createDatabase({ pool: mockPool } as any);
      const db = getDatabase(ctx);
      fn.mockReset();
      fn.mockReturnValue([null, []]);
      // Snapshot should have a UnexpectedQueryTypeError
      const methods = ["select", "insert", "delete", "update", "explain"];
      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        if (method === kind) {
          // @ts-ignore we just enumerated these
          await expect(db[method](query)).resolves.toEqual(expect.anything());
        } else {
          // @ts-ignore we just enumerated these
          await expect(db[method](query)).rejects.toBeInstanceOf(
            UnexpectedQueryTypeError
          );
        }
      }
      ctx.done();
    }
  );
});
