import { describe, expect, test } from "vitest";
import { create } from "../src/index.ts";
import {
  CONFIGS,
  createCVFromConfig,
  getConfigDescription,
  getConfigMode,
  getConfigTransformClass,
  getModeComponent,
  getStyleClass,
} from "./_utils.ts";

for (const config of Object.values(CONFIGS)) {
  const mode = getConfigMode(config);
  const cv = createCVFromConfig(config);
  const cls = getConfigTransformClass(config);

  describe(getConfigDescription(config), () => {
    test("extend single component", () => {
      const base = cv({ class: "base", variants: { size: { sm: "sm" } } });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], class: "extended" }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({ class: cls("base extended sm") });
    });

    test("extend multiple components", () => {
      const base1 = cv({ class: "base1" });
      const base2 = cv({ class: "base2" });
      const component = getModeComponent(
        mode,
        cv({ extend: [base1, base2], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base1 base2 extended"),
      });
    });

    test("extend a shared base once at its first position", () => {
      const base = cv({
        class: "base",
        style: { color: "red" },
        variants: { size: { sm: "size-sm", lg: "size-lg" } },
        defaultVariants: { size: "sm" },
      });
      const left = cv({
        extend: [base],
        class: "left",
        style: { color: "blue" },
      });
      const right = cv({ extend: [base], class: "right" });
      const component = getModeComponent(
        mode,
        cv({ extend: [left, right], class: "both" }),
      );
      expect(getStyleClass(component())).toEqual({
        class: cls("base left right both size-sm"),
        color: "blue",
      });
      expect(getStyleClass(component({ size: "lg" }))).toEqual({
        class: cls("base left right both size-lg"),
        color: "blue",
      });
      expect(component.getVariants()).toEqual({ size: "sm" });
      expect(getStyleClass(right())).toEqual({
        class: cls("base right size-sm"),
        color: "red",
      });
    });

    test("extend deduplicates component modes but keeps distinct recipes", () => {
      const base = cv({ class: "same" });
      const other = cv({ class: "same" });
      const component = getModeComponent(
        mode,
        cv({ extend: [base, base.jsx, base.html, base.htmlObj, other] }),
      );
      expect(getStyleClass(component())).toEqual({ class: cls("same same") });
    });

    test("extend preserves first-path defaults and later own defaults", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const left = cv({ extend: [base], defaultVariants: { size: "lg" } });
      const right = cv({ extend: [base] });
      const component = cv({ extend: [left, right] });
      expect(component.getVariants()).toEqual({ size: "lg" });
      expect(component.class()).toBe(cls("lg"));
      const override = cv({ extend: [base], defaultVariants: { size: "sm" } });
      const overridden = cv({ extend: [left, override] });
      expect(overridden.getVariants()).toEqual({ size: "sm" });
      expect(overridden.class()).toBe(cls("sm"));
    });

    test("extend applies shared callbacks once per resolution pass", () => {
      const calls: string[] = [];
      const base = cv({
        variants: { size: (value: number) => `size-${value}` },
        defaultVariants: {
          size: () => {
            calls.push("default");
            return 2;
          },
        },
        refine: () => {
          calls.push("base");
          return "refined";
        },
      });
      const left = cv({
        extend: [base],
        refine: () => {
          calls.push("left");
        },
      });
      const right = cv({
        extend: [base],
        refine: ({ variants }) => {
          calls.push("right");
          return `right-${variants.size}`;
        },
      });
      const component = getModeComponent(mode, cv({ extend: [left, right] }));
      expect(getStyleClass(component())).toEqual({
        class: cls("size-2 refined right-2"),
      });
      expect(calls).toEqual([
        "default",
        "base",
        "left",
        "right",
        "default",
        "base",
        "left",
        "right",
      ]);
      calls.length = 0;
      expect(component.getVariants()).toEqual({ size: 2 });
      expect(calls).toEqual([
        "default",
        "base",
        "left",
        "right",
        "default",
        "base",
        "left",
        "right",
      ]);
    });

    test("extend preserves inherited computed defaults on later paths", () => {
      const base = cv({
        variants: { size: { sm: "size-sm", lg: "size-lg" } },
        defaultVariants: { size: () => "lg" as const },
      });
      const left = cv({ extend: [base] });
      const right = cv({
        extend: [base],
        defaultVariants: { size: (value) => value },
      });
      const component = getModeComponent(mode, cv({ extend: [left, right] }));
      expect(getStyleClass(component())).toEqual({ class: cls("size-lg") });
      expect(component.getVariants()).toEqual({ size: "lg" });
      expect(getStyleClass(component({ size: "sm" }))).toEqual({
        class: cls("size-sm"),
      });
    });

    test("extend preserves inherited defaults before adding implicit false", () => {
      const base = cv({
        variants: { active: { true: "active" } },
        defaultVariants: { active: true },
      });
      const left = cv({ extend: [base] });
      const right = cv({
        extend: [base],
        variants: { active: { false: "inactive" } },
      });
      const component = getModeComponent(mode, cv({ extend: [left, right] }));
      expect(getStyleClass(component())).toEqual({ class: cls("active") });
      expect(component.getVariants()).toEqual({ active: true });
      expect(getStyleClass(component({ active: false }))).toEqual({
        class: cls("inactive"),
      });
    });

    test("extend keeps shared variant suppression on its first path", () => {
      const base = cv({ variants: { size: { sm: "sm", lg: "lg" } } });
      const left = cv({ extend: [base], variants: { size: { sm: null } } });
      const right = cv({ extend: [base] });
      const leftFirst = cv({ extend: [left, right] });
      const rightFirst = cv({ extend: [right, left] });
      // @ts-expect-error sm is disabled, but JavaScript callers can pass it
      expect(leftFirst.class({ size: "sm" })).toBe("");
      // @ts-expect-error sm is disabled, but JavaScript callers can pass it
      expect(rightFirst.class({ size: "sm" })).toBe(cls("sm"));
    });

    test("extend deduplicates nested diamonds and direct ancestors", () => {
      const base = cv({ class: "base" });
      const left = cv({ extend: [base], class: "left" });
      const right = cv({ extend: [base], class: "right" });
      const both = cv({ extend: [left, right], class: "both" });
      expect(cv({ extend: [base, both, left, right] }).class()).toBe(
        cls("base left right both"),
      );
      expect(cv({ extend: [both, base, right] }).class()).toBe(
        cls("base left right both"),
      );
    });

    test("pruned branches retain their compiled configuration", () => {
      const base = cv({ class: "base" });
      const branchConfig = {
        extend: [base],
        class: "original",
        style: { color: "red" },
        variants: { size: { sm: "small", lg: "large" } },
        defaultVariants: { size: "sm" as "sm" | "lg" },
        refine: () => "original-refine",
      };
      const right = cv(branchConfig);
      const left = cv({ extend: [base], class: "left" });
      branchConfig.class = "changed";
      branchConfig.style = { color: "blue" };
      branchConfig.variants.size.sm = "changed-small";
      branchConfig.defaultVariants.size = "lg";
      branchConfig.refine = () => "changed-refine";
      branchConfig.extend.length = 0;
      expect(getStyleClass(right())).toEqual({
        class: cls("base original small original-refine"),
        color: "red",
      });
      const both = cv({ extend: [left, right] });
      const component = getModeComponent(mode, both);
      expect(getStyleClass(component())).toEqual({
        class: cls("base left original small original-refine"),
        color: "red",
      });
      expect(component.getVariants()).toEqual({ size: "sm" });
      expect(cv({ extend: [base, both, right] }).class()).toBe(
        cls("base left original small original-refine"),
      );
    });

    test("pruned branches retain compiled function variants and defaults", () => {
      const base = cv({ class: "base" });
      const variants = { size: (value: number) => `size-${value}` };
      const defaults = { size: () => 2 };
      const right = cv({ extend: [base], variants, defaultVariants: defaults });
      variants.size = () => "changed";
      defaults.size = () => 3;
      const component = getModeComponent(mode, cv({ extend: [base, right] }));
      expect(getStyleClass(component())).toEqual({ class: cls("base size-2") });
      expect(component.getVariants()).toEqual({ size: 2 });
    });

    test("pruned branches preserve compiled classes and captured style objects", () => {
      const base = cv({ class: "base" });
      const classes = ["original"];
      const style = { color: "red" };
      const right = cv({ extend: [base], class: classes, style });
      classes[0] = "changed";
      style.color = "blue";
      const component = getModeComponent(mode, cv({ extend: [base, right] }));
      expect(getStyleClass(component())).toEqual({
        class: cls("base original"),
        color: "blue",
      });
    });

    test("extend with variant merging", () => {
      const base = cv({ variants: { size: { sm: "base-sm", lg: "base-lg" } } });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], variants: { size: { sm: "extended-sm" } } }),
      );
      const props = component({ size: "sm" });
      expect(getStyleClass(props)).toEqual({
        class: cls("base-sm extended-sm"),
      });
    });

    test("extend with variant merging setting base variant", () => {
      const base = cv({ variants: { size: { sm: "base-sm", lg: "base-lg" } } });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: "extended-sm" } },
        }),
      );
      const props = component({ size: "lg" });
      expect(getStyleClass(props)).toEqual({ class: cls("base-lg") });
    });

    test("extend can disable whole variant with null", () => {
      const base = cv({
        variants: { size: { sm: "base-sm", lg: "base-lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: null },
          defaultVariants: {
            // @ts-expect-error disabled variant cannot be set
            size:
              // no error
              "lg",
          },
        }),
      );
      const props = component({
        // @ts-expect-error disabled variant cannot be set
        size:
          // no error
          "lg",
      });
      expect(getStyleClass(props)).toEqual({ class: "" });
    });

    test("extend can disable variant value with null", () => {
      const base = cv({
        variants: { size: { sm: "base-sm", lg: "base-lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: {
            // @ts-expect-error disabled variant value cannot be set
            size:
              // no error
              "sm",
          },
        }),
      );
      const disabledProps = component({
        // @ts-expect-error disabled variant value cannot be set
        size:
          // no error
          "sm",
      });
      expect(getStyleClass(disabledProps)).toEqual({ class: "" });
      const enabledProps = component({ size: "lg" });
      expect(getStyleClass(enabledProps)).toEqual({ class: cls("base-lg") });
    });

    test("extend disabled variant value accepts valid defaultVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: { size: "lg" },
        }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });
    });

    test("extend disabled variant value with computed defaultVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const validComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: {
            size: () => "lg" as const,
          },
        }),
      );
      expect(getStyleClass(validComponent())).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });

      const invalidComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          defaultVariants: {
            // @ts-expect-error disabled variant value cannot be set
            size: () =>
              // no error
              "sm",
          },
        }),
      );
      expect(getStyleClass(invalidComponent())).toEqual({ class: "" });
    });

    test("extend filters disabled values from inherited computed defaultVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
        defaultVariants: {
          size: () => "sm" as const,
        },
      });
      const component = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: {
            size: { sm: null },
            color: { red: "red", blue: "blue" },
          },
          defaultVariants: {
            size: "lg",
            color: (_, variants) => (variants.size === "lg" ? "blue" : "red"),
          },
        }),
      );
      expect(getStyleClass(component())).toEqual({
        class: cls("base-lg blue"),
        fontSize: "16px",
      });
      expect(component.getVariants()).toEqual({
        size: "lg",
        color: "blue",
      });
    });

    test("extend disabled variant value with refine setVariants", () => {
      const base = cv({
        variants: {
          size: {
            sm: { class: "base-sm", style: { fontSize: "12px" } },
            lg: { class: "base-lg", style: { fontSize: "16px" } },
          },
        },
      });
      const validComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          refine: ({ setVariants }) => {
            setVariants({ size: "lg" });
          },
        }),
      );
      expect(getStyleClass(validComponent())).toEqual({
        class: cls("base-lg"),
        fontSize: "16px",
      });

      const invalidComponent = getModeComponent(
        mode,
        cv({
          extend: [base],
          variants: { size: { sm: null } },
          refine: ({ setVariants }) => {
            setVariants({
              // @ts-expect-error disabled variant value cannot be set
              size:
                // no error
                "sm",
            });
          },
        }),
      );
      expect(getStyleClass(invalidComponent())).toEqual({ class: "" });
    });

    test("extend inherits defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(mode, cv({ extend: [base] }));
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("sm") });
    });

    test("extend override defaultVariants", () => {
      const base = cv({
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base], defaultVariants: { size: "lg" } }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({ class: cls("lg") });
    });

    test("extend jsx modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.jsx], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });

    test("extend html modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.html], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });

    test("extend htmlObj modal component preserves style", () => {
      const base = cv({
        class: "base",
        style: { backgroundColor: "red" },
      });
      const component = getModeComponent(
        mode,
        cv({ extend: [base.htmlObj], class: "extended" }),
      );
      const props = component();
      expect(getStyleClass(props)).toEqual({
        class: cls("base extended"),
        backgroundColor: "red",
      });
    });
  });
}

describe("non-idempotent transformClass", () => {
  // A non-idempotent transform: prefixing each word with `tw-`. Applying it
  // twice yields `tw-tw-foo`, so the engine must invoke it exactly once per
  // class word — even when extend chains pipe extended base classes back into
  // a parent's `clsx` and through the same transform at render time.
  const { cv } = create({
    transformClass: (className) =>
      className
        .split(" ")
        .filter(Boolean)
        .map((word) => `tw-${word}`)
        .join(" "),
  });

  test("base class is transformed exactly once across single extend", () => {
    const base = cv({ class: "base" });
    const component = cv({ extend: [base], class: "extended" });
    expect(component().class).toBe("tw-base tw-extended");
  });

  test("base class is transformed exactly once across multi-level extend", () => {
    const base = cv({ class: "base" });
    const middle = cv({ extend: [base], class: "middle" });
    const top = cv({
      extend: [middle],
      class: "top",
      variants: { size: { sm: "sm" } },
    });
    expect(top({ size: "sm" }).class).toBe("tw-base tw-middle tw-top tw-sm");
  });
});

test("shared recipes keep the transform boundaries of their first path", () => {
  const { cv } = create();
  const { cv: prefixed } = create({
    transformClass: (className) =>
      className
        .split(" ")
        .filter(Boolean)
        .map((word) => `p-${word}`)
        .join(" "),
  });
  const base = cv({
    class: "base",
    variants: { size: { sm: "sm" } },
    defaultVariants: { size: "sm" },
  });
  const left = prefixed({ extend: [base], class: "left" });
  const right = cv({ extend: [base], class: "right" });
  expect(cv({ extend: [left, right] }).class()).toBe(
    "p-base p-left right p-sm",
  );
  expect(cv({ extend: [right, left] }).class()).toBe("base right p-left sm");
});

function toUpperCase(className: string) {
  return className.toUpperCase();
}

function toLowerCase(className: string) {
  return className.toLowerCase();
}

describe("extend across `create()` factories", () => {
  // The extend's own `transformClass` must apply to its own classes even when
  // the extending component comes from a different `create()` call. The
  // optimized compute path bypasses the public-component round-trip, so it
  // detects mixed-factory extends by reference identity and runs the extend's
  // transform on its contribution before joining.
  const { cv: cvUpper } = create({ transformClass: toUpperCase });
  const { cv: cvDefault } = create();

  test("extend's transformClass applies to its base class", () => {
    const base = cvUpper({ class: "base" });
    const component = cvDefault({ extend: [base], class: "extended" });
    expect(component().class).toBe("BASE extended");
  });

  test("extend's transformClass applies to its variant classes", () => {
    const base = cvUpper({
      class: "base",
      variants: { size: { sm: "sm", lg: "lg" } },
    });
    const component = cvDefault({ extend: [base], class: "extended" });
    expect(component({ size: "sm" }).class).toBe("BASE extended SM");
  });

  test("extend's transformClass cascades through grandparent chain", () => {
    const grandparent = cvUpper({ class: "grandparent" });
    const parent = cvUpper({ extend: [grandparent], class: "parent" });
    const component = cvDefault({ extend: [parent], class: "child" });
    expect(component().class).toBe("GRANDPARENT PARENT child");
  });

  test("parent's transformClass applies on top of extend's transformed output", () => {
    const { cv: cvLower } = create({ transformClass: toLowerCase });
    const base = cvUpper({
      class: "base",
      variants: { size: { sm: "sm" } },
    });
    const component = cvLower({ extend: [base], class: "child" });
    // The extend uppercases its own contribution, then the parent's
    // transformClass runs on the joined string and lowercases everything —
    // mirrors main's `parentTransform(clsx(extTransform(extOutput), …))`.
    expect(component({ size: "sm" }).class).toBe("base child sm");
  });
});
