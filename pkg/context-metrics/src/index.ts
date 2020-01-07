import { Context, createProperty } from "@proc/context";

// this is our universal interface. based on statsd.
// of course influx is way more complex. but we can
// build an influx model on statsd easily.
export interface Metrics {
  inc(name: MetricName): void; // increment a counter
  timer(): (name: MetricName) => void; // time an event
  timing(name: MetricName, milliseconds: number): void; // record an externally made timing
  gauge(name: MetricName, value: number): void;
}

export const createMetricsProperty = <Ctx extends Context>(
  plugin: MetricsPlugin<Ctx>
) => createProperty<Metrics, Ctx>(ctx => wrapPlugin(ctx, plugin));

// this is our plugin interface
export interface MetricsPlugin<Ctx extends Context> {
  inc(ctx: Ctx, name: MetricName): void;
  timing(ctx: Ctx, name: MetricName, milliseconds: number): void;
  gauge(ctx: Ctx, name: MetricName, value: number): void;
}

export type MetricNamer<T extends string = string> = (
  tags: Record<T, string>
) => MetricName;

export type MetricName = {
  measurement: string;
  tags: Array<[string, string]>; // ordered list of tags
};

// we want a consistent way to name our metrics that allows both statsd and
// influx to work correctly. Stats D has no concept of tags, but influx does.
// looking at prometheus and timescale, it seems like we want to be able to
// handle tagged metrics, so statsd is the outlier.
// so our metrics will pass through a common interface for the naming. this "name"
// function can be extended to coerce names as we want.
export function createName(measurement: string): MetricName;
export function createName<T extends string>(
  measurement: string,
  ...tagNames: Array<T>
): MetricNamer<T>;
export function createName<T extends string>(
  measurement: string,
  ...tagNames: Array<T>
): MetricName | MetricNamer<T> {
  if (!tagNames.length) {
    return { measurement, tags: [] };
  }
  return (values: Record<T, string>) => {
    // we need the entries in the same order as the tagNames
    // and we don't want excess entries.
    if (!values) {
      values = {} as Record<T, string>;
    }
    const map = new Map(Object.entries(values));
    const tags: Array<[string, string]> = [];
    try {
      if (map.size !== tagNames.length) {
        throw {};
      }
      // now ensure we have all required tags,
      tagNames.forEach(k => {
        if (!map.has(k)) {
          throw {};
        }
        tags.push([k, map.get(k)!]);
      });
    } catch {
      throw new Error(
        `Incorrect Tag Values for Metric '${measurement}' (want: ${tagNames}, got: ${Object.keys(
          values
        )}`
      );
    }
    return { measurement, tags };
  };
}

// @ts-ignore
const bigOneMillion = 1_000_000n;

export const wrapPlugin = <Ctx extends Context>(
  ctx: Ctx,
  m: MetricsPlugin<Ctx>
): Metrics => {
  return {
    timing(name, ms) {
      return m.timing(ctx, name, ms);
    },
    gauge(name, value) {
      return m.gauge(ctx, name, value);
    },
    inc(name) {
      return m.inc(ctx, name);
    },
    timer() {
      let start = process.hrtime.bigint();
      return (name: MetricName) => {
        const lap = process.hrtime.bigint();
        const elapsed = lap - start;
        // that is in nanoseconds. Let's floor it to milliseconds
        const milliseconds = Number(elapsed / bigOneMillion);
        m.timing(ctx, name, milliseconds);
        start = lap; // allow for multiple calls, measuring time between each
      };
    }
  };
};

// tslint:disable-next-line no-empty
const noop = () => {};

export const noMetrics: MetricsPlugin<Context> = {
  timing: noop,
  gauge: noop,
  inc: noop
};
