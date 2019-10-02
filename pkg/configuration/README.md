# typed configuration object

A Configuration Object. It uses a simple `{[key:string]: string}` source object
(like `process.env`, encouraging 12-factor style configuration) and exposes
methods for fetching strings, booleans, integers and floats, with fallbacks.

Works well with `dotenv/register`.

## Usage

```typescript
import { createConfig } from "@proc/configuration";

const config = createConfig(process.env);

console.log(config.getString("NODE_ENV", "development"));
console.log(config.getInteger("SOME_INTEGER", 123));
```
