import { Context, createProperty, PropertyLoader } from "@proc/context";
import {
  Connection,
  ConnectionProxy,
  Query,
  Queryable,
  Result
} from "@proc/context-db";
import { Database } from "sqlite3";
import { URL } from "url";

// these are useful to re-export
export * from "@proc/context-db";

// we make a proxy around the database object, so we can pretend creation is
// synchronous.

const createDatabase = (dsn: string): PropertyLoader<ConnectionProxy> => {
  const { pathname } = new URL(dsn);
  if (!pathname) {
    throw new Error("must supply a path for the sqlite database");
  }

  // wrap the opener in a promise.
  const promise = new Promise<Database>((resolve, reject) => {
    const db: Database = new Database(pathname, err =>
      err ? reject(err) : resolve(db)
    );
  });
  promise.catch(err => {
    // this error is handled later in the code, on first use
    // but node barfs about unhandled rejections if this noop
    // isn't here.
  });

  function all(db: Database, query: string, values?: Array<any>) {
    return new Promise((resolve, reject) => {
      db.all(query, values || [], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });
  }
  function close(db: Database) {
    return new Promise((resolve, reject) => {
      db.close(err => (err ? reject(err) : resolve()));
    });
  }

  // we only need one function to create Queryable...
  // `startTransaction` is optional, but we can add it.
  const queryable: Queryable = {
    async query<T>(q: Query, values?: Array<any>): Promise<Result<T>> {
      const db = await promise;
      const qry =
        typeof q === "string"
          ? all(db, q, values)
          : all(db, q.text, q.values as Array<any>);
      const rows = (await qry) as Array<T>;
      return { rows };
    }
  };

  const getDatabase = createProperty<ConnectionProxy>(
    (ctx: Context) => new Connection(ctx, queryable, queryable),
    async (ctx: Context): Promise<void> => {
      if (ctx.isTopLevelContext) {
        // don't care about the possible catch here
        await promise.then(
          db => close(db),
          () => {
            // empty
          }
        );
      }
    }
  );
  return getDatabase;
};

export { createDatabase };
