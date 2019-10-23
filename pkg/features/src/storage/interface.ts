import { BaseContext } from "@proc/runtime";

// we need to initialise a flagset with a storage adapter, like context-db or context-redis
// and a local cache.
// Note that this interface is ripe for data races. the flag initialiser functions should
// be pure - no side-effects.
// Combined with the fact that `set` should only overwrite if told to, we can be sure
// the whichever write happened first, we return a consistent value back to the application.
export interface Storage<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
> {
  // return the value for a flag from persistent storage or null if no value set
  get(ctx: Ctx, flag: string, userId: Id): Promise<boolean | null>;

  // store a value in persistent storage.
  // only overwrite an existing value if the overwrite flag is set.
  // otherwise leave the data as is and return the value previously set.
  set(
    ctx: Ctx,
    flag: string,
    userId: Id,
    value: boolean,
    overwrite: boolean
  ): Promise<boolean>;
}
