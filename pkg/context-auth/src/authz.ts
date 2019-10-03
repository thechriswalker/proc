import { Context } from "@proc/context";
import { Authn } from "./authn";

// this is the type signature that authorization checks should have
export type Authz<Meta extends any, Ctx extends Context = Context> = (
  ctx: Ctx,
  authn: Authn,
  meta: Meta
) => Promise<[boolean, string]>;

export type Auditor<Ctx extends Context> = (
  ctx: Ctx,
  authn: Authn,
  decision: boolean,
  reason: string
) => Promise<any>;

export function createDecisionMaker<Ctx extends Context>(
  auditor: Auditor<Ctx>
): <Meta extends any>(
  ctx: Ctx,
  authn: Authn,
  test: Authz<Meta, Ctx>,
  meta: Meta
) => Promise<boolean> {
  return async function decide(ctx, authn, test, meta) {
    let decision: boolean;
    let reason: string;
    try {
      // make the decision
      [decision, reason] = await test(ctx, authn, meta);
    } catch (e) {
      [decision, reason] = [false, `Error: ${e.message}`];
    }
    try {
      // log the audit decision
      await auditor(ctx, authn, decision, reason);
    } catch {}
    return decision;
  };
}
