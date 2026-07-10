import { expect, test } from "vitest";
import { camelToHyphen, hyphenToCamel } from "../src/utils.ts";

test("round trips Microsoft-prefixed CSS properties", () => {
  expect(camelToHyphen("msTransition")).toBe("-ms-transition");
  expect(hyphenToCamel("-ms-transition")).toBe("msTransition");
  expect(hyphenToCamel(camelToHyphen("msTransition"))).toBe("msTransition");
});

test("keeps other vendor prefixes capitalized", () => {
  expect(camelToHyphen("WebkitTransition")).toBe("-webkit-transition");
  expect(hyphenToCamel("-webkit-transition")).toBe("WebkitTransition");
  expect(hyphenToCamel("-moz-appearance")).toBe("MozAppearance");
});

test("does not treat ms-like names as the Microsoft prefix", () => {
  expect(camelToHyphen("msoTableLspace")).toBe("mso-table-lspace");
  expect(hyphenToCamel("foo-ms-bar")).toBe("fooMsBar");
  expect(hyphenToCamel("-msfoo")).toBe("Msfoo");
});

test("preserves CSS custom properties with Microsoft-like prefixes", () => {
  expect(camelToHyphen("--msTransition")).toBe("--msTransition");
  expect(hyphenToCamel("--ms-transition")).toBe("--ms-transition");
});
