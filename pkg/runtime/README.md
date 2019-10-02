# Koa web app runtime for `@proc/context`

Simplies starting a web app server.
Uses `dotenv` for configuration bootstrapping.

## Usage

```typescript
import { bootstrap, getRequestContext } from "@proc/runtime";

// create middlewares in order, like you would call `app.use()` in koa
const middlewares = [
  (ktx, next) => {
    const ctx = getRequestContext(ktx);
    ctx.log.info("log something?");
    ktx.body = `<h1>Served with context id: ${ctx.id}</h1>`;
  }
];

const app = bootstrap();
app.use(...middlewares);
app.run().catch(err => {
  app.ctx.log.error(err, "unexpected error!");
});
```
