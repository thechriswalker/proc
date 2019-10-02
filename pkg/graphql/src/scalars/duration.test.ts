import { deserialize, serialize } from "./duration";

describe("scalar duration", () => {
  it.each`
    duration      | value
    ${"10h"}      | ${10 * 3600e3}
    ${"1s 500ms"} | ${1500}
    ${"1h1ms"}    | ${3600e3 + 1}
    ${"-1.5m"}    | ${-90e3}
    ${"0.5ms"}    | ${0}
  `("should parse $duration => $value", ({ duration, value }) => {
    expect(deserialize(duration)).toBe(value);
  });

  it.each`
    duration        | desc
    ${" 1s"}        | ${"leading space"}
    ${"1s  2h"}     | ${"invalid separator"}
    ${"one second"} | ${"plain wrong"}
    ${"1h-1.5s"}    | ${"negative not leading"}
    ${"1.1h 1..4s"} | ${"invalid numeric"}
  `("should throw on invalid duration ($desc): $duration", ({ duration }) => {
    expect(() => deserialize(duration)).toThrow();
  });

  it.each`
    input                       | output
    ${1e3}                      | ${"1s"}
    ${0}                        | ${"0s"}
    ${500}                      | ${"500ms"}
    ${3600e3 + 60e3 + 5e3 + 25} | ${"1h 1m 5s 25ms"}
  `("should serialize $input => $output", ({ input, output }) => {
    expect(serialize(input)).toBe(output);
  });
});
