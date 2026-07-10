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

  test.each([
    ["url(/assets/*)", "url(/assets/*)"],
    ["url(/assets/*/image.png)", "url(/assets/*/image.png)"],
    ["URL(/assets/*)", "URL(/assets/*)"],
    ["\\75rl(/assets/*)", "\\75rl(/assets/*)"],
    ["url(/assets/image\\).png)", "url(/assets/image\\).png)"],
    ["<!--url(/assets/*)", "<!--url(/assets/*)"],
    ["\\\\<!--url(/assets/*)", "\\\\<!--url(/assets/*)"],
  ])("preserves raw URL contents in %s", (input, value) => {
    const style = htmlStyleToStyleValue(
      `background-image: ${input}; color: red;`,
    );

    expect(style).toEqual({
      backgroundImage: value,
      color: "red",
    });
  });

  test("preserves quoted URL contents", () => {
    const style = htmlStyleToStyleValue(
      'background-image: url(\f"/assets/*);image.png" ); color: red;',
    );

    expect(style).toEqual({
      backgroundImage: 'url(\f"/assets/*);image.png" )',
      color: "red",
    });
  });

  test.each(["@url", "#url", "\\@url", "\0url", "\\<!--url"])(
    "does not treat %s as a URL token",
    (functionName) => {
      const style = htmlStyleToStyleValue(
        `--token: ${functionName}(/* );still */ value); color: red;`,
      );

      expect(style).toEqual({
        "--token": `${functionName}(/* );still */ value)`,
        color: "red",
      });
    },
  );

  test("preserves comments inside non-URL functions", () => {
    const style = htmlStyleToStyleValue(
      "width: calc(1px /* don't; use */ + 2px); color: red;",
    );

    expect(style).toEqual({
      width: "calc(1px /* don't; use */ + 2px)",
      color: "red",
    });
  });

  test.each([
    ["square", "[one;two]"],
    ["curly", "{one;two}"],
    ["mismatched square", "[one);two]"],
    ["nested mismatched", "([one};two])"],
  ])("preserves semicolons inside %s blocks", (_, value) => {
    const style = htmlStyleToStyleValue(`--token: ${value}; color: red;`);

    expect(style).toEqual({
      "--token": value,
      color: "red",
    });
  });

  test("preserves mismatched blocks beyond the numeric stack", () => {
    const value = `${"[".repeat(27)})${"]".repeat(26)};still]`;
    const style = htmlStyleToStyleValue(`--token: ${value}; color: red;`);

    expect(style).toEqual({
      "--token": value,
      color: "red",
    });
  });

  test.each([
    ["line feed", "\n"],
    ["carriage return", "\r"],
    ["form feed", "\f"],
  ])("terminates strings at an unescaped %s", (_, newline) => {
    const style = htmlStyleToStyleValue(`content: "foo${newline}; color: red;`);

    expect(style).toEqual({
      content: '"foo',
      color: "red",
    });
  });

  test.each([
    ["line feed", "\n"],
    ["carriage return and line feed", "\r\n"],
  ])("preserves escaped %s inside strings", (_, newline) => {
    const value = `"foo\\${newline};bar"`;
    const style = htmlStyleToStyleValue(`content: ${value}; color: red;`);

    expect(style).toEqual({
      content: value,
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
