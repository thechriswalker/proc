import { execSync } from "child_process";
import { AppVersionInfo } from "./config";

export function loadVersionInfo(vcs: boolean = false): AppVersionInfo {
  interface Pjson {
    name: string;
    version: string;
  }
  const info: AppVersionInfo = {
    name: "app",
    version: "0.0.0",
    commit: "<unknown>",
    buildDate: new Date().toISOString(),
    dirty: true
  };
  try {
    const { name, version } = require(process.cwd() + "/package.json") as Pjson;
    info.name = name;
    info.version = version;
  } catch (e) {
    // ignore
  }

  try {
    info.commit = shell("git rev-parse HEAD");
  } catch (e) {
    // ignore
  }

  try {
    info.dirty = shell("git describe --always --dirty").endsWith("-dirty");
  } catch (e) {
    // ignore
  }

  try {
    info.buildDate = new Date(
      shell("git log -n1 --format=%aI HEAD")
    ).toISOString();
  } catch (e) {
    // ignore
  }

  return info;
}

function shell(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}
