import { expect, test } from "vitest";
import packageJson from "./package.json" with { type: "json" };
import config, { external } from "./rolldown.config.ts";

test("externalizes published dependencies", () => {
  expect(external).toEqual(Object.keys(packageJson.dependencies ?? {}));
  expect(config.external).toEqual(external);
});
