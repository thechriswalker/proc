import { execSync } from "child_process";
import { AppVersionInfo } from "./config";

export function loadVersionInfo(vcs: boolean = false): AppVersionInfo {
  interface Pjson {
    name: string;
  }
  const info: AppVersionInfo = {
    name: "app",
    version: "0.0.0",
    commit: "<unknown>",
    buildDate: new Date().toISOString(),
    dirty: true
  };
  try {
    const { name } = require(process.cwd() + "/package.json") as Pjson;
    info.name = name;
  } catch {}

  try {
    info.commit = shell("git rev-parse HEAD");
  } catch {}

  try {
    info.version = shell("git describe --tags --always --dirty");
    info.dirty = info.version.endsWith("-dirty");
  } catch {}

  try {
    info.buildDate = new Date(
      shell("git log -n1 --format=%aI HEAD")
    ).toISOString();
  } catch {}

  return info;
}

function shell(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}
