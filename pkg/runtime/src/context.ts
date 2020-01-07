/**
 * This is where we define our context interface and extension to have our extra
 * features.
 */
import { Configuration } from "@proc/configuration";
import { Context, ContextEnhancer, createContext } from "@proc/context";
import { Authn } from "@proc/context-auth";
import { createLogger, Logger } from "@proc/context-pino";
import cuid from "cuid";

export interface BaseContext extends Context {
  log: Logger;
  config: Configuration;
  authn: Authn;
}
export type BaseContextEnhancer<Ctx extends BaseContext> = (
  ctx: BaseContext
) => Ctx;

function createParentContext<Ctx extends BaseContext = BaseContext>(
  config: Configuration,
  enhancer?: BaseContextEnhancer<Ctx>
): Ctx {
  const getLogger = createLogger({
    base: {
      vcs: config.getString("VCS_COMMIT"),
      env: config.getString("APP_ENV")
    },
    level: config.getString("LOG_LEVEL", "trace"),
    prettyPrint: config.getBoolean("LOG_PRETTY", process.stdout.isTTY)
      ? {
          levelFirst: true,
          // @ts-ignore
          ignore: "ctx,env,vcs",
          // @ts-ignore
          translateTime: "HH:MM:ss.l"
        }
      : false
  });
  const initialEnhancer = (ctx: Context): BaseContext => {
    let authn: Authn;
    return Object.defineProperties(ctx, {
      log: {
        enumerable: true,
        get: () => getLogger(ctx)
      },
      config: {
        enumerable: true,
        value: config
      },
      authn: {
        enumerable: true,
        get: () => {
          if (!authn) {
            // if you don't use the authn middleware,
            // don't access the authn property!
            throw new Error("Authn not present!");
          }
          return authn;
        },
        set: (given: Authn) => {
          if (authn) {
            throw new Error("Authn already set!");
          }
          authn = given;
        }
      }
    });
  };
  const finalEnhancer = enhancer
    ? (ctx: Context): Ctx => enhancer(initialEnhancer(ctx))
    : // We cannot get typescript to check this. If the consumer of this
      // package chooses to omit the "enhancer" and specify a Generic type
      // for BaseContext, then we can't help them. However, by allowing the
      // type parameter for the non-enhancer overload, we save the same
      // fudging elsewhere.
      ((initialEnhancer as any) as ContextEnhancer<Ctx>);

  return createContext<Ctx>(cuid, finalEnhancer);
}

export { createParentContext };
