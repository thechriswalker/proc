# Logging with context

A context aware logger using `pino` as a backend. Provides structured
logging with little overhead.

```typescript
import { createContext } from "@proc/context";
import { createLogger } from "@proc/context-pino";

const parent = createContext();
const getLogger = createLogger({
  base: {
    some: "fixed",
    values: true
  },
  ...otherPinoOptions
});

const child = parent.child();

const childLog = getLogger(child);

// will have the ctx id in the meta.
childLog.info("this is the child");

// bind some contextual values to this child
childLog.bind({ foo: "bar" });

// will have foo:bar in the meta
childLog.info("with added foo");

const parentLog = getLogger(parent);

parentLog.debug(
  "this will have the parent `ctx.id`, and not the added foo=bar"
);

// good practice, to release resources.
child.done();
parent.done();
```
