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

// Base-4 opener codes remain exactly representable through this depth.
const MAX_PACKED_BLOCK_DEPTH = 26;

function isAsciiLetter(code: number) {
  if (code >= 65 && code <= 90) return true;
  return code >= 97 && code <= 122;
}

function isCSSWhitespace(code: number) {
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function isCSSNewline(code: number) {
  return code === 10 || code === 12 || code === 13;
}

function isIdentifierCode(code: number) {
  if (isAsciiLetter(code)) return true;
  if (code >= 48 && code <= 57) return true;
  if (code === 45 || code === 95) return true;
  return code === 0 || code >= 128;
}

function getHexDigitValue(code: number) {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 70) return code - 55;
  if (code >= 97 && code <= 102) return code - 87;
  return -1;
}

function getUrlMatch(match: number, code: number) {
  const lowerCode = code | 32;
  if (match === 0 && lowerCode === 117) return 1;
  if (match === 1 && lowerCode === 114) return 2;
  if (match === 2 && lowerCode === 108) return 3;
  return 4;
}

function getEscapeEnd(styleString: string, index: number, end: number) {
  if (index + 1 >= end) return end;
  if (getHexDigitValue(styleString.charCodeAt(index + 1)) !== -1) {
    let escapeEnd = index + 1;
    let digits = 0;
    while (escapeEnd < end && digits < 6) {
      if (getHexDigitValue(styleString.charCodeAt(escapeEnd)) === -1) break;
      escapeEnd++;
      digits++;
    }
    const whitespace = styleString.charCodeAt(escapeEnd);
    if (isCSSWhitespace(whitespace)) {
      escapeEnd +=
        whitespace === 13 && styleString.charCodeAt(escapeEnd + 1) === 10
          ? 2
          : 1;
    }
    return escapeEnd;
  }
  if (
    styleString.charCodeAt(index + 1) === 13 &&
    styleString.charCodeAt(index + 2) === 10
  ) {
    return index + 3;
  }
  return index + 2;
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
  if (hyphenIndex === -1) {
    return str;
  }

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

  if (lastIndex === 0) {
    return str;
  }
  return result + str.slice(lastIndex);
}

/**
 * Parses a length value, adding "px" if it's a number.
 * @example
 * parseLengthValue(16); // "16px"
 * parseLengthValue("2em"); // "2em"
 */
export function parseLengthValue(value: string | number) {
  if (typeof value === "string") {
    return value;
  }
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
      if (c !== 59 && !isCSSWhitespace(c)) break;
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
      if (i < len) {
        // Skip ';'.
        i++;
      }
      continue;
    }
    let propEnd = i;
    // Trim trailing whitespace from property name
    while (propEnd > propStart) {
      const c = styleString.charCodeAt(propEnd - 1);
      if (!isCSSWhitespace(c)) break;
      propEnd--;
    }
    if (propEnd === propStart) {
      // Empty property - skip
      while (i < len && styleString.charCodeAt(i) !== 59) {
        i++;
      }
      if (i < len) {
        i++;
      }
      continue;
    }
    const property = styleString.slice(propStart, propEnd);
    // Skip ':'.
    i++;
    // Skip whitespace before value
    while (i < len) {
      const c = styleString.charCodeAt(i);
      if (!isCSSWhitespace(c)) break;
      i++;
    }
    const valStart = i;
    let quote = 0;
    let blockDepth = 0;
    let blockStack = 0;
    let blockOverflow: number[] | undefined;
    let urlMatch = 0;
    while (i < len) {
      const c = styleString.charCodeAt(i);
      if (quote) {
        if (c === 92) {
          i = getEscapeEnd(styleString, i, len);
          continue;
        }
        if (c === quote || isCSSNewline(c)) {
          quote = 0;
        }
        i++;
        continue;
      }
      if (c === 47 && styleString.charCodeAt(i + 1) === 42) {
        const commentEnd = styleString.indexOf("*/", i + 2);
        i = commentEnd === -1 ? len : commentEnd + 2;
        urlMatch = 0;
        continue;
      }
      if (c === 34 || c === 39) {
        quote = c;
        urlMatch = 0;
        i++;
        continue;
      }
      if (c === 92) {
        let escapeEnd = i + 1;
        if (escapeEnd >= len) {
          i = len;
          continue;
        }
        let escapedCode = styleString.charCodeAt(escapeEnd);
        if (isCSSNewline(escapedCode)) {
          urlMatch = 0;
          i = getEscapeEnd(styleString, i, len);
          continue;
        }
        if (getHexDigitValue(escapedCode) !== -1) {
          escapedCode = 0;
          let digits = 0;
          while (escapeEnd < len && digits < 6) {
            const digitValue = getHexDigitValue(
              styleString.charCodeAt(escapeEnd),
            );
            if (digitValue === -1) break;
            escapedCode = escapedCode * 16 + digitValue;
            escapeEnd++;
            digits++;
          }
          const whitespace = styleString.charCodeAt(escapeEnd);
          if (isCSSWhitespace(whitespace)) {
            escapeEnd +=
              whitespace === 13 && styleString.charCodeAt(escapeEnd + 1) === 10
                ? 2
                : 1;
          }
        } else {
          escapeEnd++;
        }
        urlMatch = getUrlMatch(urlMatch, escapedCode);
        i = escapeEnd;
        continue;
      }
      if (c === 40) {
        let nextIndex = i + 1;
        while (
          nextIndex < len &&
          isCSSWhitespace(styleString.charCodeAt(nextIndex))
        ) {
          nextIndex++;
        }
        const next = styleString.charCodeAt(nextIndex);
        if (urlMatch === 3 && next !== 34 && next !== 39) {
          i++;
          while (i < len) {
            const urlChar = styleString.charCodeAt(i);
            if (urlChar === 92) {
              i = getEscapeEnd(styleString, i, len);
              continue;
            }
            i++;
            if (urlChar === 41) break;
          }
          urlMatch = 0;
          continue;
        }
        if (blockDepth < MAX_PACKED_BLOCK_DEPTH) {
          blockStack = blockStack * 4 + 1;
        } else {
          (blockOverflow ||= []).push(1);
        }
        blockDepth++;
        urlMatch = 0;
        i++;
        continue;
      }
      if (
        c === 60 &&
        styleString.charCodeAt(i + 1) === 33 &&
        styleString.charCodeAt(i + 2) === 45 &&
        styleString.charCodeAt(i + 3) === 45
      ) {
        urlMatch = 0;
        i += 4;
        continue;
      }
      if (isIdentifierCode(c)) {
        urlMatch = getUrlMatch(urlMatch, c);
        i++;
        continue;
      }
      if (c === 64 || c === 35) {
        urlMatch = 4;
        i++;
        continue;
      }
      if (c === 91 || c === 123) {
        if (blockDepth < MAX_PACKED_BLOCK_DEPTH) {
          blockStack = blockStack * 4 + (c === 91 ? 2 : 3);
        } else {
          (blockOverflow ||= []).push(c === 91 ? 2 : 3);
        }
        blockDepth++;
        urlMatch = 0;
        i++;
        continue;
      }
      if ((c === 41 || c === 93 || c === 125) && blockDepth) {
        const blockType = c === 41 ? 1 : c === 93 ? 2 : 3;
        if (blockDepth > MAX_PACKED_BLOCK_DEPTH) {
          const overflowIndex = blockDepth - MAX_PACKED_BLOCK_DEPTH - 1;
          if (blockOverflow?.[overflowIndex] === blockType) {
            blockOverflow.pop();
            blockDepth--;
          }
        } else if (blockStack % 4 === blockType) {
          blockStack = (blockStack - blockType) / 4;
          blockDepth--;
        }
        urlMatch = 0;
        i++;
        continue;
      }
      if (c === 59 && blockDepth === 0) break;
      urlMatch = 0;
      i++;
    }
    let valEnd = i;
    while (valEnd > valStart) {
      const c = styleString.charCodeAt(valEnd - 1);
      if (!isCSSWhitespace(c)) break;
      valEnd--;
    }
    if (i < len) {
      // Skip ';'.
      i++;
    }
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
    if (result) {
      result += "; ";
    }
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
