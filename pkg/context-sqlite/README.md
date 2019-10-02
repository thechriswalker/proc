# SQLite connection for contexts

A database connection wrapped to use `@proc/context`.
Not much added value here from using a global, except that you can get
context-level statistics (i.e. per-request query count/timing info) easily.

```typescript
import { createContext } from "@proc/context";
import { createDatabase } from "@proc/context-sqlite";

const ctx = createContext();
const getDatabase = createDatabase("sqlite://path/to/file");

const child = ctx.child();

const db = getDatabase(child);

db.selectOne<{ n: number; s: string }>("SELECT 1 as n, 'foo' as s;").then(v => {
  console.log(v.n, v.s); // 1 foo
});

db.getStatistics().forEach(s => {
  // s has the query, time, result count, parameters, etc...
  // here it will be empty (the query above won't have finished yet...)
  // but after that resolves we will have 1 entry here.
});
```
