import { Context } from "@proc/context";
import { MetricName, MetricsPlugin } from "@proc/context-metrics";
import { createSocket } from "dgram";

// discard the tag names, just use the values
// but as we should be createing these up front, not dynamically, we can cache the results
const statsdNameCache = new WeakMap<MetricName, string>();
function statsdName(name: MetricName): string {
  let s = statsdNameCache.get(name);
  if (!s) {
    s = name.tags.reduce<string>((p, [, v]) => {
      return p + "." + v;
    }, name.measurement.replace(/_/g, "."));
    statsdNameCache.set(name, s);
  }
  return s;
}

export function createStatsdMetrics<Ctx extends Context>(
  host: string,
  port: number,
  prefix?: string
): MetricsPlugin<Ctx> {
  if (prefix && !prefix.endsWith(".")) {
    prefix += ".";
  }
  const socket = createSocket("udp4");
  const ready = new Promise((resolve, reject) => {
    socket.on("connect", () => resolve(socket));
    socket.on("error", err => reject(err));
  });
  socket.connect(port, host);

  return {
    async inc(ctx, name) {
      await ready;
      const n = statsdName(name);
      socket.send(`${prefix}${n}:1|c`);
    },
    async timing(ctx, name, ms) {
      await ready;
      const n = statsdName(name);
      socket.send(`${prefix}${n}:${Math.floor(ms)}|ms`);
    },
    async gauge(ctx, name, value) {
      await ready;
      const n = statsdName(name);
      socket.send(`${prefix}${n}:${value}|g`);
    }
  };
}
