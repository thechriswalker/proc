import { Context } from "@proc/context";

const $ctx = Symbol("@proc/context");

export type Middleware = (ktx: any, next: () => Promise<any>) => any;

export function createMiddleware<Ctx extends Context>(
  parentContext: Ctx
): Middleware {
  return async function middleware(ktx, next) {
    const ctx = parentContext.child();
    ktx.state[$ctx] = ctx;
    try {
      await next();
    } finally {
      await ctx.waitForChildren();
      await ctx.done();
    }
  };
}

export function getRequestContext<Ctx extends Context>(ktx: any): Ctx {
  try {
    const ctx = ktx.state[$ctx];
    if (ctx) {
      return ctx as Ctx;
    }
  } catch {
    // ignore the actual error
  }
  // throw this one
  throw new Error("Attempt to get context without setting it.");
}
