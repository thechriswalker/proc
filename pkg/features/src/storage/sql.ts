import { ConnectionProxy } from "@proc/context-db";
import { BaseContext } from "@proc/runtime";
import { raw, sql, Statement } from "@proc/sql";
import { Storage } from "./interface";

// here we use a postgres table for the data.
// we will create the table up front if it doesn't exist.

const createTable = async (db: ConnectionProxy, name: Statement) => {
  await db.query(/* sql */ sql`
    CREATE TABLE ${name} (
      user_id TEXT NOT NULL,
      flag TEXT NOT NULL,
      is_set BOOLEAN NOT NULL,
      PRIMARY_KEY (user_id, flag)
    );
  `);
  // pause a few milliseconds to allow replication if this has a read-replica
  // either way we don't create the table often, so this one-off wait is not so
  // bad.
  await new Promise(r => {
    setTimeout(r, 50);
  });
};

export default function postgresStorageFactory<
  Id extends string | number,
  Ctx extends BaseContext = BaseContext
>(
  getDB: (ctx: Ctx) => ConnectionProxy,
  options: {
    tableName?: string;
  } = {}
): Storage<Id, Ctx> {
  const table = raw(options.tableName ? options.tableName : "proc_flags");
  async function autoCreateTable<T>(
    db: ConnectionProxy,
    f: () => Promise<T>
  ): Promise<T> {
    try {
      return await f();
    } catch (e) {
      // if e is TABLE DOES NOT EXIST, THEN CREATE AND CONTINUE
      if (`${e}`.match(/table does not exist/)) {
        await createTable(db, name);
        return await f();
      }
      throw e;
    }
  }

  async function get(ctx: Ctx, flag: string, userId: Id) {
    const db = getDB(ctx);
    const row = await autoCreateTable(db, () =>
      db.selectOne<{ value: boolean }>(sql`
        SELECT value FROM ${table} WHERE user_id = ${userId} AND flag = ${flag};
      `)
    );
    if (!row) {
      // unset
      return null;
    }
    return row.value;
  }

  async function set(
    ctx: Ctx,
    flag: string,
    userId: Id,
    value: boolean,
    overwrite: boolean
  ) {
    const db = getDB(ctx);
    if (overwrite) {
      // just upsert
      await autoCreateTable(db, () =>
        db.insert(/* sql */ sql`
          INSERT INTO ${table} (user_id, flag, is_set)
          VALUES (${userId}, ${flag}, ${value})
          ON CONFLICT (user_id, flag) DO
          UPDATE SET is_set = ${value};
        `)
      );
      return value;
    }
    // maybe insert
    const res = await autoCreateTable(db, () =>
      db.insert<{ is_set: boolean }>(/*sql */ sql`
        INSERT INTO ${table} (user_id, flag, is_set)
        VALUES (${userId}, ${flag}, ${value})
        ON CONFLICT (user_id, flag) DO NOTHING
        RETURNING is_set
      `)
    );
    if (res.rows.length === 0) {
      // nothing updated, return existing value.
      return value;
    }
    // assume the first row is the one we want.
    const { is_set } = res.rows[0];
    return is_set;
  }

  return { get, set };
}
