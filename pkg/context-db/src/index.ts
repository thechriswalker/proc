import { Context } from "@proc/context";

export const enum QType {
  Any,
  Select,
  Insert,
  Update,
  Delete,
  Explain
}

// an SQL Statement interface compatible with sql-template-strings and @proc/sql
export interface Statement {
  /**
   * The SQL Statement for [node-postgres](https://www.npmjs.com/package/pg)
   */
  text: string;

  /**
   * The SQL Statement for [Sequelize](https://www.npmjs.com/package/sequelize)
   */
  query: string;

  /**
   * The SQL Statement for [mysql](https://www.npmjs.com/package/mysql)
   */
  sql: string;
  values: ReadonlyArray<any>;
  name?: string;
}

export type Query = Statement | string;

// we need a generic query result.
export interface Result<T = any> {
  rows: Array<T>;
}

interface BasicQueries {
  select<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>>;

  // select a single row, if it exists
  selectOne<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<T | undefined>;

  // just the rows
  selectAll<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Array<T>>;

  // perform a write query
  // most drivers cannot return anything useful here, but postgres with RETURNING
  // can return arbitrary rows for insert/update/delete
  insert<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>>;
  update<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>>;
  delete<T = any>(
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>>;
  // the generic escape hatch
  query<T = any>(query: Query, values?: ReadonlyArray<any>): Promise<Result<T>>;
}

// this is the exposed interface
export interface ConnectionProxy extends BasicQueries {
  // get all of them.
  getStatistics(): Array<QueryStat>;

  // handle in-line
  onStatistics(handler: StatCallback): void;

  explain(query: Query, values?: ReadonlyArray<any>): Promise<Result>;

  // test db connection.
  ping(): Promise<void>;

  // transactions
  tx(): Promise<TxClient>;
}
export interface TxClient extends BasicQueries {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export type QueryStat = {
  readonly query: string;
  readonly values?: ReadonlyArray<any>;
  readonly error: boolean;
  readonly start: number;
  readonly finish: number;
  readonly duration: number;
};

export type PoolStat = {
  maxHeld: number;
  acquired: number;
  released: number;
  enqueued: number;
  waiting: number;
};

export type StatCallback = (q: QueryStat) => any;

// this might be a pool, connection, cluster, transaction, etc...
export interface Queryable {
  query<T = any>(query: Query, values?: ReadonlyArray<any>): Promise<Result<T>>;
  startTransaction?(): Promise<{
    client: Queryable;
    done: () => Promise<void>;
  }>;
}

type StatRecorder = (stat: QueryStat) => () => void;

function runQuery(
  kind: QType.Explain,
  db: Queryable,
  stats: StatRecorder,
  query: Query,
  values?: ReadonlyArray<any>
): Promise<Result>;
function runQuery<T>(
  kind: QType.Select | QType.Insert | QType.Update | QType.Delete | QType.Any,
  db: Queryable,
  stats: StatRecorder,
  query: Query,
  values?: ReadonlyArray<any>
): Promise<Result<T>>;
async function runQuery<T>(
  kind: QType,
  db: Queryable,
  stats: StatRecorder,
  query: Query,
  values?: ReadonlyArray<any>
): Promise<Result<T>> {
  // Record Statistics per context
  // NB stat is *not* a QueryStat here, just an object so it's fields
  // are not readonly yet. When we push, the reference in this.stats *is*
  // a QueryStat so is readonly.
  const stat = {
    query: "",
    start: Date.now(),
    finish: 0,
    duration: 0,
    error: false,
    values: undefined as ReadonlyArray<any> | undefined
  };

  // check types and run query.
  if (typeof query === "string") {
    stat.query = query;
    stat.values = values;
    enforceQueryType(kind, query);
  } else {
    stat.query = query.text;
    stat.values = query.values;
    enforceQueryType(kind, query.text);
  }
  // this only happens if the enforceQueryType check passes
  const finalize = stats(stat);
  try {
    const result = await db.query(query, values);
    return result;
  } catch (err) {
    stat.error = true;
    throw err;
  } finally {
    stat.finish = Date.now();
    stat.duration = stat.finish - stat.start;
    finalize();
  }
}

export class UnexpectedQueryTypeError extends Error {
  constructor(re: RegExp, query: string) {
    const q = query.trim().slice(0, 10);
    super(
      `Unexpected query type: expected '${q}...' to match '${re}'
      Maybe you called "db.read/select" with a write query?`
    );
    this.name = "UnexpectedQueryTypeError";
  }
}

const kindRegexMap = {
  [QType.Any]: /./,
  [QType.Select]: /^\s*select\b/i,
  [QType.Insert]: /^\s*insert\b/i,
  [QType.Update]: /^\s*update\b/i,
  [QType.Delete]: /^\s*delete\b/i,
  [QType.Explain]: /^\s*explain\b/i
};

function enforceQueryType(kind: QType, query: string): void {
  const re = kindRegexMap[kind];
  if (!re.test(query)) {
    throw new UnexpectedQueryTypeError(re, query);
  }
}

export class Queryer {
  protected statRecorder: StatRecorder;
  constructor(
    protected ctx: Context,
    protected writePool: Queryable,
    protected readPool: Queryable,
    protected stats: Array<QueryStat> = [],
    protected statCallbacks: Array<StatCallback> = []
  ) {
    this.statRecorder = (s: QueryStat) => {
      stats.push(s);
      return () => statCallbacks.forEach(cb => cb(s));
    };
  }

  public getStatistics(this: Queryer) {
    return this.stats.slice();
  }

  public onStatistics(handler: StatCallback): void {
    this.statCallbacks.push(handler);
  }

  public explain(query: Query, values?: ReadonlyArray<any>): Promise<Result> {
    return runQuery(
      QType.Explain,
      this.readPool,
      this.statRecorder,
      query,
      values
    );
  }

  // this is a fake ping, for simplicity (the real mysql ping method)
  // is only accessible on the connection object, which is more complex
  // to access from here. We don't use this.query here, because we don't
  // want this to be added to stats.
  public async ping(this: Queryer): Promise<void> {
    const pings = [this.writePool.query(`select 'ping';`)];
    if (this.readPool !== this.writePool) {
      pings.push(this.readPool.query(`select 'ping';`));
    }
    await Promise.all(pings);
  }

  // this wraps the query in with a statistic timer.
  public select<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return runQuery<T>(
      QType.Select,
      this.readPool,
      this.statRecorder,
      query,
      values
    );
  }

  public async selectOne<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<T | undefined> {
    const r = await this.select<T>(query, values);
    // this doesn't throw if we don't have the row.
    return r.rows[0];
  }
  public async selectAll<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Array<T>> {
    const r = await this.select<T>(query, values);
    return r.rows;
  }

  public insert<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return runQuery<T>(
      QType.Insert,
      this.writePool,
      this.statRecorder,
      query,
      values
    );
  }
  public update<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return runQuery<T>(
      QType.Update,
      this.writePool,
      this.statRecorder,
      query,
      values
    );
  }
  public delete<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return runQuery<T>(
      QType.Delete,
      this.writePool,
      this.statRecorder,
      query,
      values
    );
  }
  public query<T = any>(
    this: Queryer,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return runQuery<T>(
      QType.Any,
      this.writePool,
      this.statRecorder,
      query,
      values
    );
  }
}

export class Connection extends Queryer implements ConnectionProxy {
  // transactions.
  public async tx(
    this: Connection,
    autoRollback: boolean = true
  ): Promise<TxClient> {
    // we only expose this function when the connproxy is for a pool.
    if (!this.writePool.startTransaction) {
      throw new Error("Current connection does not support transactions");
    }
    const { client, done } = await this.writePool.startTransaction();
    return new Transactioner(this.ctx, client, this.stats, autoRollback, done);
  }
}

function wrapAutoRollback<T>(tx: Transactioner, p: Promise<T>): Promise<T> {
  return p.catch(async err => {
    await tx.rollback();
    throw err;
  });
}

class Transactioner extends Queryer implements TxClient {
  private autoRollback: boolean;
  private onDone: () => Promise<any>;
  constructor(
    ctx: Context,
    client: Queryable,
    stats: Array<QueryStat>,
    autoRollback: boolean,
    onDone: () => Promise<any>
  ) {
    super(ctx, client, client, stats);
    this.autoRollback = autoRollback;
    this.onDone = onDone;
  }

  public setAutoRollback(autoRollback: boolean) {
    this.autoRollback = autoRollback;
  }
  public async rollback() {
    await super.query("ROLLBACK");
    await this.onDone();
  }
  public async commit() {
    await super.query("COMMIT");
    await this.onDone();
  }
  // wrap existing functions for auto-rollback
  public select<T = any>(
    this: Transactioner,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return this.autoRollback
      ? wrapAutoRollback(this, super.select(query, values))
      : super.select(query, values);
  }
  public insert<T = any>(
    this: Transactioner,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return this.autoRollback
      ? wrapAutoRollback(this, super.insert(query, values))
      : super.insert(query, values);
  }
  public update<T = any>(
    this: Transactioner,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return this.autoRollback
      ? wrapAutoRollback(this, super.update(query, values))
      : super.update(query, values);
  }
  public delete<T = any>(
    this: Transactioner,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return this.autoRollback
      ? wrapAutoRollback(this, super.delete(query, values))
      : super.delete(query, values);
  }
  public query<T = any>(
    this: Transactioner,
    query: Query,
    values?: ReadonlyArray<any>
  ): Promise<Result<T>> {
    return this.autoRollback
      ? wrapAutoRollback(this, super.query(query, values))
      : super.query(query, values);
  }
}
