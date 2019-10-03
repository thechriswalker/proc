import { AnonymousEntity, Authn, SystemEntity, UserEntity } from "./authn";

export * from "./authn";
export * from "./authz";

export function userAuthn(id: string, scopes: Array<string> = []) {
  const entity: UserEntity = { kind: "user", id };
  return new Authn(entity, entity, scopes);
}
export function anonymousAuthn(err?: Error) {
  const entity: AnonymousEntity = { kind: "anonymous" };
  return new Authn(entity, entity, [], err);
}
export function systemAuthn(scopes: Array<string> = []) {
  const entity: SystemEntity = { kind: "system" };
  return new Authn(entity, entity, scopes);
}
