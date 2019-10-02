import { createProperty, PropertyLoader } from "@proc/context";

import Redis from "ioredis";

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

export const createRedis = (
  redisConfig: ClientOptions | string
): PropertyLoader<Client> => {
  // we actually only want a single connection.
  if (typeof redisConfig === "string") {
    const lazy = "lazyConnect=true";
    redisConfig = redisConfig.includes("?")
      ? `${redisConfig}&${lazy}`
      : `${redisConfig}?${lazy}`;
  } else {
    redisConfig.lazyConnect = true;
  }
  // @ts-ignore - ioredis types are no good
  const conn = new Redis(redisConfig) as Client;
  return createProperty(
    // despite @types/ioredis, this can be a string
    () => conn,
    ctx => {
      // if the status is "wait" we haven't even tried to connect.
      if (ctx.isTopLevelContext && conn.status !== "wait") {
        return conn.quit();
      }
    }
  );
};
