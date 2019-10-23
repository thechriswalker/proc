const { bootstrap, getRequestContext } = require("@proc/runtime");
const { createFeatureFlags } = require("@proc/features")
const redisStorage = require("@proc/features/redis").default;
const { createRedis } = require("@proc/context-redis");
const getRedis = createRedis("redis://127.0.0.1:6379")

const features = createFeatureFlags(redisStorage(getRedis));

const app = bootstrap();

// features.create(app.ctx, "SOME_FEATURE", (ctx, userId) => {
//   return userId === "bob"
// })

console.log(getRedis(app.ctx));

app.use(async (ktx, next) => {
  // any koa middleware!
  const ctx = getRequestContext(ktx);

  if (ktx.path === "/foo") {
    ctx.log.info("Hello World!");
    ktx.body = {
      version: ctx.config.getString("APP_VERSION"),
      features: {
        bob: await features.get(ctx, "SOME_FEATURE", "bob"),
        bill: await features.get(ctx, "SOME_FEATURE", "bill")
      }
    }
  } else if (ktx.path === "/bill") {
    await features.set(ctx, "SOME_FEATURE", "bill", true);
    ktx.body = { done: true };
  } else {
    return next();
  }
});

app.run();
