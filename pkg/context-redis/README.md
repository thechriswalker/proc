# Redis with Context

A Redis connection for your context. Not much value added except that we manage
the connection lifecycle. so after your parent context has `.done()` called, the
connection is released and the application can shutdown sanely.

## Usage

```typescript
import { createContext } from "@proc/context";
import { createRedis } from "@proc/context-redis";

const getRedis = createRedis();

const ctx = createContext();

const r = getRedis(ctx);

r.set("foo", "bar").finally(() => {
  ctx.done(); //application will not be held open by the redis connection
});
```
