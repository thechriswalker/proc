// we assume that jest is run from the package dir.
// This is what allows us to share this config.
const rootDir = process.cwd();

module.exports = {
  rootDir,
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
