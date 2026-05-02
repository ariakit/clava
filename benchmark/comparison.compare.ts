import { cva as cvaV0 } from "class-variance-authority";
import { cv } from "clava";
import { compose, cva as cvaV1 } from "cva";
import { tv } from "tailwind-variants";
import { bench, describe } from "vitest";

// Local-only comparison: clava vs cva v0 (`class-variance-authority`) vs cva
// v1 (`cva`) vs tailwind-variants.
//
// Fairness rules:
// - only resolve-time work is timed; components are created once up front;
// - every timed case returns a class string, so clava uses `.class`;
// - tailwind-variants' default tailwind-merge integration is disabled except
//   in the dedicated tailwind-merge scenario.

const options = {
  time: 2000,
  warmupTime: 500,
};

let sink: unknown;

interface BenchmarkCase {
  name: string;
  run: () => unknown;
}

function consume(value: unknown) {
  sink = value;
}

function registerBenchmarks(cases: readonly BenchmarkCase[]) {
  for (const benchmarkCase of cases) {
    bench(benchmarkCase.name, () => consume(benchmarkCase.run()), options);
  }
}

const buttonVariants = {
  intent: {
    primary: "bg-blue-500 text-white",
    secondary: "bg-gray-200 text-black",
    danger: "bg-red-500 text-white",
  },
  size: {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  },
  disabled: {
    true: "btn-disabled",
    false: "btn-enabled",
  },
} as const;

const buttonDefaults = {
  intent: "primary",
  size: "md",
  disabled: false,
} as const;

const buttonProps = {
  intent: "danger",
  size: "lg",
  disabled: true,
} as const;

const clavaButton = cv({
  class: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
});

const cvaV0Button = cvaV0("btn", {
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
});

const cvaV1Button = cvaV1({
  base: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
});

const tvButton = tv({
  base: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
});

describe("simple variants", () => {
  registerBenchmarks([
    { name: "clava", run: () => clavaButton(buttonProps) },
    { name: "cva v0", run: () => cvaV0Button(buttonProps) },
    { name: "cva v1", run: () => cvaV1Button(buttonProps) },
    { name: "tailwind-variants", run: () => tvButton(buttonProps) },
  ]);
});

interface CompoundRule {
  intent?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  class: string;
}

const compoundRules: CompoundRule[] = [
  { intent: "danger", size: "lg", class: "ring-2 ring-red-300" },
  { intent: "primary", disabled: true, class: "btn-primary-disabled" },
];

const clavaCompoundButton = cv({
  class: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
  computed: ({ variants, addClass }) => {
    if (variants.intent === "danger" && variants.size === "lg") {
      addClass("ring-2 ring-red-300");
    }
    if (variants.intent === "primary" && variants.disabled === true) {
      addClass("btn-primary-disabled");
    }
  },
});

const cvaV0CompoundButton = cvaV0("btn", {
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
  compoundVariants: compoundRules,
});

const cvaV1CompoundButton = cvaV1({
  base: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
  compoundVariants: compoundRules,
});

const tvCompoundButton = tv({
  base: "btn",
  variants: buttonVariants,
  defaultVariants: buttonDefaults,
  compoundVariants: compoundRules,
});

describe("compound variants", () => {
  registerBenchmarks([
    { name: "clava", run: () => clavaCompoundButton(buttonProps) },
    { name: "cva v0", run: () => cvaV0CompoundButton(buttonProps) },
    { name: "cva v1", run: () => cvaV1CompoundButton(buttonProps) },
    { name: "tailwind-variants", run: () => tvCompoundButton(buttonProps) },
  ]);
});

const stateVariants = {
  active: {
    true: "toolbar-button-active",
    false: "toolbar-button-idle",
  },
} as const;

const stateDefaults = { active: false } as const;

// cva v0 has no extension API, so this scenario compares the libraries that
// can express composition directly.
const clavaToolbarButton = cv({
  extend: [clavaButton],
  class: "",
  variants: stateVariants,
  defaultVariants: stateDefaults,
});

const cvaV1ToolbarButton = compose(
  cvaV1Button,
  cvaV1({
    base: "toolbar-button",
    variants: stateVariants,
    defaultVariants: stateDefaults,
  }),
);

const tvToolbarButton = tv({
  extend: tvButton,
  base: "toolbar-button",
  variants: stateVariants,
  defaultVariants: stateDefaults,
});

const toolbarProps = {
  ...buttonProps,
  active: true,
} as const;

describe("extend and compose", () => {
  registerBenchmarks([
    { name: "clava", run: () => clavaToolbarButton(toolbarProps) },
    { name: "cva v1", run: () => cvaV1ToolbarButton(toolbarProps) },
    { name: "tailwind-variants", run: () => tvToolbarButton(toolbarProps) },
  ]);
});

export { sink };
