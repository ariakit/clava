import { expect, test } from "vitest";
import config, { external } from "./rolldown.config.ts";

test("externalizes published dependencies", () => {
  expect(external).toEqual(["clsx", "csstype"]);
  expect(config.external).toEqual(external);
});
