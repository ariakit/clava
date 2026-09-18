import { describe, expect, expectTypeOf, test } from "vitest";
import { cv } from "../src/index.ts";
import type {
  HTMLCSSProperties,
  JSXCSSProperties,
  StyleClassProps,
  StyleValue,
} from "../src/types.ts";
import {
  CONFIGS,
  assertDefaultProps,
  assertHTMLObjProps,
  assertHTMLProps,
  assertJSXProps,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeRecipe,
  getStyleClass,
} from "./_utils.ts";

test("serializes Microsoft-prefixed properties through public modes", () => {
  const recipe = cv({ style: { msTransition: "none" } });
  expect(recipe.html().style).toBe("-ms-transition: none;");
  expect(recipe.htmlObj().style).toEqual({ "-ms-transition": "none" });
});

test("parses Microsoft-prefixed properties through public inputs", () => {
  const recipe = cv();
  expect(recipe({ style: "-ms-transition: none" }).style).toEqual({
    msTransition: "none",
  });
  expect(recipe({ style: { "-ms-transition": "none" } }).style).toEqual({
    msTransition: "none",
  });
});

// Guards the `StyleProperty` union shape. If its only indexed member were a
// property-less index signature, TypeScript would skip the weak type check
// and accept any widened style object.
// https://github.com/ariakit/clava/issues/483#issuecomment-5447514407
test("rejects invalid style values from widened objects", () => {
  const widenedStyle = { color: 1 };
  cv().jsx({
    // @ts-expect-error `color` does not accept a number
    style:
      // no error
      widenedStyle,
  });
});

for (const config of [CONFIGS.default, CONFIGS.uppercase]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = recipe();
      assertDefaultProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style.backgroundColor).toBe("red");
      expectTypeOf(props).toEqualTypeOf<StyleClassProps>();
      expectTypeOf(props.style).toEqualTypeOf<StyleValue>();
    });

    test("no argument still returns normalized shape", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe();
      assertDefaultProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toEqual({});
      expectTypeOf(props).toEqualTypeOf<StyleClassProps>();
      expectTypeOf(props.style).toEqualTypeOf<StyleValue>();
    });
  });
}

for (const config of [CONFIGS.jsx]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = recipe();
      assertJSXProps(props);
      expect(props).not.toHaveProperty("class");
      expect(props.className).toBe(cls("base"));
      expect(props.style.backgroundColor).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
    });

    test("no argument still returns jsx shape", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe();
      assertJSXProps(props);
      expect(props).not.toHaveProperty("class");
      expect(props.className).toBe("");
      expect(props.style).toEqual({});
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
    });

    test("numeric style values use property-aware units", () => {
      const props = cv().jsx({
        style: {
          opacity: 0.5,
          zIndex: 2,
          lineHeight: 1.5,
          flexGrow: 1,
          WebkitLineClamp: 2,
          msFlexPositive: 1,
          "--columns": 3,
          marginTop: 4,
        },
      });
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
      expect(props.style).toEqual({
        opacity: 0.5,
        zIndex: 2,
        lineHeight: 1.5,
        flexGrow: 1,
        WebkitLineClamp: 2,
        msFlexPositive: 1,
        "--columns": 3,
        marginTop: "4px",
      });
    });
  });
}

for (const config of [CONFIGS.html]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = recipe();
      assertHTMLProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style).toBe("background-color: red;");
    });

    test("no argument still returns html shape", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe();
      assertHTMLProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toBe("");
    });

    test("numeric style values use property-aware units", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe({
        style: { opacity: 0.5, "--columns": 3, marginTop: 4 },
      });
      expect(props.style).toBe("opacity: 0.5; --columns: 3; margin-top: 4px;");
    });
  });
}

for (const config of [CONFIGS.htmlObj]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = recipe();
      assertHTMLObjProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style["background-color"]).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
    });

    test("no argument still returns htmlObj shape", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe();
      assertHTMLObjProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toEqual({});
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
    });

    test("numeric style values use property-aware units", () => {
      const props = cv().htmlObj({
        style: {
          opacity: 0.5,
          "z-index": 2,
          "line-height": 1.5,
          "flex-grow": 1,
          "-webkit-line-clamp": 2,
          "-ms-flex-positive": 1,
          "--columns": 3,
          "margin-top": 4,
        },
      });
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
      expect(props.style).toEqual({
        opacity: 0.5,
        "z-index": 2,
        "line-height": 1.5,
        "flex-grow": 1,
        "-webkit-line-clamp": 2,
        "-ms-flex-positive": 1,
        "--columns": 3,
        "margin-top": "4px",
      });
    });
  });
}

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("no argument", () => {
      const recipe = getModeRecipe(mode, cv());
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("null class", () => {
      const recipe = getModeRecipe(mode, cv({ class: null }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("empty array class", () => {
      const recipe = getModeRecipe(mode, cv({ class: [] }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("string class", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("nested array class", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: ["foo", ["bar", ["baz"]]] }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("nested array class with falsy values", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ class: ["foo", null, ["bar", false, ["baz", 0]]] }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("merge class from props", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe({ class: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge className from props", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe({ className: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge class and className from props", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe({ class: "baz qux", className: "quux corge" });
      expect(getStyleClass(props)).toEqual({
        class: cls("foo bar baz qux quux corge"),
      });
    });

    test("merge null class from props", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe({ class: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("merge null className from props", () => {
      const recipe = getModeRecipe(mode, cv({ class: "foo bar" }));
      const props = recipe({ className: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("empty style", () => {
      const recipe = getModeRecipe(mode, cv({ style: {} }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("style with properties", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red", fontSize: "16px" } }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("style does not accept numbers", () => {
      const recipe = getModeRecipe(
        mode,
        cv({
          style: {
            backgroundColor: "red",
            // @ts-expect-error
            fontSize: 16,
          },
        }),
      );
      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: expect.toBeOneOf(["16", "16px"]),
      });
    });

    test("style with custom property", () => {
      const style = {
        backgroundColor: "red",
        "--custom-var": "value",
        "--custom-number": 1,
      } satisfies StyleValue;
      const recipe = getModeRecipe(mode, cv({ style }));
      const props = recipe();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        "--custom-var": "value",
        "--custom-number": mode === "html" ? "1" : 1,
      });
    });

    test("merge style from props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = recipe({ style: { fontSize: "16px" } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge jsx style from props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = recipe({ style: { fontSize: 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge html style from props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = recipe({ style: "font-size: 16px" });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge htmlObj style from props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = recipe({ style: { "font-size": 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge null style from props", () => {
      const recipe = getModeRecipe(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = recipe({ style: null });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
      });
    });
  });
}
