import { Context, createContext, createProperty } from "./index";

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("Application Context", () => {
  it("should generate a unique ID each time", async () => {
    const parent = createContext();
    const ids = new Set([parent.id]);
    await Promise.all(
      Array.from({ length: 100 }).map(() => {
        const c = parent.child();
        ids.add(c.id);
        return c.done();
      })
    );
    parent.done();
    expect(ids.size).toBe(101);
  });

  it("should be able to create children with specific ids", async () => {
    const parent = createContext();
    const id = "<foo>";
    const child1 = parent.child(id);
    const child2 = parent.child(id);
    const child3 = parent.child();
    expect(child1.id).toBe(id);
    expect(child2.id).toBe(id);
    expect(child3.id).not.toBe(id);

    await Promise.all([child1.done(), child2.done(), child3.done()]);
    await parent.done();
  });

  it("should keep lifetime data", async () => {
    const ctx = createContext();
    await pause(51);
    // a spread as timers aren't exact, but it should be at least 50
    expect(ctx.lifetime).toBeGreaterThanOrEqual(50);
    expect(ctx.lifetime).toBeLessThan(60);
    const l = await ctx.done();
    await pause(50);
    expect(ctx.lifetime).toBe(l);
  });

  it("should wait correctly for done", async () => {
    const ctx = createContext();
    const fn = jest.fn();
    ctx.wait().then(fn);
    expect(fn).not.toBeCalled();
    await pause(50);
    expect(fn).not.toBeCalled();
    const p = ctx.done();
    expect(fn).not.toBeCalled(); // surprise, it is called asynchronously.
    await p;
    await 1; // one more tick
    expect(fn).toBeCalled();
  });

  it("should throw if done called with active children", async () => {
    const parent = createContext();
    const child = parent.child();
    await expect(() => parent.done()).rejects;
    child.done();
    await expect(() => parent.done()).resolves;
  });

  it("should throw if child called after done", async () => {
    const parent = createContext();
    await expect(() => parent.child().done()).resolves;
    const p = parent.done(); // don't await this.
    await expect(() => parent.child()).rejects;
    await p;
  });
});

describe("Context Properties", () => {
  it("should be able to create a property with a lifecycle", async () => {
    const create = jest.fn();
    const destroy = jest.fn();
    const prop = createProperty<number>(
      (ctx2: Context): number => {
        create();
        return 1;
      },
      (ctx2: Context, loaded: number) => {
        destroy();
      }
    );
    expect(create).not.toBeCalled();
    expect(destroy).not.toBeCalled();
    const ctx = createContext();
    const n = prop(ctx);
    expect(n).toBe(1);
    expect(create).toBeCalled();
    expect(destroy).not.toBeCalled();
    await ctx.done();
    expect(destroy).toBeCalled();
  });
});

interface SuperContext extends Context {
  extra(): void;
}

describe("Context Enhancing", () => {
  const fn = jest.fn();
  const enhancer = (c: Context): SuperContext => {
    return Object.assign(c, {
      extra: () => {
        fn();
      }
    });
  };

  it("should be able to create enhanced contexts", async () => {
    const ctx = createContext<SuperContext>(undefined, enhancer);

    fn.mockReset();
    expect(() => ctx.extra()).not.toThrow();
    expect(fn.mock.calls.length).toBe(1);
    const kid = ctx.child();

    expect(() => kid.extra()).not.toThrow();
    expect(fn.mock.calls.length).toBe(2);
    await kid.done();
    await ctx.done();
  });
});
