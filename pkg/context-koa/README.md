# Koa Middleware to provide context.

Get a `@proc/context` object for every request. While this package works standalone, a more complete web server implementation exists as [`@proc/runtime`](../runtime).

## Usage

```typescript
import Koa from "koa";
import { createContext } from "@proc/context";
import { middleware, getRequestContext } from "@proc/context-koa";

const app = new Koa();
const parentContext = createContext();
app.use(middleware(parentContext));

app.use((ktx, next) => {
  const childContext = getRequestContext(ktx);
  ktx.body = `Child context had id: ${childContext.id}`;
});

app.listen(8080);
```
