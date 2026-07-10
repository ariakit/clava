import { expect, test } from "vitest";
import { camelToHyphen, hyphenToCamel } from "../src/utils.ts";

test("round trips Microsoft-prefixed CSS properties", () => {
  expect(camelToHyphen("msTransition")).toBe("-ms-transition");
  expect(hyphenToCamel("-ms-transition")).toBe("msTransition");
  expect(hyphenToCamel(camelToHyphen("msTransition"))).toBe("msTransition");
});

test("preserves CSS custom properties with Microsoft-like prefixes", () => {
  expect(camelToHyphen("--msTransition")).toBe("--msTransition");
  expect(hyphenToCamel("--ms-transition")).toBe("--ms-transition");
});
