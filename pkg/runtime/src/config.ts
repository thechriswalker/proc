import { Configuration, createConfiguration } from "@proc/configuration";
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "path";
import { loadVersionInfo } from "./version";

export interface AppVersionInfo {
  name: string;
  version: string; // semver
  commit: string; // vcs identifier
  dirty: boolean; // vcs dirty index?
  buildDate: string;
}

export function initConfiguration(
  info: AppVersionInfo = loadVersionInfo()
): [Configuration, AppVersionInfo] {
  // the dotenv config is read from process.
  const dotenvConfigPath = process.env.DOTENV_CONFIG_PATH || "./.env";
  // this reads and parses the dotenv file
  const dotCfg = dotenvConfig({ path: dotenvConfigPath });
  // if it just doesn't exist then that's fine.
  const error = dotCfg.error;
  if (error) {
    if ((error as any).code === "ENOENT") {
      // this means could no .env file.
      // which is OK.
      // tslint:disable no-console
      console.error(`[@proc/runtime][WARN] ${error.message}`);
    } else {
      // this could be more serious so we throw
      throw error;
    }
  }

  const basePath = dirname(resolve(dotenvConfigPath));

  // we pre-process the dot-config for file:// or base64:// data and convert on the fly
  // but file data needs an absolute path.
  const baseFileUrl = `file://${basePath}/`;
  const preProcessed = Object.fromEntries(
    Object.entries(dotCfg.parsed || {}).map(([k, v]) => {
      if (v.startsWith("file://")) {
        v = new URL(v, baseFileUrl).href;
      }
      return [k, v];
    })
  );

  // order of object is important
  const source = Object.assign(
    {
      APP_NAME: info.name,
      APP_VERSION: info.version,
      VCS_COMMIT: info.commit,
      VCS_DIRTY: info.dirty ? "true" : "false",
      APP_BUILD_DATE: info.buildDate
    },
    preProcessed,
    process.env,
    {
      // NB: We use APP_ENV for the runtime environment, because we generally want
      // all other libraries and builds to believe this is production (NODE_ENV) but
      // we may actually be in a different environment, such as "staging"
      APP_ENV: process.env.NODE_ENV || "development"
    }
  );

  return [createConfiguration(source), info];
}
