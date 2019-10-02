# database adapter for `@proc/context`

Provides a high level interface for creating database sepcific adapters for use with `@proc/context`.

Each _context_ will get a wrapper which allows you track queries made within a specifc context and get statistics for them.

This package is not intended to be consumed directly, but rather as a dependency of another adapter:

- [`@proc/context-sqlite`](../context-sqlite)
- [`@proc/context-postgres`](../context-postgres)
