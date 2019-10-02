# `@proc/graphql` adds GraphQL server scalars and Koa middleware.

This package provides some utilities to make your GraphQL server life easier.

It allows you to create a pure Koa Middleware, without having to pass a Koa App up front (my biggest issue with `apollo-server-koa`).

It also provides some useful scalar type definitions.

## usage

```typescript
import {
  ApolloServer,
  makeExecutableSchema,
  gql,
  createGraphQLMiddleware,
  Duration
} from "@proc/graphql";

const start = Date.now();

const schema = makeExecutableSchema({
  typeDefs: gql`
    scalar Duration
    type Query {
      uptime Duration!
    }
  `,
  resolvers: {
    Duration: Duration,
    Query: {
      uptime: () => Date.now() - start
    }
  }
});

const server = new ApolloServer({ schema });

// middleware can be used in any Koa App. and will server the requests at `/graphql`
const middleware = createGraphQLMiddleware(server, { path: "/graphql" });
```
