const { bootstrap, getRequestContext } = require("@proc/runtime");

const app = bootstrap();

app.use((ktx, next) => {
  // any koa middleware!
  if (ktx.path === "/foo") {
    const ctx = getRequestContext(ktx);
    ctx.log.info("Hello World!");
    ktx.body = {
      version: ctx.config.getString("APP_VERSION")
    }
  } else {
    return next();
  }
});

app.run();
