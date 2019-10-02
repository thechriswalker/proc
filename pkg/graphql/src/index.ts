import {
  ApolloServer,
  gql,
  makeExecutableSchema,
  ServerRegistration
} from "apollo-server-koa";
import Koa from "koa";
import mount from "koa-mount";

// export all the scalars
export * from "./scalars";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// we don't need the "app" for our server registration
export type MiddlewareConfig = Omit<ServerRegistration, "app">;

// we re-export this. It doesn't allow us to change implementations, but it gives
// the consumer the most flexibility.
export { ApolloServer, makeExecutableSchema, gql };

// this allows producing a middleware from a server,
// when the actual applyMiddleware function requires
// the app up front...
export async function createGraphQLMiddleware<Ctx>(
  server: ApolloServer,
  config: MiddlewareConfig,
  getRequestContext: (ktx: any) => Ctx
) {
  const app = new Koa();
  const path = config.path || "/graphql";
  const prevOptions = server.createGraphQLServerOptions.bind(server);
  server.createGraphQLServerOptions = async ktx => {
    const ctx = getRequestContext(ktx);
    const opts = await prevOptions(ktx);
    return { ...opts, context: { ctx } };
  };
  await server.applyMiddleware({
    app,
    ...config
  });
  return mount("/", app);
}
