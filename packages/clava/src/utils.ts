import type * as CSS from "csstype";
import type {
  HTMLCSSProperties,
  JSXCSSProperties,
  StyleValue,
} from "./types.ts";

export const MODES = ["jsx", "html", "htmlObj"] as const;
export type Mode = (typeof MODES)[number];

// eslint-disable-next-line @typescript-eslint/unbound-method
const hasOwn = Object.prototype.hasOwnProperty;

function isAsciiLetter(code: number) {
  if (code >= 65 && code <= 90) return true;
  return code >= 97 && code <= 122;
}

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
  if (str.length >= 2 && str.charCodeAt(0) === 45 && str.charCodeAt(1) === 45) {
    return str;
  }
  // Fast path: no hyphen -> return as-is
  let hyphenIndex = str.indexOf("-");
  if (hyphenIndex === -1) return str;

  let result = "";
  let lastIndex = 0;
  while (hyphenIndex !== -1) {
    result += str.slice(lastIndex, hyphenIndex);

    const nextIndex = hyphenIndex + 1;
    if (nextIndex >= str.length) {
      result += "-";
      lastIndex = nextIndex;
      break;
    }

    const code = str.charCodeAt(nextIndex);
    if (isAsciiLetter(code)) {
      result += str[nextIndex].toUpperCase();
      lastIndex = nextIndex + 1;
    } else {
      result += "-";
      lastIndex = nextIndex;
    }

    hyphenIndex = str.indexOf("-", lastIndex);
  }

  return result + str.slice(lastIndex);
}

/**
 * Converts a camelCase CSS property name to hyphenated form.
 * @example
 * camelToHyphen("backgroundColor") // "background-color"
 * camelToHyphen("--customVar") // "--customVar" (CSS variables are preserved)
 */
export function camelToHyphen(str: string) {
  // CSS custom properties (variables) should not be converted
  if (str.length >= 2 && str.charCodeAt(0) === 45 && str.charCodeAt(1) === 45) {
    return str;
  }

  let result = "";
  let lastIndex = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 65 || code > 90) continue;
    result += str.slice(lastIndex, i);
    result += "-";
    result += str[i].toLowerCase();
    lastIndex = i + 1;
  }

  if (lastIndex === 0) return str;
  return result + str.slice(lastIndex);
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
  const len = styleString.length;
  let i = 0;
  while (i < len) {
    // Skip leading whitespace and stray semicolons
    while (i < len) {
      const c = styleString.charCodeAt(i);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13 && c !== 59) break;
      i++;
    }
    if (i >= len) break;
    // Read property name until ':' or ';'
    const propStart = i;
    while (i < len) {
      const c = styleString.charCodeAt(i);
      if (c === 58 || c === 59) break;
      i++;
    }
    if (i >= len || styleString.charCodeAt(i) === 59) {
      // No colon found - skip this declaration
      if (i < len) i++; // skip ';'
      continue;
    }
    let propEnd = i;
    // Trim trailing whitespace from property name
    while (propEnd > propStart) {
      const c = styleString.charCodeAt(propEnd - 1);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
      propEnd--;
    }
    if (propEnd === propStart) {
      // Empty property - skip
      while (i < len && styleString.charCodeAt(i) !== 59) i++;
      if (i < len) i++;
      continue;
    }
    const property = styleString.slice(propStart, propEnd);
    i++; // skip ':'
    // Skip whitespace before value
    while (i < len) {
      const c = styleString.charCodeAt(i);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
      i++;
    }
    const valStart = i;
    while (i < len && styleString.charCodeAt(i) !== 59) i++;
    let valEnd = i;
    while (valEnd > valStart) {
      const c = styleString.charCodeAt(valEnd - 1);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
      valEnd--;
    }
    if (i < len) i++; // skip ';'
    if (valEnd === valStart) continue;
    const value = styleString.slice(valStart, valEnd);
    // CSS property names and values are dynamic - cast required for index access
    (result as Record<string, string>)[hyphenToCamel(property)] = value;
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
  for (const key in style) {
    if (!hasOwn.call(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    // CSS property names and values are dynamic - cast required for index access
    (result as Record<string, string>)[hyphenToCamel(key)] = parseLengthValue(
      value as string | number,
    );
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
  for (const key in style) {
    if (!hasOwn.call(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    // CSS property names and values are dynamic - cast required for index access
    (result as Record<string, string>)[key] = parseLengthValue(
      value as string | number,
    );
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
  let result = "";
  for (const key in style) {
    if (!hasOwn.call(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    if (result) result += "; ";
    result += camelToHyphen(key);
    result += ": ";
    result += value as string | number;
  }
  if (!result) return "";
  return `${result};`;
}

/**
 * Converts a StyleValue object to a hyphenated style object.
 * @example
 * styleValueToHTMLObjStyle({ backgroundColor: "red", fontSize: "16px" });
 * // { "background-color": "red", "font-size": "16px" }
 */
export function styleValueToHTMLObjStyle(style: StyleValue) {
  const result: CSS.PropertiesHyphen = {};
  for (const key in style) {
    if (!hasOwn.call(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    (result as Record<string, unknown>)[camelToHyphen(key)] = value;
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
  for (const key in style) {
    if (!hasOwn.call(style, key)) continue;
    // Quick exclusion of CSS custom properties (--foo)
    if (
      key.length >= 2 &&
      key.charCodeAt(0) === 45 &&
      key.charCodeAt(1) === 45
    ) {
      continue;
    }
    if (key.indexOf("-") !== -1) return true;
  }
  return false;
}
