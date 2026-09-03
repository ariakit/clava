import { afterEach, expect, test } from "vitest";
import { create, cv } from "../src/index.ts";

const proto = Object.prototype as Record<string, unknown>;

afterEach(() => {
  for (const key of Object.keys(proto)) {
    delete proto[key];
  }
});

test("getVariants ignores keys inherited from Object.prototype", () => {
  proto.size = "lg";
  const component = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
  });
  expect(component.getVariants({})).toEqual({ size: "sm" });
});

test("render ignores keys inherited from Object.prototype", () => {
  proto.size = "lg";
  const component = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
  });
  expect(component({}).class).toBe("sm");
});

test("extend's resolver ignores polluted prototype on parent's refine", () => {
  // Base's refine branches on its own variants.size — if the polluted "size"
  // key leaks into resolved variants, the refine callback would see size =
  // "lg" instead of the staticDefault "sm" and emit the lg-specific class.
  proto.size = "lg";
  const base = cv({
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: "sm" },
    refine: ({ variants, addClass }) => {
      if (variants.size === "lg") {
        addClass("base-lg-detected");
      }
    },
  });
  const child = cv({ extend: [base], class: "child" });
  expect(child({}).class).not.toContain("base-lg-detected");
});

const variants = {
  size: { sm: "sm", lg: "lg" },
  intent: { primary: "primary", neutral: "neutral" },
};

// Every component shape resolves variants through the same record, so each one
// is exercised against a prototype key that matches "intent": a declared
// variant that the caller never passes and that has no default.
const shapes = {
  plain: {
    create: () => cv({ class: "plain", variants }),
    expected: "plain sm",
  },
  extended: {
    create: () => {
      const base = cv({ class: "base", variants });
      return cv({ extend: [base], class: "extended" });
    },
    expected: "base extended sm",
  },
  refined: {
    create: () => cv({ class: "refined", variants, refine: () => {} }),
    expected: "refined sm",
  },
  computed: {
    create: () =>
      cv({
        class: "computed",
        variants,
        defaultVariants: { size: (value) => value ?? "sm" },
      }),
    expected: "computed sm",
  },
  functionVariant: {
    create: () =>
      cv({
        class: "fn",
        variants: {
          size: { sm: "sm", lg: "lg" },
          intent: (value) => `fn-${value}`,
        },
      }),
    expected: "fn sm",
  },
};

for (const [name, { create: createComponent, expected }] of Object.entries(
  shapes,
)) {
  test(`${name} component ignores a variant key inherited from Object.prototype`, () => {
    proto.intent = "neutral";
    const component = createComponent();
    expect(component({ size: "sm" }).class).toBe(expected);
    expect(component.getVariants({ size: "sm" })).toEqual({ size: "sm" });
  });
}

test("variant value lookup ignores keys inherited from Object.prototype", () => {
  // "lg" is not a declared value of `size`, so nothing should be applied even
  // though Object.prototype carries a matching key.
  proto.lg = { class: "polluted" };
  const component = cv({ class: "button", variants: { size: { sm: "sm" } } });
  expect(
    component({
      // @ts-expect-error "lg" is not a declared value of the size variant
      size:
        // no error
        "lg",
    }).class,
  ).toBe("button");
});

test("disabled variant values ignore keys inherited from Object.prototype", () => {
  proto.intent = "primary";
  const component = cv({
    class: "button",
    variants: {
      size: { sm: "sm", lg: null },
      intent: { primary: "primary" },
    },
  });
  expect(component({ size: "sm" }).class).toBe("button sm");
  expect(component.getVariants({ size: "sm" })).toEqual({ size: "sm" });
});

test("extended disabled variant values ignore inherited keys", () => {
  proto.intent = "primary";
  const base = cv({
    class: "base",
    variants: { size: { sm: "sm", lg: null }, intent: { primary: "primary" } },
  });
  const component = cv({
    extend: [base],
    class: "child",
    variants: { tone: { info: "info", warn: null } },
  });
  expect(component({ size: "sm" }).class).toBe("base child sm");
  expect(component.getVariants({ size: "sm" })).toEqual({ size: "sm" });
});

test("computed defaults do not receive a value from Object.prototype", () => {
  proto.size = "lg";
  const received: unknown[] = [];
  const component = cv({
    class: "button",
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: {
      size: (value) => {
        received.push(value);
        return "sm";
      },
    },
  });
  expect(component({}).class).toBe("button sm");
  expect(received.length).toBeGreaterThan(0);
  expect(received.every((value) => value === undefined)).toBe(true);
});

test("render ignores class, className, and style inherited from Object.prototype", () => {
  proto.class = "polluted-class";
  proto.className = "polluted-className";
  proto.style = "color: red";
  const component = cv({ class: "button" });
  expect(component({})).toEqual({ class: "button", style: {} });
  expect(component()).toEqual({ class: "button", style: {} });
});

test("a class-only variant value does not inherit a style", () => {
  // The prototype is polluted before `cv` runs, so the pollution is visible
  // while the variant table is built.
  proto.style = "color: red";
  const component = cv({
    class: "button",
    variants: { size: { sm: { class: "sm" } } },
  });
  expect(component({ size: "sm" })).toEqual({ class: "button sm", style: {} });
});

test("a style-only variant value does not inherit a class", () => {
  proto.class = "polluted";
  const component = cv({
    class: "button",
    variants: { size: { sm: { style: { color: "blue" } } } },
  });
  expect(component({ size: "sm" })).toEqual({
    class: "button",
    style: { color: "blue" },
  });
});

test("a refine result does not inherit a style", () => {
  proto.style = "color: red";
  const component = cv({
    class: "button",
    refine: () => ({ class: "refined" }),
  });
  expect(component({})).toEqual({ class: "button refined", style: {} });
});

test("a function variant result does not inherit a style", () => {
  proto.style = "color: red";
  const component = cv({
    class: "button",
    variants: { size: (value) => ({ class: `fn-${value}` }) },
  });
  expect(component({ size: "sm" })).toEqual({
    class: "button fn-sm",
    style: {},
  });
});

test("create ignores a transformClass inherited from Object.prototype", () => {
  proto.transformClass = (className: string) => `polluted-${className}`;
  const { cv: localCv, cx } = create();
  expect(localCv({ class: "button" })({}).class).toBe("button");
  expect(cx("button")).toBe("button");
});

// Each `cv()` setting is read by a fixed key that the caller may omit, so each
// one needs its own case: a single unguarded read would otherwise let a
// polluted prototype configure every component.
test("cv ignores a class inherited from Object.prototype", () => {
  proto.class = "polluted";
  const component = cv({ variants: { size: { sm: "sm" } } });
  expect(component({ size: "sm" }).class).toBe("sm");
});

test("cv ignores variants inherited from Object.prototype", () => {
  proto.variants = { size: { sm: "polluted" } };
  const component = cv({ class: "button" });
  expect(component.variantKeys).toEqual([]);
  expect(
    component({
      // @ts-expect-error the component declares no variants
      size:
        // no error
        "sm",
    }).class,
  ).toBe("button");
});

test("cv ignores defaultVariants inherited from Object.prototype", () => {
  proto.defaultVariants = { size: "lg" };
  const component = cv({
    class: "button",
    variants: { size: { sm: "sm", lg: "lg" } },
  });
  expect(component({}).class).toBe("button");
  expect(component.getVariants({})).toEqual({});
});

test("cv ignores a refine inherited from Object.prototype", () => {
  proto.refine = ({ addClass }: { addClass: (value: string) => void }) => {
    addClass("polluted");
  };
  const component = cv({ class: "button" });
  expect(component({}).class).toBe("button");
});

test("cv ignores an extend inherited from Object.prototype", () => {
  const base = cv({ class: "base", variants: { size: { sm: "base-sm" } } });
  proto.extend = [base];
  const component = cv({ class: "button" });
  expect(component.variantKeys).toEqual([]);
  expect(component({}).class).toBe("button");
});

// A polluted key that equals the value a computed default returns would
// otherwise look like "no change" and suppress the write.
test("a computed default still applies a value the prototype also carries", () => {
  proto.size = "sm";
  const component = cv({
    class: "button",
    variants: { size: { sm: "sm" } },
    defaultVariants: { size: () => "sm" as const },
  });
  expect(component({}).class).toBe("button sm");
  expect(component.getVariants({})).toEqual({ size: "sm" });
});

// An inherited computed default reads the value through the variant snapshot
// rather than the resolved defaults, so it needs its own case. The base
// resolves nothing, which is what leaves the key absent from the snapshot.
test("an inherited computed default does not receive a value from Object.prototype", () => {
  proto.size = "lg";
  const received: unknown[] = [];
  const base = cv({
    class: "base",
    variants: { size: { sm: "sm", lg: "lg" } },
    defaultVariants: { size: () => undefined },
  });
  const component = cv({
    extend: [base],
    class: "child",
    defaultVariants: {
      size: (value) => {
        received.push(value);
        return undefined;
      },
    },
  });
  expect(component({}).class).toBe("base child");
  expect(received.length).toBeGreaterThan(0);
  expect(received.every((value) => value === undefined)).toBe(true);
});

// The skip-values table is a separate record from the resolved variants, so a
// polluted key matching a variant that *is* resolved reaches it.
test("skip values ignore keys inherited from Object.prototype", () => {
  proto.size = "polluted";
  const base = cv({ class: "base", variants: { size: { sm: "base-sm" } } });
  const component = cv({
    extend: [base],
    class: "child",
    variants: { tone: { info: "info", warn: null } },
  });
  expect(component({ size: "sm" }).class).toBe("base child base-sm");
  expect(component.getVariants({ size: "sm" })).toEqual({ size: "sm" });
});

// Same shape as the computed-default case, for the value comparison that
// decides whether `setVariants` needs to write.
test("refine setVariants applies a value the prototype also carries", () => {
  proto.intent = "primary";
  const component = cv({
    class: "button",
    variants: { intent: { primary: "primary" } },
    refine: ({ setVariants }) => {
      setVariants({ intent: "primary" });
    },
  });
  expect(component({}).class).toBe("button primary");
  expect(component.getVariants({})).toEqual({ intent: "primary" });
});

test("refine setVariants applies a value the prototype carries with disabled values", () => {
  proto.intent = "primary";
  const component = cv({
    class: "button",
    variants: {
      intent: { primary: "primary" },
      size: { sm: "sm", lg: null },
    },
    refine: ({ setVariants }) => {
      setVariants({ intent: "primary" });
    },
  });
  expect(component({}).class).toBe("button primary");
  expect(component.getVariants({})).toEqual({ intent: "primary" });
});

test("an implicit boolean default survives a polluted variant key", () => {
  proto.size = "anything";
  const component = cv({
    class: "button",
    variants: { size: { true: "on", false: "off" } },
  });
  expect(component({}).class).toBe("button off");
  expect(component.getVariants({})).toEqual({ size: false });
});

// The same guards decide how a variant named after an `Object.prototype`
// member behaves, with nothing polluted: every one of these reads used to
// resolve the built-in.
test("a variant named after an Object.prototype member gets its boolean default", () => {
  const component = cv({
    class: "button",
    variants: { constructor: { true: "on", false: "off" } },
  });
  // Called without props: an empty object literal's `constructor` is typed as
  // `Function`, which the variant's own prop type rejects.
  expect(component().class).toBe("button off");
  expect(component.getVariants()).toEqual({ constructor: false });
});

test("a variant named after an Object.prototype member is not treated as disabled", () => {
  const component = cv({
    class: "button",
    variants: { size: { sm: "sm", lg: null }, toString: { a: "a" } },
  });
  expect(component({ toString: "a" }).class).toBe("button a");
  expect(component.getVariants({ toString: "a" })).toEqual({ toString: "a" });
});

// The disabled-value table is consulted from five places, and each one reads it
// with a key taken from a different record, so each needs its own case.
test("cv does not throw while filtering static defaults", () => {
  proto.intent = "x";
  const component = cv({
    class: "button",
    variants: {
      size: { sm: "sm", lg: null },
      intent: { primary: "primary" },
    },
    defaultVariants: { intent: "primary" },
  });
  expect(component({ size: "sm" }).class).toBe("button sm primary");
  expect(component.getVariants({ size: "sm" })).toEqual({
    size: "sm",
    intent: "primary",
  });
});

test("a computed default does not throw while filtering disabled values", () => {
  proto.intent = "x";
  const component = cv({
    class: "button",
    variants: {
      size: { sm: "sm", lg: null },
      intent: { primary: "primary" },
    },
    defaultVariants: { intent: () => "primary" as const },
  });
  expect(component({ size: "sm" }).class).toBe("button sm primary");
  expect(component.getVariants({ size: "sm" })).toEqual({
    size: "sm",
    intent: "primary",
  });
});

// Two levels of the chain contribute disabled values, so the skip-values
// records are merged rather than passed straight through.
test("merged skip values ignore keys inherited from Object.prototype", () => {
  proto.size = "lg";
  const base = cv({
    class: "base",
    variants: {
      size: { sm: "base-sm", lg: "base-lg" },
      intent: { primary: "base-primary" },
    },
  });
  const middle = cv({
    extend: [base],
    class: "mid",
    variants: { tone: { info: "info", warn: null } },
  });
  const component = cv({
    extend: [middle],
    class: "top",
    variants: { mood: { calm: "calm", angry: null } },
  });
  expect(component({ size: "sm" }).class).toBe("base mid top base-sm");
  expect(component.getVariants({ size: "sm" })).toEqual({ size: "sm" });
});

test("a merged skip-values entry does not drop a class", () => {
  proto.tone = "x";
  const base = cv({
    class: "base",
    variants: { tone: { x: "base-x", info: "base-info" } },
  });
  const middle = cv({
    extend: [base],
    class: "mid",
    variants: { tone: { info: "mid-info", warn: null } },
  });
  const component = cv({
    extend: [middle],
    class: "top",
    variants: { mood: { calm: "calm", angry: null } },
  });
  expect(component({ tone: "x" }).class).toBe("base mid top base-x");
  expect(component.getVariants({ tone: "x" })).toEqual({ tone: "x" });
});

test("function variant skip values ignore inherited keys", () => {
  proto.intent = "x";
  const base = cv({
    class: "base",
    variants: { intent: (value?: "primary") => `fn-${value}` },
  });
  const component = cv({
    extend: [base],
    class: "child",
    variants: { tone: { info: "info", warn: null } },
  });
  expect(component({ intent: "primary" }).class).toBe("base child fn-primary");
  expect(component.getVariants({ intent: "primary" })).toEqual({
    intent: "primary",
  });
});

// The fallback runs when this component disables the value the chain resolved.
// A computed default in the base is what leaves the key absent from the
// resolved defaults the fallback reads.
test("a disabled-value fallback ignores keys inherited from Object.prototype", () => {
  proto.size = "sm";
  const base = cv({
    class: "base",
    variants: { size: { sm: "base-sm", lg: "base-lg" } },
    defaultVariants: { size: () => "lg" as const },
  });
  const component = cv({
    extend: [base],
    class: "child",
    variants: { size: { sm: "child-sm", lg: null } },
  });
  expect(component({}).class).toBe("base child");
  expect(component.getVariants({})).toEqual({});
});
