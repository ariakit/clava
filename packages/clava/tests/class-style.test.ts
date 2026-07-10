import { describe, expect, expectTypeOf, test } from "vitest";
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
  getModeComponent,
  getStyleClass,
} from "./_utils.ts";

for (const config of [CONFIGS.default, CONFIGS.uppercase]) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("style has correct shape for mode", () => {
      const component = getModeComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertDefaultProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style.backgroundColor).toBe("red");
      expectTypeOf(props).toEqualTypeOf<StyleClassProps>();
      expectTypeOf(props.style).toEqualTypeOf<StyleValue>();
    });

    test("no argument still returns normalized shape", () => {
      const component = getModeComponent(mode, cv());
      const props = component();
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
      const component = getModeComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertJSXProps(props);
      expect(props).not.toHaveProperty("class");
      expect(props.className).toBe(cls("base"));
      expect(props.style.backgroundColor).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<JSXCSSProperties>();
    });

    test("no argument still returns jsx shape", () => {
      const component = getModeComponent(mode, cv());
      const props = component();
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
      const component = getModeComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertHTMLProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style).toBe("background-color: red;");
    });

    test("no argument still returns html shape", () => {
      const component = getModeComponent(mode, cv());
      const props = component();
      assertHTMLProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe("");
      expect(props.style).toBe("");
    });

    test("numeric style values use property-aware units", () => {
      const component = getModeComponent(mode, cv());
      const props = component({
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
      const component = getModeComponent(
        mode,
        cv({ class: "base", style: { backgroundColor: "red" } }),
      );
      const props = component();
      assertHTMLObjProps(props);
      expect(props).not.toHaveProperty("className");
      expect(props.class).toBe(cls("base"));
      expect(props.style["background-color"]).toBe("red");
      expectTypeOf(props.style).toEqualTypeOf<HTMLCSSProperties>();
    });

    test("no argument still returns htmlObj shape", () => {
      const component = getModeComponent(mode, cv());
      const props = component();
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
      const component = getModeComponent(mode, cv());
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("null class", () => {
      const component = getModeComponent(mode, cv({ class: null }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("empty array class", () => {
      const component = getModeComponent(mode, cv({ class: [] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("string class", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("nested array class", () => {
      const component = getModeComponent(
        mode,
        cv({ class: ["foo", ["bar", ["baz"]]] }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("nested array class with falsy values", () => {
      const component = getModeComponent(
        mode,
        cv({ class: ["foo", null, ["bar", false, ["baz", 0]]] }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz") });
    });

    test("merge class from props", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge className from props", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component({ className: "baz qux" });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar baz qux") });
    });

    test("merge class and className from props", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: "baz qux", className: "quux corge" });
      expect(getStyleClass(props)).toEqual({
        class: cls("foo bar baz qux quux corge"),
      });
    });

    test("merge null class from props", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component({ class: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("merge null className from props", () => {
      const component = getModeComponent(mode, cv({ class: "foo bar" }));
      const props = component({ className: null });
      expect(getStyleClass(props)).toEqual({ class: cls("foo bar") });
    });

    test("empty style", () => {
      const component = getModeComponent(mode, cv({ style: {} }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("style with properties", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red", fontSize: "16px" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("style does not accept numbers", () => {
      const component = getModeComponent(
        mode,
        cv({
          style: {
            backgroundColor: "red",
            // @ts-expect-error
            fontSize: 16,
          },
        }),
      );
      const props = component();
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
      const component = getModeComponent(mode, cv({ style }));
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        "--custom-var": "value",
        "--custom-number": mode === "html" ? "1" : 1,
      });
    });

    test("merge style from props", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { fontSize: "16px" } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge jsx style from props", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { fontSize: 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge html style from props", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: "font-size: 16px" });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge htmlObj style from props", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: { "font-size": 16 } });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
        fontSize: "16px",
      });
    });

    test("merge null style from props", () => {
      const component = getModeComponent(
        mode,
        cv({ style: { backgroundColor: "red" } }),
      );
      const props = component({ style: null });
      expect(getStyleClass(props)).toEqual({
        class: "",
        backgroundColor: "red",
      });
    });
  });
}
