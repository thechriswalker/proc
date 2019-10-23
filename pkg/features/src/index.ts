import { BaseContext } from "@proc/runtime";
import { Storage } from "./storage/interface";

type FlagInitialiser<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
> = (ctx: Ctx, userId: Id) => Promise<boolean>;

export function spread<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
>(split: number): FlagInitialiser<Id, Ctx> {
  if (split < 0 || split > 1) {
    throw new Error("split value must be between 0 and 1, got: " + split);
  }
  return async () => Math.random() < split;
}

export interface Flags<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
> {
  get(ctx: Ctx, flag: string, userId: Id): Promise<boolean>;
  set(ctx: Ctx, flag: string, userId: Id, value: boolean): Promise<void>;
  create(ctx: Ctx, flag: string, init: FlagInitialiser<Id, Ctx>): void;
}

export function createFeatureFlags<
  Id extends string | number = string,
  Ctx extends BaseContext = BaseContext
>(storage: Storage<Id, Ctx>): Flags<Id, Ctx> {
  const initialisers = new Map<string, FlagInitialiser<Id, Ctx>>();

  async function get(ctx: Ctx, flag: string, userId: Id): Promise<boolean> {
    const stored = await storage.get(ctx, flag, userId);
    if (stored !== null) {
      return stored;
    }
    // We need to initialise
    let init = initialisers.get(flag);
    if (!init) {
      init = spread(ctx.config.getFloat("FEATURE_" + flag, 0));
      initialisers.set(flag, init);
    }
    const v = await init(ctx, userId);
    // here we do not explicitly overwrite. first write always wins
    return storage.set(ctx, flag, userId, v, false);
  }

  async function set(ctx: Ctx, flag: string, userId: Id, value: boolean) {
    // this time we do overwrite
    await storage.set(ctx, flag, userId, value, true);
  }

  function create(ctx: Ctx, flag: string, init: FlagInitialiser<Id, Ctx>) {
    if (initialisers.has(flag)) {
      ctx.log.warn(
        "[@proc/features] duplicate initialisation of feature: " + flag
      );
      return;
    }
    initialisers.set(flag, init);
  }

  return {
    get,
    set,
    create
  };
}
