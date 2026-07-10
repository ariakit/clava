import { describe, expect, test } from "vitest";
import { htmlStyleToStyleValue } from "../src/utils.ts";

describe("htmlStyleToStyleValue", () => {
  test("preserves semicolons in data URLs", () => {
    const style = htmlStyleToStyleValue(
      "background-image: url(data:image/svg+xml;charset=UTF-8,<svg></svg>); color: red;",
    );

    expect(style).toEqual({
      backgroundImage: "url(data:image/svg+xml;charset=UTF-8,<svg></svg>)",
      color: "red",
    });
  });

  test("preserves semicolons in quoted custom properties", () => {
    const style = htmlStyleToStyleValue(
      "--tokens: 'primary;secondary'; color: red;",
    );

    expect(style).toEqual({
      "--tokens": "'primary;secondary'",
      color: "red",
    });
  });

  test("preserves semicolons after escaped quotes", () => {
    const style = htmlStyleToStyleValue(
      'content: "say \\"hello;world\\""; color: red;',
    );

    expect(style).toEqual({
      content: '"say \\"hello;world\\""',
      color: "red",
    });
  });

  test("preserves semicolons in comments and escapes", () => {
    const style = htmlStyleToStyleValue(
      "--token: primary\\;secondary; color: red /* fallback; keep */;",
    );

    expect(style).toEqual({
      "--token": "primary\\;secondary",
      color: "red /* fallback; keep */",
    });
  });

  test.each([
    [
      "quote",
      '--token: "primary; color: red;',
      { "--token": '"primary; color: red;' },
    ],
    [
      "parenthesis",
      "background: url(data:image/svg+xml; color: red;",
      { background: "url(data:image/svg+xml; color: red;" },
    ],
    [
      "comment",
      "color: red /* fallback; display: block;",
      { color: "red /* fallback; display: block;" },
    ],
  ])("preserves a value with an unterminated %s", (_, input, expected) => {
    expect(htmlStyleToStyleValue(input)).toEqual(expected);
  });
});
