import { Configuration, createConfiguration } from "@proc/configuration";
import { config as dotenvConfig } from "dotenv";
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
  // this reads and parses the dotenv file
  const dotCfg = dotenvConfig();
  if (dotCfg.error) {
    throw dotCfg.error;
  }
  // order of object is important
  const source = Object.assign(
    {
      APP_NAME: info.name,
      APP_VERSION: info.version,
      VCS_COMMIT: info.commit,
      VCS_DIRTY: info.dirty ? "true" : "false",
      APP_BUILD_DATE: info.buildDate
    },
    dotCfg.parsed || {},
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
