import { Client } from "@proc/context-redis";
import { BaseContext } from "@proc/runtime";
import { Storage } from "./interface";

const ON = "1";
const OFF = "0";
const UNSET = null;
// redis will store the features as a user hash
// so HSET <prefix>:userId feature 0 or 1

export default function redisStorageFactory<
  Id extends string | number,
  Ctx extends BaseContext = BaseContext
>(
  getRedis: (ctx: Ctx) => Client,
  options: {
    prefix?: string;
  } = {}
): Storage<Id, Ctx> {
  const prefix = options.prefix ? options.prefix : "proc:flag";
  const hashKey = (id: number | string): string => `${prefix}:${id}`;

  function get(ctx: Ctx, flag: string, userId: Id) {
    const r = getRedis(ctx);
    const k = hashKey(userId);
    return _get(r, k, flag);
  }

  async function _get(r: Client, key: string, flag: string) {
    const v = await r.hget(key, flag);
    switch (v) {
      case ON:
        return true;
      case OFF:
        return false;
      case UNSET:
        return null;
      default:
        // this is an error condition really... but if we have bad data we will ignore
        // it.
        return null;
    }
  }
  async function set(
    ctx: Ctx,
    flag: string,
    userId: Id,
    value: boolean,
    overwrite: boolean
  ) {
    const r = getRedis(ctx);
    if (overwrite) {
      // just write
      await r.hset(hashKey(userId), flag, value ? ON : OFF);
      return value;
    }
    // otherwise write NX
    const key = hashKey(userId);
    const written = await r.hsetnx(key, flag, value ? ON : OFF);
    if (written === 0) {
      // we failed, return the actual value at the key
      // this shouldn't be unset, but there is a chance it will be.
      // We cannot code around that without custom lua. so we will accept
      // the low probably of the error condition and return our value
      // if this fails.
      const v = await _get(r, key, flag);
      if (v === null) {
        ctx.log.warn(
          "[@proc/features] RedisStorage unexpected value for key: " + key
        );
        return value;
      }
      return v;
    }
    // we didn't fail, return the value we wrote
    return value;
  }

  return { get, set };
}
