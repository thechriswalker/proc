import { Context, createProperty, PropertyLoader } from "@proc/context";
import { Connection, ConnectionProxy, Queryable } from "@proc/context-db";
import { Pool } from "pg";
import * as pg from "pg";

// these are useful to re-export
export * from "@proc/context-db";

const createPool = (opts: string | pg.PoolConfig): Queryable => {
  const pool = new Pool(
    typeof opts === "string" ? { connectionString: opts } : opts
  );
  (pool as Queryable).startTransaction = async () => {
    const client = await pool.connect();
    const done = async () => {
      client.release();
    };
    return { client, done };
  };
  return pool;
};

const createDatabase = (
  connOptsWrite: string | pg.PoolConfig,
  connOptsRead?: string | pg.PoolConfig
): PropertyLoader<ConnectionProxy> => {
  const writePool = createPool(connOptsWrite);
  const readPool = connOptsRead ? createPool(connOptsRead) : writePool;

  const getDatabase = createProperty<ConnectionProxy>(
    (ctx: Context) => new Connection(ctx, readPool, writePool),
    async (ctx: Context): Promise<void> => {
      if (ctx.isTopLevelContext) {
        const ends = [new Promise(r => (writePool as pg.Pool).end(() => r()))];
        if (readPool !== writePool) {
          ends.push(new Promise(r => (readPool as pg.Pool).end(() => r())));
        }
        await Promise.all(ends);
      }
    }
  );
  return getDatabase;
};

export { createDatabase };
