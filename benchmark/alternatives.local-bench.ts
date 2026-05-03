import { cva as cva0 } from "class-variance-authority";
import { cv } from "clava";
import { compose, cva as cva1 } from "cva";
import { tv } from "tailwind-variants";
import { tv as tvLite } from "tailwind-variants/lite";
import { bench, describe } from "vitest";
import clavaPackageJson from "../packages/clava/package.json" with { type: "json" };
import benchmarkPackageJson from "./package.json" with { type: "json" };

// CVA v1 is currently published as a beta under the `cva` package.
// CVA v0 is published as `class-variance-authority` and lacks a compose
// helper, so the equivalent benchmark merges every layer into a single config.
const options = {
  time: 2000,
  warmupTime: 500,
};

let sink: unknown;

function consume(value: unknown) {
  sink = value;
}

const packageVersions = {
  "class-variance-authority":
    benchmarkPackageJson.dependencies["class-variance-authority"],
  clava: clavaPackageJson.version,
  cva: benchmarkPackageJson.dependencies.cva,
  "tailwind-variants": benchmarkPackageJson.dependencies["tailwind-variants"],
} as const;

function packageLabel(
  packageName: keyof typeof packageVersions,
  displayName: string = packageName,
) {
  return `${displayName}@${packageVersions[packageName]}`;
}

const surfaceBase =
  "inline-flex items-center justify-center border font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const interactionBase =
  "select-none disabled:pointer-events-none disabled:opacity-50";

const productBase = "relative isolate overflow-hidden shadow-sm";

const surfaceVariants = {
  size: {
    sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
    md: "h-10 gap-2 rounded-lg px-4 text-sm",
    lg: "h-12 gap-2.5 rounded-xl px-5 text-base",
  },
  intent: {
    primary:
      "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 " +
      "focus-visible:ring-blue-500",
    neutral:
      "border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-50 " +
      "focus-visible:ring-zinc-400",
    danger:
      "border-red-600 bg-red-600 text-white hover:bg-red-700 " +
      "focus-visible:ring-red-500",
  },
  density: {
    compact: "min-w-20",
    comfortable: "min-w-28",
    spacious: "min-w-36",
  },
} as const;

const surfaceDefaultVariants = {
  size: "md",
  intent: "primary",
  density: "comfortable",
} as const;

const interactionVariants = {
  disabled: {
    true: "cursor-not-allowed opacity-50",
    false: "cursor-pointer",
  },
  pressed: {
    true: "translate-y-px shadow-inner",
    false: "translate-y-0",
  },
} as const;

const interactionCompoundVariants = [
  { disabled: true, class: "hover:bg-current hover:text-current" },
  {
    pressed: true,
    intent: "primary",
    class: "bg-blue-800 ring-1 ring-blue-900",
  },
  {
    pressed: true,
    intent: "danger",
    class: "bg-red-800 ring-1 ring-red-900",
  },
] as const;

const interactionDefaultVariants = {
  disabled: false,
  pressed: false,
} as const;

const productVariants = {
  emphasis: {
    low: "shadow-none",
    medium: "shadow",
    high: "shadow-lg ring-1 ring-black/5",
  },
  loading: {
    true: "text-transparent before:absolute before:inset-2 before:animate-pulse before:rounded-full before:bg-current/20",
    false: "",
  },
  icon: {
    none: "",
    start: "pl-3",
    end: "pr-3",
    only: "aspect-square px-0",
  },
} as const;

const productCompoundVariants = [
  { size: "lg", emphasis: "high", class: "tracking-wide" },
  { intent: "neutral", emphasis: "high", class: "bg-zinc-100 ring-zinc-300" },
  { loading: true, class: "pointer-events-none" },
  { icon: "only", class: "justify-center" },
] as const;

const productDefaultVariants = {
  emphasis: "medium",
  loading: false,
  icon: "none",
} as const;

const sizePlaceholders = {
  size: {
    sm: "",
    md: "",
    lg: "",
  },
} as const;

const intentPlaceholders = {
  intent: {
    primary: "",
    neutral: "",
    danger: "",
  },
} as const;

const clavaSurface = cv({
  class: surfaceBase,
  variants: surfaceVariants,
  defaultVariants: surfaceDefaultVariants,
});

const clavaInteraction = cv({
  extend: [clavaSurface],
  class: interactionBase,
  variants: interactionVariants,
  defaultVariants: interactionDefaultVariants,
  computed: ({ variants, addClass }) => {
    if (variants.disabled) {
      addClass("hover:bg-current hover:text-current");
    }
    if (variants.pressed && variants.intent === "primary") {
      addClass("bg-blue-800 ring-1 ring-blue-900");
    }
    if (variants.pressed && variants.intent === "danger") {
      addClass("bg-red-800 ring-1 ring-red-900");
    }
  },
});

const clavaProduct = cv({
  extend: [clavaInteraction],
  class: productBase,
  variants: productVariants,
  defaultVariants: productDefaultVariants,
  computed: ({ variants, addClass }) => {
    if (variants.size === "lg" && variants.emphasis === "high") {
      addClass("tracking-wide");
    }
    if (variants.intent === "neutral" && variants.emphasis === "high") {
      addClass("bg-zinc-100 ring-zinc-300");
    }
    if (variants.loading) {
      addClass("pointer-events-none");
    }
    if (variants.icon === "only") {
      addClass("justify-center");
    }
  },
});

const cvaSurface = cva1({
  base: surfaceBase,
  variants: surfaceVariants,
  defaultVariants: surfaceDefaultVariants,
});

const cvaInteraction = cva1({
  base: interactionBase,
  variants: {
    ...intentPlaceholders,
    ...interactionVariants,
  },
  compoundVariants: [...interactionCompoundVariants],
  defaultVariants: interactionDefaultVariants,
});

const cvaProductOnly = cva1({
  base: productBase,
  variants: {
    ...sizePlaceholders,
    ...intentPlaceholders,
    ...productVariants,
  },
  compoundVariants: [...productCompoundVariants],
  defaultVariants: productDefaultVariants,
});

const cvaProduct = compose(cvaSurface, cvaInteraction, cvaProductOnly);

const cva0Product = cva0(
  [surfaceBase, interactionBase, productBase].join(" "),
  {
    variants: {
      ...surfaceVariants,
      ...interactionVariants,
      ...productVariants,
    },
    compoundVariants: [
      ...interactionCompoundVariants,
      ...productCompoundVariants,
    ],
    defaultVariants: {
      ...surfaceDefaultVariants,
      ...interactionDefaultVariants,
      ...productDefaultVariants,
    },
  },
);

const tailwindVariantsSurface = tvLite({
  base: surfaceBase,
  variants: surfaceVariants,
  defaultVariants: surfaceDefaultVariants,
});

const tailwindVariantsInteraction = tvLite({
  extend: tailwindVariantsSurface,
  base: interactionBase,
  variants: interactionVariants,
  compoundVariants: [...interactionCompoundVariants],
  defaultVariants: interactionDefaultVariants,
});

const tailwindVariantsProduct = tvLite({
  extend: tailwindVariantsInteraction,
  base: productBase,
  variants: productVariants,
  compoundVariants: [...productCompoundVariants],
  defaultVariants: productDefaultVariants,
});

const tailwindVariantsFullSurface = tv({
  base: surfaceBase,
  variants: surfaceVariants,
  defaultVariants: surfaceDefaultVariants,
});

const tailwindVariantsFullInteraction = tv({
  extend: tailwindVariantsFullSurface,
  base: interactionBase,
  variants: interactionVariants,
  compoundVariants: [...interactionCompoundVariants],
  defaultVariants: interactionDefaultVariants,
});

const tailwindVariantsFullProduct = tv({
  extend: tailwindVariantsFullInteraction,
  base: productBase,
  variants: productVariants,
  compoundVariants: [...productCompoundVariants],
  defaultVariants: productDefaultVariants,
});

const resolveProps = {
  size: "lg",
  intent: "primary",
  density: "spacious",
  disabled: false,
  pressed: true,
  emphasis: "high",
  loading: true,
  icon: "start",
  class: "data-[state=open]:animate-in",
} as const;

describe("alternatives: resolve composed tailwind variants", () => {
  bench(
    packageLabel("clava"),
    () => {
      consume(clavaProduct(resolveProps).class);
    },
    options,
  );

  bench(
    packageLabel("cva"),
    () => {
      consume(cvaProduct(resolveProps));
    },
    options,
  );

  bench(
    packageLabel("class-variance-authority"),
    () => {
      consume(cva0Product(resolveProps));
    },
    options,
  );

  bench(
    packageLabel("tailwind-variants", "tailwind-variants/lite"),
    () => {
      consume(tailwindVariantsProduct(resolveProps));
    },
    options,
  );

  bench(
    packageLabel("tailwind-variants"),
    () => {
      consume(tailwindVariantsFullProduct(resolveProps));
    },
    options,
  );
});

export { sink };
