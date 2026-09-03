import type { HTMLCSSProperties, StyleValue } from "./types.ts";

export const hasOwn = Object.hasOwn;

/**
 * Reads a key that may be absent from a plain record. Variant, prop, and config
 * records are plain objects, so a key inherited from a polluted
 * `Object.prototype` would otherwise read back like a value the caller passed
 * or Clava itself resolved.
 */
export function getOwn<T extends object, K extends keyof T & string>(
  record: T,
  key: K,
): T[K] | undefined {
  if (!hasOwn(record, key)) return undefined;
  return record[key];
}

// Keep this explicit so normalization does not depend on browser globals.
// Vendor-prefixed variants are derived below instead of duplicating the list.
const unitlessNumberProperties = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImage",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "boxFlex",
  "boxFlexGroup",
  "boxOrdinalGroup",
  "columnCount",
  "columns",
  "fillOpacity",
  "flex",
  "flexGrow",
  "flexNegative",
  "flexOrder",
  "flexPositive",
  "flexShrink",
  "floodOpacity",
  "fontSizeAdjust",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnSpan",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowSpan",
  "gridRowStart",
  "hyphenateLimitChars",
  "initialLetter",
  "lineClamp",
  "lineHeight",
  "maskBorder",
  "maskBorderOutset",
  "maskBorderSlice",
  "maskBorderWidth",
  "mathDepth",
  "maxLines",
  "opacity",
  "order",
  "orphans",
  "scale",
  "shapeImageThreshold",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
]);

function isCustomProperty(property: string) {
  return property.charCodeAt(0) === 45 && property.charCodeAt(1) === 45;
}

/**
 * Converts a hyphenated CSS property name to camelCase.
 * @example
 * hyphenToCamel("background-color") // "backgroundColor"
 * hyphenToCamel("-ms-transition") // "msTransition" (lowercase "ms" prefix)
 * hyphenToCamel("--custom-var") // "--custom-var" (CSS variables are preserved)
 */
export function hyphenToCamel(str: string) {
  // CSS custom properties (variables) should not be converted
  if (isCustomProperty(str)) {
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
    const isAsciiLetter =
      (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isAsciiLetter) {
      const isMicrosoftPrefix = hyphenIndex === 0 && str.startsWith("ms-", 1);
      result += isMicrosoftPrefix
        ? str[nextIndex]
        : str[nextIndex].toUpperCase();
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
 * camelToHyphen("msTransition") // "-ms-transition" (lowercase "ms" prefix)
 * camelToHyphen("--customVar") // "--customVar" (CSS variables are preserved)
 */
export function camelToHyphen(str: string) {
  // CSS custom properties (variables) should not be converted
  if (isCustomProperty(str)) {
    return str;
  }

  let result = "";
  let lastIndex = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 65 || code > 90) continue;
    const isMicrosoftPrefix = i === 2 && str.startsWith("ms");
    if (isMicrosoftPrefix) {
      result += "-";
    }
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

function hasVendorPrefix(property: string, prefix: string) {
  const nextCode = property.charCodeAt(prefix.length);
  if (nextCode < 65 || nextCode > 90) return false;
  return property.startsWith(prefix);
}

// "ms" is used in JSX, while camelizing hyphenated properties produces "Ms".
const vendorPrefixes = ["Webkit", "Moz", "ms", "Ms", "O"];

function isUnitlessNumberProperty(property: string) {
  if (unitlessNumberProperties.has(property)) return true;

  for (const prefix of vendorPrefixes) {
    if (!hasVendorPrefix(property, prefix)) continue;
    const firstCode = property.charCodeAt(prefix.length);
    const unprefixedProperty =
      String.fromCharCode(firstCode + 32) + property.slice(prefix.length + 1);
    return unitlessNumberProperties.has(unprefixedProperty);
  }
  return false;
}

function normalizeStyleValue(property: string, value: string | number) {
  if (typeof value === "string") {
    return value;
  }
  if (isCustomProperty(property)) {
    return value;
  }
  if (isUnitlessNumberProperty(property)) {
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
export function htmlStyleToStyleValue(
  styleString: string,
  result: StyleValue = {},
) {
  if (!styleString) return result;
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
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
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
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
      i++;
    }
    const valStart = i;
    while (i < len && styleString.charCodeAt(i) !== 59) {
      i++;
    }
    let valEnd = i;
    while (valEnd > valStart) {
      const c = styleString.charCodeAt(valEnd - 1);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break;
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
export function htmlObjStyleToStyleValue(
  style: object,
  result: StyleValue = {},
): StyleValue {
  for (const key in style) {
    if (!hasOwn(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    const property = hyphenToCamel(key);
    // CSS property names and values are dynamic - cast required for index access
    (result as Record<string, string | number>)[property] = normalizeStyleValue(
      property,
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
    if (!hasOwn(style, key)) continue;
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
  const result: HTMLCSSProperties = {};
  for (const key in style) {
    if (!hasOwn(style, key)) continue;
    const value = (style as Record<string, unknown>)[key];
    if (value == null) continue;
    (result as Record<string, unknown>)[camelToHyphen(key)] = value;
  }
  return result;
}
