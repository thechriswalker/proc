# An application context.

A hierachical application context object. Create a parent context
for the application and spawn child contexts for each request/process.
Each gets a unique id and lifecycle.

Properties can be weakly attached to the context and the lifecycle events
ensure they can be destroyed after a request, hopefully avoiding memory
leaks by held resources.

The `enhancer` allows wrapping properties to the context without specifying
the implementations. This means you can create the interface (in Typescript)
and code against it, but leave the real implementation up the main library.

## Simple Usage

```typescript
import createContext from "@proc/context";

const ctx = createContext();
const child = ctx.child();

ctx.waitForChildren().finally(() => {
  console.log("child context finished");
});

someLongProcess(child).finally(() => {
  child.done(); // causes console.log: child context finished
});

ctx.done(); // free all resources
```
