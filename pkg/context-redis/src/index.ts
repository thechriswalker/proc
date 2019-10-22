import { createLifecycleProperty, PropertyLoader } from "@proc/context";

import Redis, { RedisOptions } from "ioredis";

export type Client = Redis.Redis;
export type ClientOptions = Redis.RedisOptions;

// so the interface is ours.
// nothing special here, yet, what I really want is a pooled version, otherwise
// a context could grab a connection and perform a blocking call.

// we could use `generic-pool` and create a Proxy object that wraps calls with
// acquire() first, unless we already got a pool connection.
// other use that, then on unload, if we got a connection, return it.

// but that is overkill for the regular case, we should instead have a helper
// for borrowing a connection if we want to block, otherwise we use the same
// connection for everything.

export const createRedis = (redisDSN: string): PropertyLoader<Client> => {
  const extraOptions: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  };

  let conn: Redis.Redis;
  return createLifecycleProperty(
    () => {
      conn = new Redis(redisDSN, extraOptions) as Client;
    },
    () => conn, // real singleton
    () => {
      // empty
    },
    ctx => {
      // if the status is "wait" we haven't even tried to connect.
      return conn.quit();
    }
  );
};
