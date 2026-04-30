import { bench, describe } from "vitest";
import { cv, splitProps } from "../src/index.ts";

const options = {
  time: 500,
  warmupTime: 100,
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
const field = cv(fieldConfig);
const toolbarButton = cv({
  extend: [button],
  class: "toolbar-button",
  variants: {
    active: {
      true: "toolbar-button-active",
      false: "toolbar-button-idle",
    },
  },
  computedVariants: {
    intent: (value: unknown) => {
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
  },
  computed: ({ variants, addClass, addStyle, setDefaultVariants }) => {
    if (variants.active) {
      addClass("toolbar-button-pressed");
      addStyle({ transform: "translateY(1px)" });
    }
    if (variants.size === "lg") {
      setDefaultVariants({ intent: "neutral" });
    }
  },
});

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
  bench(
    "create component with variants",
    () => {
      consume(cv(buttonConfig));
    },
    options,
  );

  bench(
    "resolve component props",
    () => {
      consume(
        button({
          size: "lg",
          intent: "danger",
          disabled: true,
          className: "custom",
          style: { marginTop: 4 },
        }),
      );
    },
    options,
  );

  bench(
    "resolve html props from string style",
    () => {
      consume(
        button.html({
          size: "sm",
          intent: "neutral",
          style: "margin-top: 4px; --accent-color: blue;",
        }),
      );
    },
    options,
  );

  bench(
    "resolve extended computed props",
    () => {
      consume(
        toolbarButton({
          size: "lg",
          intent: "danger",
          active: true,
          class: "custom",
          style: { marginInlineStart: 4 },
        }),
      );
    },
    options,
  );

  bench(
    "get variant values",
    () => {
      consume(
        toolbarButton.getVariants({
          size: "lg",
          active: true,
        }),
      );
    },
    options,
  );
});

describe("splitProps", () => {
  bench(
    "split props across components",
    () => {
      consume(splitProps(splitPropsInput, toolbarButton, field));
    },
    options,
  );

  bench(
    "split props across arrays and components",
    () => {
      consume(
        splitProps(
          splitPropsInput,
          ["id", "type", "data-testid"],
          toolbarButton,
          field,
        ),
      );
    },
    options,
  );
});

export { sink };
