import { createMiddleware, getRequestContext } from "@proc/context-koa";
// @ts-ignore
import exitHook from "async-exit-hook";
import { createServer } from "http";
import koa from "koa";

import {
  BaseContext,
  BaseContextEnhancer,
  createParentContext
} from "./context";

import { Configuration } from "@proc/configuration";
import { join } from "path";
import { AppVersionInfo, initConfiguration } from "./config";

export { initConfiguration };
export { BaseContext, BaseContextEnhancer };
export { getRequestContext };

export type AppOptions<Ctx extends BaseContext> = {
  info?: AppVersionInfo;
  enhancer?: (config: Configuration) => BaseContextEnhancer<Ctx>;
};

export type App<Ctx extends BaseContext> = {
  context: Ctx;
  info: AppVersionInfo;
  use(...middlewares: Array<koa.Middleware<any, any>>): void;
  run(): Promise<void>;
};

export function bootstrap<Ctx extends BaseContext = BaseContext>(
  opts: AppOptions<Ctx> = {}
): App<Ctx> {
  const [config, info] = initConfiguration(opts.info);
  const context = opts.enhancer
    ? createParentContext(config, opts.enhancer(config))
    : createParentContext<Ctx>(config);
  const middlewareStack: Array<koa.Middleware<any, any>> = [];

  // Unless you tell us not to put in the server header, we will
  // put in one that on-one could trust.
  if (!config.getBoolean("PROC_NO_SERVER_HEADER", false)) {
    middlewareStack.push((ktx, next) => {
      // something nice and old-school, straight out of RFC2616
      ktx.set("Server", "CERN/3.0 libwww/2.17");
      return next();
    });
  }

  // This defaults to on because Sir Terry Prachett was great and it is not much
  // overhead.
  if (!config.getBoolean("PROC_NO_CLACKS_OVERHEAD", false)) {
    middlewareStack.push((ktx, next) => {
      // In memorium (https://xclacksoverhead.org/home/about)
      ktx.set("X-Clacks-Overhead", "GNU Terry Pratchett");
      return next();
    });
  }
  return {
    context,
    info,
    use(...middlewares: Array<koa.Middleware<any, any>>): void {
      middlewareStack.push(...middlewares);
    },
    run: () => {
      // this wants to be unhandled promise rejection safe.
      // you can still get such rejections and maybe it is our
      // responsibility to catch them and exit cleanly.
      // but I am not going to do that until I have a good reason
      // it may be that actually a handle for such errors is what
      // is needed.
      return run(context, middlewareStack).catch(err => {
        context.log.error(err, "Unexpected Rejection in `run()`");
        process.exitCode = 1;
      });
    }
  };
}

async function run<Ctx extends BaseContext>(
  context: Ctx,
  middlewares: Array<koa.Middleware<any, any>>
) {
  const app = new koa();
  const contextMiddleware = createMiddleware(context);
  // add context middleware.
  app.use(contextMiddleware);
  // set a

  // then all the user middleware
  middlewares.forEach(m => app.use(m));

  const { config } = context;

  const server = createServer(app.callback());
  const port = config.getInteger("PORT", 3000);
  server.listen(port, () => {
    context.log.info(
      {
        runtime: VERSION,
        node: process.version,
        app: config.getString("APP_VERSION")
      },
      `${config.getString("APP_NAME")} listening on http://0.0.0.0:${port}`
    );
  });

  let shutdownHasRun = false;
  const shutdown = async (cb: () => void) => {
    if (shutdownHasRun) {
      return cb();
    }
    shutdownHasRun = true;

    const { log } = context;
    log.info("Server Shutting down");
    await new Promise(r => server.close(r));
    log.info(" - Webserver stopped");
    await context.waitForChildren();
    log.info(" - Child contexts exited");
    context.done();
    log.info(" - Shutdown sequence finished");
    cb();
  };

  // make sure we shutdown gracefully on the exit.
  exitHook(shutdown);

  await context.wait();
}

const processStart = Date.now();
export const statusInfoMiddleware: (
  v: AppVersionInfo
) => koa.Middleware = info => (ktx, next) => {
  if (ktx.path === "/.well-known/proc/info") {
    const { config } = getRequestContext<BaseContext>(ktx);
    ktx.body = {
      env: config.getString("APP_ENV"),
      uptime: Date.now() - processStart,
      app: info,
      runtime: {
        version: VERSION,
        commit: COMMIT
      }
    };
  } else {
    return next();
  }
};

let pkgVersion = "-";
let pkgCommit = "-";
try {
  // tslint:disable-next-line no-var-requires
  const { version, gitHead = "-" } = require(join(
    __dirname,
    "../package.json"
  ));
  pkgVersion = version;
  pkgCommit = gitHead;
} catch (e) {
  // ignore
}

export const VERSION = pkgVersion;
export const COMMIT = pkgCommit;
