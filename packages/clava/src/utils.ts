import type * as CSS from "csstype";
import type {
  HTMLCSSProperties,
  JSXCSSProperties,
  StyleValue,
} from "./types.ts";

export const MODES = ["jsx", "html", "htmlObj"] as const;
export type Mode = (typeof MODES)[number];

/**
 * Returns the appropriate class property name based on the mode.
 * @example
 * getClassPropertyName("jsx") // "className"
 * getClassPropertyName("html") // "class"
 */
export function getClassPropertyName(mode: Mode) {
  return mode === "jsx" ? "className" : "class";
}

/**
 * Converts a hyphenated CSS property name to camelCase.
 * @example
 * hyphenToCamel("background-color") // "backgroundColor"
 * hyphenToCamel("--custom-var") // "--custom-var" (CSS variables are preserved)
 */
export function hyphenToCamel(str: string) {
  // CSS custom properties (variables) should not be converted
  if (str.startsWith("--")) {
    return str;
  }
  return str.replace(/-([a-z])/gi, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase CSS property name to hyphenated form.
 * @example
 * camelToHyphen("backgroundColor") // "background-color"
 * camelToHyphen("--customVar") // "--customVar" (CSS variables are preserved)
 */
export function camelToHyphen(str: string) {
  // CSS custom properties (variables) should not be converted
  if (str.startsWith("--")) {
    return str;
  }
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Parses a length value, adding "px" if it's a number.
 * @example
 * parseLengthValue(16); // "16px"
 * parseLengthValue("2em"); // "2em"
 */
export function parseLengthValue(value: string | number) {
  if (typeof value === "string") return value;
  return `${value}px`;
}

/**
 * Parses a CSS style string into a StyleValue object.
 * @example
 * htmlStyleToStyleValue("background-color: red; font-size: 16px;");
 * // { backgroundColor: "red", fontSize: "16px" }
 */
export function htmlStyleToStyleValue(styleString: string) {
  if (!styleString) return {};

  const result: StyleValue = {};
  const declarations = styleString.split(";");

  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const property = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (!property) continue;
    if (!value) continue;

    const camelProperty = hyphenToCamel(property) as any;
    result[camelProperty] = value;
  }

  return result;
}

/**
 * Converts a hyphenated style object to a camelCase StyleValue object.
 * @example
 * htmlObjStyleToStyleValue({ "background-color": "red", "font-size": "16px" });
 * // { backgroundColor: "red", fontSize: "16px" }
 */
export function htmlObjStyleToStyleValue(style: HTMLCSSProperties) {
  const result: StyleValue = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    const property = hyphenToCamel(key) as any;
    result[property] = parseLengthValue(value);
  }
  return result;
}

/**
 * Converts a camelCase style object to a StyleValue object.
 * @example
 * jsxStyleToStyleValue({ backgroundColor: "red", fontSize: 16 });
 * // { backgroundColor: "red", fontSize: "16px" }
 */
export function jsxStyleToStyleValue(style: JSXCSSProperties) {
  const result: StyleValue = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    result[key as any] = parseLengthValue(value);
  }
  return result;
}

/**
 * Converts a StyleValue object to a CSS style string.
 * @example
 * styleValueToHTMLStyle({ backgroundColor: "red", fontSize: "16px" });
 * // "background-color: red; font-size: 16px;"
 */
export function styleValueToHTMLStyle(style: StyleValue): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    parts.push(`${camelToHyphen(key)}: ${value}`);
  }
  if (!parts.length) return "";
  return `${parts.join("; ")};`;
}

/**
 * Converts a StyleValue object to a hyphenated style object.
 * @example
 * styleValueToHTMLObjStyle({ backgroundColor: "red", fontSize: "16px" });
 * // { "background-color": "red", "font-size": "16px" }
 */
export function styleValueToHTMLObjStyle(style: StyleValue) {
  const result: CSS.PropertiesHyphen = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    const property = camelToHyphen(key) as keyof HTMLCSSProperties;
    result[property] = value;
  }
  return result;
}

/**
 * Converts a StyleValue object to a camelCase style object.
 * @example
 * styleValueToJSXStyle({ backgroundColor: "red", fontSize: "16px" });
 * // { backgroundColor: "red", fontSize: "16px" }
 */
export function styleValueToJSXStyle(style: StyleValue) {
  return style as JSXCSSProperties;
}

/**
 * Type guard to check if a style object has hyphenated keys.
 * @example
 * isHTMLObjStyle({ "background-color": "red" }); // true
 * isHTMLObjStyle({ backgroundColor: "red" }); // false
 */
export function isHTMLObjStyle(
  style: CSS.Properties<any> | CSS.PropertiesHyphen<any>,
): style is CSS.PropertiesHyphen {
  return Object.keys(style).some(
    (key) => key.includes("-") && !key.startsWith("--"),
  );
}
