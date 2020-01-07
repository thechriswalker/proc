// influx uses an HTTP call.
// so we will import got.
import { Context } from "@proc/context";
import { MetricName, MetricsPlugin } from "@proc/context-metrics";
import got from "got";
import { URL } from "url";

export function createInfluxDBMetrics<Ctx extends Context>(
  writeUrl: URL,
  token: string,
  onError?: (ctx: Ctx, line: string, err: Error) => void
): MetricsPlugin<Ctx> {
  // we assume `org` and `bucket` are already set in write url.
  if (!writeUrl.searchParams.has("org")) {
    throw new SyntaxError("InfluxDB Write URL expected param `org`");
  }
  if (!writeUrl.searchParams.has("bucket")) {
    throw new SyntaxError("InfluxDB Write URL expected param `bucket`");
  }
  // overwrite precision.
  writeUrl.searchParams.set("precision", "ms"); // timestamp precision

  function send(ctx: Ctx, line: string) {
    // ctx.log.debug("INFLUX", line);
    got
      .post(writeUrl, {
        headers: { authorization: `Token ${token}` },
        body: line
      })
      .catch(err => {
        if (onError) {
          onError(ctx, line, err);
        }
      });
  }

  return {
    inc(ctx, name) {
      send(ctx, `${influxName(name)} v=1u ${Date.now()}\n`);
    },
    gauge(ctx, name, value) {
      send(ctx, `${influxName(name)} v=${value} ${Date.now()}\n`);
    },
    timing(ctx, name, ms) {
      send(ctx, `${influxName(name)} v=${Math.floor(ms)}u ${Date.now()}\n`);
    }
  };
}

const influxNameCache = new WeakMap<MetricName, string>();
function influxName(name: MetricName): string {
  let s = influxNameCache.get(name);
  if (!s) {
    const tags = name.tags.slice().sort(); // lexical sort.
    s = tags.reduce<string>((p, [k, v]) => {
      // naive, if values are not simple (need quoting)
      return p + "," + k + "=" + v;
    }, name.measurement);
    influxNameCache.set(name, s);
  }
  return s;
}
