import { cv, splitProps } from "clava";
import { describe, test } from "vitest";

const options = {
  time: 2000,
  warmupTime: 500,
};

let sink: unknown;

function consume(value: unknown) {
  sink = value;
}

const buttonConfig = {
  class: "button inline-flex items-center justify-center",
  style: {
    borderRadius: "6px",
    fontWeight: "600",
  },
  variants: {
    size: {
      sm: {
        class: "button-sm",
        style: { fontSize: "12px", paddingBlock: "4px", paddingInline: "8px" },
      },
      md: {
        class: "button-md",
        style: {
          fontSize: "14px",
          paddingBlock: "6px",
          paddingInline: "12px",
        },
      },
      lg: {
        class: "button-lg",
        style: {
          fontSize: "16px",
          paddingBlock: "8px",
          paddingInline: "16px",
        },
      },
    },
    intent: {
      primary: {
        class: "button-primary",
        style: { color: "white", backgroundColor: "blue" },
      },
      danger: {
        class: "button-danger",
        style: { color: "white", backgroundColor: "red" },
      },
      neutral: {
        class: "button-neutral",
        style: { color: "black", backgroundColor: "gray" },
      },
    },
    disabled: {
      true: {
        class: "button-disabled",
        style: { opacity: "0.5", pointerEvents: "none" },
      },
      false: "button-enabled",
    },
  },
  defaultVariants: {
    size: "md",
    intent: "primary",
  },
} as const;

const fieldConfig = {
  class: "field",
  variants: {
    tone: {
      plain: "field-plain",
      invalid: {
        class: "field-invalid",
        style: { borderColor: "red", color: "red" },
      },
    },
    compact: "field-compact",
  },
  defaultVariants: {
    tone: "plain",
  },
} as const;

const button = cv(buttonConfig);
// Same config as `button` plus cross-variant conditions, so the delta against
// "resolve component props" is the cost of a refine chain that does work.
const refinedButton = cv({
  ...buttonConfig,
  refine: ({ variants, addClass, addStyle }) => {
    if (variants.disabled && variants.intent === "danger") {
      addClass("button-danger-disabled");
    }
    if (variants.size === "lg" && variants.intent === "danger") {
      addStyle({ letterSpacing: "0.01em" });
    }
  },
});
// Same config again with a refine that contributes nothing, which separates
// the fixed cost of running the chain from the work the callback does.
const inertRefinedButton = cv({
  ...buttonConfig,
  refine: () => {},
});
const field = cv(fieldConfig);
const toolbarButton = cv({
  extend: [button],
  class: "toolbar-button",
  variants: {
    active: {
      true: "toolbar-button-active",
      false: "toolbar-button-idle",
    },
    intent: (value?: "primary" | "danger" | "neutral") => {
      if (value === "danger") {
        return {
          class: "toolbar-button-danger",
          style: { boxShadow: "0 0 0 1px red" },
        };
      }
      return null;
    },
  },
  defaultVariants: {
    active: false,
    intent: (defaultValue, variants) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
  refine: ({ variants, addClass, addStyle }) => {
    if (variants.active) {
      addClass("toolbar-button-pressed");
      addStyle({ transform: "translateY(1px)" });
    }
  },
});

// `refinedButton` and `inertRefinedButton` above measure the refine chain on a
// component that extends nothing. These add the extends dimension, where the
// chain also threads protected variants through each layer and filters
// `ctx.variants` per layer. `toolbarButton` cannot stand in for them, because
// it bundles a refine callback, a function variant value, and a computed
// default into one component.
const plainExtend = cv({ extend: [button], class: "plain-extend" });

const inertRefineExtend = cv({
  extend: [button],
  class: "inert-refine-extend",
  refine: () => {},
});

const setVariantsRefineExtend = cv({
  extend: [button],
  class: "set-variants-refine-extend",
  refine: ({ variants, setVariants }) => {
    if (variants.size === "lg") {
      setVariants({ intent: "neutral" });
    }
  },
});

const computedDefaultExtend = cv({
  extend: [button],
  class: "computed-default-extend",
  defaultVariants: {
    intent: (defaultValue, variants) =>
      variants.size === "lg" ? "neutral" : defaultValue,
  },
});

// The refine sits on the extended component instead of the outer one. That
// reaches code the cases above do not: the outer component owns no refine yet
// still runs the refine loop and allocates the protection holder, and the
// extend filters `ctx.variants` from a record that carries the outer
// component's own `active` key. The added key and the extra chain level cost
// something by themselves, so compare this row against itself over time rather
// than against `plainExtend`.
const inheritedRefineExtend = cv({
  extend: [inertRefineExtend],
  class: "inherited-refine-extend",
  variants: {
    active: { true: "inherited-refine-active", false: "inherited-refine-idle" },
  },
  defaultVariants: { active: false },
});

// Leaves `intent` unset so the computed default and `setVariants` both change a
// variant and enter the re-run path.
const refineProps = { size: "lg", disabled: true } as const;

const splitPropsInput = {
  id: "save",
  type: "button",
  size: "lg",
  intent: "danger",
  disabled: true,
  tone: "invalid",
  compact: true,
  active: true,
  className: "custom",
  style: "margin-top: 4px; --accent-color: red;",
  "data-testid": "save",
};

describe("cv", () => {
  test("create component with variants", async ({ bench }) => {
    await bench("create component with variants", () => {
      consume(cv(buttonConfig));
    }).run(options);
  });

  test("resolve component props", async ({ bench }) => {
    await bench("resolve component props", () => {
      consume(
        button({
          size: "lg",
          intent: "danger",
          disabled: true,
          className: "custom",
          style: { marginTop: 4 },
        }),
      );
    }).run(options);
  });

  test("resolve refined component props", async ({ bench }) => {
    await bench("resolve refined component props", () => {
      consume(
        refinedButton({
          size: "lg",
          intent: "danger",
          disabled: true,
          className: "custom",
          style: { marginTop: 4 },
        }),
      );
    }).run(options);
  });

  test("resolve component props with inert refine", async ({ bench }) => {
    await bench("resolve component props with inert refine", () => {
      consume(
        inertRefinedButton({
          size: "lg",
          intent: "danger",
          disabled: true,
          className: "custom",
          style: { marginTop: 4 },
        }),
      );
    }).run(options);
  });

  test("resolve html props from string style", async ({ bench }) => {
    await bench("resolve html props from string style", () => {
      consume(
        button.html({
          size: "sm",
          intent: "neutral",
          style: "margin-top: 4px; --accent-color: blue;",
        }),
      );
    }).run(options);
  });

  test("resolve extended function variant props", async ({ bench }) => {
    await bench("resolve extended function variant props", () => {
      consume(
        toolbarButton({
          size: "lg",
          intent: "danger",
          active: true,
          class: "custom",
          style: { marginInlineStart: 4 },
        }),
      );
    }).run(options);
  });

  test("resolve extended props without refine", async ({ bench }) => {
    await bench("resolve extended props without refine", () => {
      consume(plainExtend(refineProps));
    }).run(options);
  });

  test("resolve extended props with inert refine", async ({ bench }) => {
    await bench("resolve extended props with inert refine", () => {
      consume(inertRefineExtend(refineProps));
    }).run(options);
  });

  test("resolve extended props with refine setVariants", async ({ bench }) => {
    await bench("resolve extended props with refine setVariants", () => {
      consume(setVariantsRefineExtend(refineProps));
    }).run(options);
  });

  test("resolve extended props with computed default", async ({ bench }) => {
    await bench("resolve extended props with computed default", () => {
      consume(computedDefaultExtend(refineProps));
    }).run(options);
  });

  test("resolve extended props with inherited refine", async ({ bench }) => {
    await bench("resolve extended props with inherited refine", () => {
      consume(inheritedRefineExtend(refineProps));
    }).run(options);
  });

  test("get variant values", async ({ bench }) => {
    await bench("get variant values", () => {
      consume(
        toolbarButton.getVariants({
          size: "lg",
          active: true,
        }),
      );
    }).run(options);
  });
});

describe("splitProps", () => {
  test("split props across components", async ({ bench }) => {
    await bench("split props across components", () => {
      consume(splitProps(splitPropsInput, toolbarButton, field));
    }).run(options);
  });

  test("split props across arrays and components", async ({ bench }) => {
    await bench("split props across arrays and components", () => {
      consume(
        splitProps(
          splitPropsInput,
          ["id", "type", "data-testid"],
          toolbarButton,
          field,
        ),
      );
    }).run(options);
  });
});

export { sink };
