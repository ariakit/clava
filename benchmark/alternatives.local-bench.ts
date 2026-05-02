import { cv } from "clava";
import { compose, cva } from "cva";
import { tv } from "tailwind-variants/lite";
import { bench, describe } from "vitest";

// CVA v1 is currently published as a beta under the `cva` package.
const options = {
  time: 2000,
  warmupTime: 500,
};

let sink: unknown;

function consume(value: unknown) {
  sink = value;
}

const surfaceBase =
  "inline-flex items-center justify-center border font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const interactionBase =
  "select-none disabled:pointer-events-none disabled:opacity-50";

const productBase = "relative isolate overflow-hidden shadow-sm";

const clavaSurface = cv({
  class: surfaceBase,
  variants: {
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
  },
  defaultVariants: {
    size: "md",
    intent: "primary",
    density: "comfortable",
  },
});

const clavaInteraction = cv({
  extend: [clavaSurface],
  class: interactionBase,
  variants: {
    disabled: {
      true: "cursor-not-allowed opacity-50",
      false: "cursor-pointer",
    },
    pressed: {
      true: "translate-y-px shadow-inner",
      false: "translate-y-0",
    },
  },
  defaultVariants: {
    disabled: false,
    pressed: false,
  },
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
  variants: {
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
  },
  defaultVariants: {
    emphasis: "medium",
    loading: false,
    icon: "none",
  },
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

const cvaSurface = cva({
  base: surfaceBase,
  variants: {
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
  },
  defaultVariants: {
    size: "md",
    intent: "primary",
    density: "comfortable",
  },
});

const cvaInteraction = cva({
  base: interactionBase,
  variants: {
    intent: {
      primary: "",
      neutral: "",
      danger: "",
    },
    disabled: {
      true: "cursor-not-allowed opacity-50",
      false: "cursor-pointer",
    },
    pressed: {
      true: "translate-y-px shadow-inner",
      false: "translate-y-0",
    },
  },
  compoundVariants: [
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
  ],
  defaultVariants: {
    disabled: false,
    pressed: false,
  },
});

const cvaProductOnly = cva({
  base: productBase,
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
    },
    intent: {
      primary: "",
      neutral: "",
      danger: "",
    },
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
  },
  compoundVariants: [
    { size: "lg", emphasis: "high", class: "tracking-wide" },
    { intent: "neutral", emphasis: "high", class: "bg-zinc-100 ring-zinc-300" },
    { loading: true, class: "pointer-events-none" },
    { icon: "only", class: "justify-center" },
  ],
  defaultVariants: {
    emphasis: "medium",
    loading: false,
    icon: "none",
  },
});

const cvaProduct = compose(cvaSurface, cvaInteraction, cvaProductOnly);

const tailwindVariantsSurface = tv({
  base: surfaceBase,
  variants: {
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
  },
  defaultVariants: {
    size: "md",
    intent: "primary",
    density: "comfortable",
  },
});

const tailwindVariantsInteraction = tv({
  extend: tailwindVariantsSurface,
  base: interactionBase,
  variants: {
    disabled: {
      true: "cursor-not-allowed opacity-50",
      false: "cursor-pointer",
    },
    pressed: {
      true: "translate-y-px shadow-inner",
      false: "translate-y-0",
    },
  },
  compoundVariants: [
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
  ],
  defaultVariants: {
    disabled: false,
    pressed: false,
  },
});

const tailwindVariantsProduct = tv({
  extend: tailwindVariantsInteraction,
  base: productBase,
  variants: {
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
  },
  compoundVariants: [
    { size: "lg", emphasis: "high", class: "tracking-wide" },
    { intent: "neutral", emphasis: "high", class: "bg-zinc-100 ring-zinc-300" },
    { loading: true, class: "pointer-events-none" },
    { icon: "only", class: "justify-center" },
  ],
  defaultVariants: {
    emphasis: "medium",
    loading: false,
    icon: "none",
  },
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
    "clava",
    () => {
      consume(clavaProduct(resolveProps).class);
    },
    options,
  );

  bench(
    "cva",
    () => {
      consume(cvaProduct(resolveProps));
    },
    options,
  );

  bench(
    "tailwind-variants/lite",
    () => {
      consume(tailwindVariantsProduct(resolveProps));
    },
    options,
  );
});

export { sink };
