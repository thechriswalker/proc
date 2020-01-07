// here a middleware with cookie and header options.
// storing authn as JWT claims.
import { anonymousAuthn, Authn } from "@proc/context-auth";
import { getRequestContext } from "@proc/context-koa";
import { JWKS, JWT } from "jose";
import { Middleware } from "koa";
import { Context } from "koa";
import { BaseContext } from "./";
const { sign, verify } = JWT;

export {
  createDecisionMaker,
  anonymousAuthn,
  userAuthn,
  systemAuthn
} from "@proc/context-auth";

export function createVerifier(
  ctx: BaseContext,
  options: JWT.VerifyOptions<false>
) {
  // NB has no default, it will throw if you try and do it with no AUTHN_JWKS env
  const jwks = JWKS.asKeyStore(JSON.parse(ctx.config.getString("AUTHN_JWKS")));
  // this doesn't need to be async, but making it so now, prevents any problems
  // later...
  return async (tok: string): Promise<Authn> => {
    const claims = verify(tok, jwks, options);
    // Now we do our own validation and return the Authn object.
    // Or reject, we will treat a bad authentication header (if present at all)
    // as `anonymous`. Then the app can decide to throw a 401 if needed
    return Authn.fromClaims(claims);
  };
}

export type JWTOptions = Partial<{
  exp: number; // Not After - epoch seconds
  nbf: number; // Not Before - epoch seconds
  iss: string; // Issuer. probably fixed
  aud: string; // Audience. probably fixed might be used to differential between web and app tokens...
  jti: string; // Token ID. Only useful for revocation
}>;

export function createSigner(ctx: BaseContext) {
  const keyId = ctx.config.getString("AUTHN_JWK_KEY_ID");
  const keyStore = JWKS.asKeyStore(
    JSON.parse(ctx.config.getString("AUTHN_JWKS"))
  );
  const key = keyStore.all().find(k => k.kid === keyId);
  if (!key) {
    throw new Error(
      "key id given in AUTHN_JWK_KEY_ID does not match a key in AUTHN_JWKS"
    );
  }
  // this doesn't need to be async, but making it so now, prevents any problems
  // later...
  return async (
    authn: Authn,
    options: JWTOptions = {},
    signOptions?: JWT.SignOptions
  ): Promise<string> => {
    const payload = Object.assign({}, options, authn.toClaims());
    const tok = sign(payload, key, signOptions);
    return tok;
  };
}

export function createAuthnMiddleware<Ctx extends BaseContext = BaseContext>(
  c: Ctx,
  locator: TokenLocator<Ctx>,
  verificationOptions: JWT.VerifyOptions<false> = {}
): Middleware {
  const verifier = createVerifier(c, verificationOptions);
  // allowed to be empty, in which case we don't check there.
  // header trumps cookie.
  return async (ktx, next) => {
    const ctx = getRequestContext<Ctx>(ktx);
    // check for authn headers and attach the authn to the context.
    // get header Bearer <jwt>
    // we are going to allow the jwt in the authorization header
    // or in a cookie.
    let tok = locator(ctx, ktx);
    // wait if we have to.
    if (tok && typeof tok === "object") {
      tok = await tok;
    }
    // if we even have a token now, we must verify it.
    let authn: Authn;
    if (!tok) {
      ctx.log.trace("authn no token present");
      // anonymous
      authn = anonymousAuthn();
    } else {
      try {
        authn = await verifier(tok);
        ctx.log.trace({ authn }, "authn verified");
      } catch (e) {
        // error, bad auth, return anonymous
        ctx.log.trace({ reason: e.message }, "authn token error");
        authn = anonymousAuthn(e);
      }
    }
    ctx.authn = authn;
    return next();
  };
}

// find a token for authentication (or return null)
export type TokenLocator<Ctx extends BaseContext = BaseContext> = (
  ctx: Ctx,
  ktx: Context
) => string | null | Promise<string | null>;

export const cookieTokenLocator: (
  cookieName: string
) => TokenLocator = cookieName => (ctx, ktx) => {
  const cookie = ktx.cookies.get(cookieName);
  if (cookie) {
    return cookie;
  }
  return null;
};

export const authorizationHeaderLocator: TokenLocator = (ctx, ktx) => {
  const header = ktx.get("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
};
