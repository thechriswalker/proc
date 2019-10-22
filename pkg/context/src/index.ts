// GeneratedIds are string values the cuid library is
// a good choice here.
export type IdGenerator = () => string;

// a simple id generator.
const defaultIdGen: IdGenerator = (() => {
  let id = 0;
  return () => "#" + ++id;
})();

export interface Context {
  id: string;
  isDone: boolean;
  // This next prop `isTopLevelContext` makes is easier to create
  // properties that load and unload with the top level context, like
  // shared databases, or singletons
  isTopLevelContext: boolean;
  lifetime: number;
  creation: number;
  done: () => Promise<number>;
  wait: () => Promise<void>;
  waitForChildren: () => Promise<void>;
  child: (id?: string) => this;
  onDone: (fn: () => any) => void;
}
const noreap = () => {
  // empty
};

// I like the private names.
/* tslint:disable variable-name */

class ContextImpl {
  get lifetime(): number {
    return this._finish ? this._finish : Date.now() - this._start;
  }
  get creation(): number {
    return this._start;
  }
  get isDone(): boolean {
    return this._finish !== undefined;
  }
  protected _reap: () => void = noreap;
  private _children: Array<ContextImpl> = [];
  private _unloadHooks: Array<() => any> = [];
  private _finish: number | undefined;
  private _is_shutting_down: boolean = false;
  private _shutdown: Deferral<number> | undefined;
  private readonly _start: number = Date.now();

  constructor(
    private _idGen: IdGenerator,
    readonly isTopLevelContext: boolean,
    readonly id: string
  ) {}
  public async done(): Promise<number> {
    if (this._is_shutting_down) {
      return this._shutdown!.promise;
    }
    if (this._children.length !== 0) {
      throw new Error(
        "Attempt to call `done()` on a context with active children"
      );
    }
    this._is_shutting_down = true;
    if (!this._shutdown) {
      this._shutdown = defer();
    }

    // clear any unloading hooks
    await Promise.all(
      this._unloadHooks.map(async hook => {
        await hook();
      })
    );
    // truncate the unload hooks (no references)
    this._unloadHooks.length = 0;

    if (this._reap) {
      this._reap();
    }

    this._finish = Date.now();
    this._shutdown.deferral(this._finish);
    return this._finish;
  }
  // this is like done, but waits
  public wait(): Promise<any> {
    if (this._is_shutting_down || this._shutdown) {
      return this._shutdown!.promise;
    }
    this._shutdown = defer();
    return this._shutdown.promise;
  }
  public async waitForChildren(): Promise<void> {
    await Promise.all(this._children.map(kid => kid.wait()));
  }
  public child(id: string = this._idGen()) {
    if (this._is_shutting_down) {
      throw new Error("`Context.child` called after `Context.done`");
    }
    // wow, typescript makes you jump through some hoops to get "species"
    // level subclassing.
    const kid = new (this.constructor as any)(this._idGen, false, id) as this;
    kid._reap = () => {
      this._children.splice(this._children.indexOf(kid), 1);
    };
    this._children.push(kid);
    return kid;
  }
  public onDone(fn: () => any) {
    this._unloadHooks.push(fn);
  }
}

type Deferral<T = any> = {
  promise: Promise<T>;
  deferral: (t: T) => void;
};

function defer<T>(): Deferral<T> {
  let deferral: Deferral<T>["deferral"];
  const promise = new Promise<T>(resolve => {
    deferral = (t: T) => {
      resolve(t);
    };
  });
  // @ts-ignore - TS doesn't understand that the promise inner function is synchronous
  return { deferral, promise };
}

export type ContextEnhancer<Enhanced extends Context> = (
  ctx: Context
) => Enhanced;

// create a context with the given ID generator.
// The enhancer function can wrap property getters into context methods for convenience
// of the caller and mocking contexts.
function createContext<C extends Context = Context>(
  idGen: IdGenerator = defaultIdGen,
  enhancer?: ContextEnhancer<C>,
  topLevelId: string = idGen()
): C {
  // this is the main function. It creates children from the prototype we have defined.
  // Note that you can pass a fixed ID in here. The use case is for distributed services
  // to correlate contexts across applications.
  const enhance = enhancer ? enhancer : (ctx: Context): C => ctx as C;

  const parentContext = new ContextImpl(idGen, true, topLevelId);

  function childBearer(ctx: Context): C {
    const ectx = enhance(ctx);
    const _child = ectx.child.bind(ectx);
    ectx.child = function(this: C, id?: string) {
      return childBearer(_child(id));
    };
    return ectx;
  }
  return childBearer(parentContext);
}

// this module's default export is the parent context factory
export { createContext };

// context properties are loaded lazily and mapped via weakmaps.
// libraries (or your own code) can create these properties with this
// function.
// `load` is called to initialize the property, `unload` to dispose of it when the
// context is closed.
export type PropertyLoader<T, C extends Context = Context> = (ctx: C) => T;
export type Unloader<T, C extends Context = Context> = (
  ctx: C,
  loaded: T
) => any;

const noop: Unloader<any> = () => {
  // empty
};

function createProperty<T, C extends Context = Context>(
  load: PropertyLoader<T, C>,
  unload: Unloader<T, C> = noop
): PropertyLoader<T, C> {
  const wm = new WeakMap<object, T>();
  return (ctx: C): T => {
    if (!wm.has(ctx)) {
      const loaded = load(ctx);
      wm.set(ctx, loaded);
      ctx.onDone(() => unload(ctx, loaded));
    }
    return wm.get(ctx) as T;
  };
}

export function createLifecycleProperty<T, C extends Context = Context>(
  init: (ctx: C) => any,
  load: PropertyLoader<T, C>,
  unload: Unloader<T, C>,
  destructor: (ctx: C) => Promise<any>
): PropertyLoader<T, C> {
  // the only difference here is that it must first be called with a TOP-LEVEL context
  let hasBeenInitialised = false;
  const loader: PropertyLoader<T, C> = (ctx: C) => {
    if (hasBeenInitialised) {
      if (ctx.isTopLevelContext) {
        hasBeenInitialised = true;
        init(ctx);
      } else {
        throw new Error(
          "Must initialise a lifecycle property with a top-level context"
        );
      }
    }
    return load(ctx);
  };
  const unloader: Unloader<T, C> = async (ctx, loaded) => {
    await unload(ctx, loaded);
    if (ctx.isTopLevelContext && hasBeenInitialised) {
      await destructor(ctx);
    }
  };
  return createProperty(loader, unloader);
}

export { createProperty };
