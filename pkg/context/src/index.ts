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
  done: () => number;
  wait: () => Promise<void>;
  waitForChildren: () => Promise<void>;
  child: (id?: string) => this;
}
const noreap = () => {
  // empty
};

// I like the private names.
/* tslint:disable variable-name */

class ContextImpl {
  get lifetime(): number {
    return this.isDone ? this.done() : Date.now() - this._start;
  }
  get creation(): number {
    return this._start;
  }
  get isDone(): boolean {
    return this._doneSync !== undefined;
  }
  protected _reap: () => void = noreap;
  private _children: Array<ContextImpl> = [];
  private _doneSync: number | undefined;
  private _doneAsync: Deferral | undefined;
  private readonly _start: number = Date.now();

  constructor(
    private _idGen: IdGenerator,
    readonly isTopLevelContext: boolean,
    readonly id: string
  ) {}
  public done(): number {
    if (this._doneSync !== undefined) {
      // this is not considered an error
      return this._doneSync;
    }
    if (this._children.length !== 0) {
      throw new Error(
        "Attempt to call `done()` on a context with active children"
      );
    }
    this._doneSync = this.lifetime;
    if (this._reap) {
      this._reap();
    }
    if (this._doneAsync !== undefined) {
      // resolve the async version.
      this._doneAsync.deferral();
    }
    return this._doneSync;
  }
  public wait(): Promise<void> {
    if (this._doneSync) {
      return Promise.resolve();
    }
    if (this._doneAsync === undefined) {
      let deferral: () => void;
      const promise = new Promise<void>(resolve => (deferral = resolve));
      // @ts-ignore - TS doesn't understand that the promise inner function is synchronous
      this._doneAsync = { promise, deferral };
    }
    return this._doneAsync.promise;
  }
  public async waitForChildren(): Promise<void> {
    if (this._doneSync || this._children.length === 0) {
      return;
    }
    await Promise.all(this._children.map(kid => kid.wait()));
  }
  public child(id: string = this._idGen()) {
    if (this.isDone) {
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
}

type Deferral = {
  promise: Promise<void>;
  deferral: () => void;
};

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
      ctx.wait().then(() => unload(ctx, loaded));
    }
    return wm.get(ctx) as T;
  };
}

export { createProperty };
