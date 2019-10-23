import { BaseContext } from "@proc/runtime";
import { Storage } from "./interface";

// This should not be used in production.
// it is simply for local dev where even
// then it is probably not suitable.
// The only real use-case for it is in testing,
// when I want to use the feature flags without
// a database backend.

export default function memoryStorage<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
>(): Storage<Id, Ctx> {
  const data = new Map<string, boolean>();
  function _get(flag: string, userId: Id) {
    return data.get(`${flag}:${userId}`);
  }
  function _set(flag: string, userId: Id, value: boolean) {
    data.set(`${flag}:${userId}`, value);
  }

  return {
    async get(ctx, flag, userId) {
      const v = _get(flag, userId);
      return v === undefined ? null : v;
    },
    async set(ctx, flag, userId, value, overwrite) {
      const v = _get(flag, userId);
      if (overwrite || v === undefined) {
        _set(flag, userId, value);
        return value;
      }
      return v;
    }
  };
}
