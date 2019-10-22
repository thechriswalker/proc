import pino from "pino";

import { Context, createProperty, PropertyLoader } from "@proc/context";

export type Logger = pino.Logger & {
  bind: (obj?: { [key: string]: any }) => Logger;
};
export type LogLevel = pino.LevelWithSilent;

// this reference allows us to dynamically replace the underlying logger transparently
type LoggerReference = {
  logger: pino.Logger;
};

// NB we only handle a few traps here, the most common.
const logProxyHandler: ProxyHandler<LoggerReference> = {
  // get magically adds the bind prop, otherwise using the
  // target objects logger property.
  get(target, prop, theProxyObject) {
    if (prop === "bind") {
      // we return a function that can replace the logger
      // in the ref, basically allowing us to replace the `chindings` internal
      // pino properties.
      return (bindings: { [key: string]: any } = {}): Logger => {
        // get ref, create child, replace in ref.
        target.logger = target.logger.child(bindings);
        return theProxyObject;
      };
    }
    return target.logger[prop as any];
  },
  // set should set on target.logger
  set(target, prop, value) {
    target.logger[prop as any] = value;
    return true;
  },
  // own keys, should run on target.logger
  ownKeys(target) {
    return Reflect.ownKeys(target.logger);
  }
};

type SecondParam<T> = T extends (a: any, b: infer U) => any ? U : never;

// the opts are passed directly into the pino constructor.
export const createLogger = (
  options: pino.LoggerOptions,
  outputStream?: SecondParam<typeof pino>
): PropertyLoader<Logger> => {
  // this is the top level logger. it is never used directly.
  // only by children.
  const parent = outputStream ? pino(options, outputStream) : pino(options);
  // ctx.id is the only property guarranteed to be there.
  // others can be added with `.bind`
  return createProperty<Logger>((ctx: Context) => {
    const proxy = new Proxy<LoggerReference>(
      { logger: parent.child({ ctx: ctx.id }) },
      logProxyHandler
    );
    // this is annoying, but proxy object can return an interface very different
    // to the original object and the typescript signature assumes it must be the
    // same...
    // @see https://github.com/Microsoft/TypeScript/issues/20846
    return (proxy as any) as Logger;
  });
};
