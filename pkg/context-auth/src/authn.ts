import { Context } from "@proc/context";

// our authentication is owner, subject, scope.
// checks against authn are of the form:
//  - does the subject and scope match?
// the owner is more useful for logging auth decisions.
// the entities in the subject/object are just important.
export class Authn {
  public static fromClaims(claims: any) {
    const owner = entityFromURI(String(claims.owner));
    const subject = entityFromURI(String(claims.sub));
    const scopes = String(claims.scopes)
      .split(",")
      .filter(Boolean);
    return new Authn(owner, subject, scopes);
  }

  constructor(
    private readonly owner: Entity,
    private readonly subject: Entity,
    private scopes: Array<string>,
    private error?: Error
  ) {
    // nothing else.
    let lazyString: string;
    this.toString = () => {
      if (!lazyString) {
        lazyString = `<Authn|${JSON.stringify({
          subject,
          owner,
          scopes,
          error
        })}>`;
      }
      return lazyString;
    };
  }
  public wasInvalid(): Error | false {
    return this.error ? this.error : false;
  }
  public isAnonymous(): boolean {
    return isAnonymous(this.subject);
  }
  public isSystem(): boolean {
    return isSystem(this.subject);
  }
  public isUser(): boolean {
    return isUser(this.subject);
  }

  public toJSON() {
    return this.toClaims();
  }
  // converts this authn to a JWT claimset
  // note that this ignores the "error" property
  public toClaims() {
    return {
      owner: entityToURI(this.owner),
      sub: entityToURI(this.subject),
      scopes: this.scopes.join(",")
    };
  }
}

export type UserEntity = {
  readonly kind: "user";
  readonly id: string; // you may have numeric IDs but we use string here
};

export type AnonymousEntity = {
  readonly kind: "anonymous";
};

export type SystemEntity = {
  readonly kind: "system";
  readonly id?: string;
};

export type Entity = UserEntity | AnonymousEntity | SystemEntity;

export const isAnonymous = (entity: Entity): entity is AnonymousEntity => {
  return entity.kind === "anonymous";
};
export const isSystem = (entity: Entity): entity is SystemEntity => {
  return entity.kind === "system";
};
export const isUser = (entity: Entity): entity is UserEntity => {
  return entity.kind === "user";
};

function entityToURI(e: Entity): string {
  let id = "";
  if ("id" in e && e.id) {
    id = e.id;
  }
  return `${e.kind}:${id}`;
}

function entityFromURI(uri: string): Entity {
  const [kind, id] = uri.split(":");
  switch (kind) {
    case "user":
      if (id === undefined) {
        break;
      }
      return { kind, id };
    case "anonymous":
      return { kind };
    case "system":
      if (id === undefined) {
        // this is allowed for system authn
        return { kind };
      }
      return { kind, id };
    default:
    // no default
  }
  throw new Error("invalid entity uri: " + uri);
}
