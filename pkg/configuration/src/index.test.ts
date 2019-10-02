import { createConfiguration, validBooleanStrings } from "./index";

describe("Configuration", () => {
  it("String Values", () => {
    const src = {
      full: "some string",
      empty: ""
    };
    const c = createConfiguration(src);

    expect(c.getString("full")).toBe(src.full);
    expect(c.getString("full", "fallback")).toBe(src.full);
    expect(c.getString("empty")).toBe(src.empty);
    expect(c.getString("empty", "fallback")).toBe(src.empty);
    expect(c.getString("missing", "fallback")).toBe("fallback");
    expect(() => c.getString("missing")).toThrowErrorMatchingSnapshot();
  });

  it("Integer Values", () => {
    const src = {
      valid: "123",
      zero: "0",
      too_big: Number.MAX_SAFE_INTEGER.toString() + "0",
      empty: "",
      float: "1.23",
      invalid: "invalid"
    };
    const c = createConfiguration(src);
    expect(c.getInteger("valid")).toBe(123);
    expect(c.getInteger("valid", 1)).toBe(123);
    expect(c.getInteger("zero")).toBe(0);
    expect(c.getInteger("zero", 1)).toBe(0);
    expect(() => c.getInteger("too_big")).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("too_big", 1)).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("empty")).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("empty", 1)).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("float")).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("float", 1)).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("missing")).toThrowErrorMatchingSnapshot();
    expect(c.getInteger("missing", 1)).toBe(1);
    expect(() => c.getInteger("invalid")).toThrowErrorMatchingSnapshot();
    expect(() => c.getInteger("invalid", 1)).toThrowErrorMatchingSnapshot();
  });

  it("Float Values", () => {
    const src = {
      valid: "12.3",
      zero: "0",
      exp: "1.2345e-10",
      empty: "",
      inf: "Infinity",
      invalid: "not a float"
    };
    const c = createConfiguration(src);
    expect(c.getFloat("valid")).toBe(12.3);
    expect(c.getFloat("valid", 0.1)).toBe(12.3);
    expect(c.getFloat("zero")).toBe(0);
    expect(c.getFloat("zero", 0.1)).toBe(0);
    expect(c.getFloat("exp")).toBe(1.2345e-10);
    expect(c.getFloat("exp", 3.1415)).toBe(1.2345e-10);
    expect(() => c.getFloat("empty")).toThrowErrorMatchingSnapshot();
    expect(() => c.getFloat("empty", 3.1415)).toThrowErrorMatchingSnapshot();
    expect(() => c.getFloat("invalid")).toThrowErrorMatchingSnapshot();
    expect(() => c.getFloat("invalid", 3.1415)).toThrowErrorMatchingSnapshot();
    expect(c.getFloat("inf")).toBe(Infinity);
    expect(c.getFloat("inf", 0.1)).toBe(Infinity);
    expect(() => c.getFloat("missing")).toThrowErrorMatchingSnapshot();
    expect(c.getFloat("missing", 1.2)).toBe(1.2);
  });

  it("Boolean Values", () => {
    const keys = Object.keys(validBooleanStrings);
    const src = keys.reduce<{
      [key: string]: string;
    }>(
      (m, k) => {
        m["conf_" + k] = k;
        return m;
      },
      {
        invalid: "is this truthy?"
      }
    );
    const c = createConfiguration(src);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const expectedValue = validBooleanStrings[key];

      expect(c.getBoolean("conf_" + key)).toBe(expectedValue);
      expect(c.getBoolean("conf_" + key, !expectedValue)).toBe(expectedValue);
    }

    expect(() => c.getBoolean("invalid")).toThrowErrorMatchingSnapshot();
    expect(() => c.getBoolean("invalid", true)).toThrowErrorMatchingSnapshot();

    expect(() => c.getBoolean("missing")).toThrowErrorMatchingSnapshot();
    expect(c.getBoolean("missing", true)).toBe(true);
  });
});
