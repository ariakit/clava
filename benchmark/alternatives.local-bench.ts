import { cva as cva0 } from "class-variance-authority";
import { cv } from "clava";
import { cva as cva1 } from "cva";
import { tv } from "tailwind-variants";
import { tv as tvLite } from "tailwind-variants/lite";
import { describe, test } from "vitest";
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

// Each library is built twice so both groups compare equivalent work: Clava
// spells cross-variant conditions as `refine`, every other library as
// `compoundVariants`. Clava alone repeats its construction chain, because an
// empty `compoundVariants` array costs its libraries almost nothing while a
// present `refine` runs the chain whatever the callback does, as the inert
// refine case in `clava.bench.ts` measures.
function createClavaProduct(crossVariant: boolean) {
  const clavaSurface = cv({
    class: surfaceBase,
    variants: surfaceVariants,
    defaultVariants: surfaceDefaultVariants,
  });

  if (!crossVariant) {
    const clavaInteraction = cv({
      extend: [clavaSurface],
      class: interactionBase,
      variants: interactionVariants,
      defaultVariants: interactionDefaultVariants,
    });

    return cv({
      extend: [clavaInteraction],
      class: productBase,
      variants: productVariants,
      defaultVariants: productDefaultVariants,
    });
  }

  const clavaInteraction = cv({
    extend: [clavaSurface],
    class: interactionBase,
    variants: interactionVariants,
    defaultVariants: interactionDefaultVariants,
    refine: ({ variants, addClass }) => {
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

  return cv({
    extend: [clavaInteraction],
    class: productBase,
    variants: productVariants,
    defaultVariants: productDefaultVariants,
    refine: ({ variants, addClass }) => {
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
}

function createCvaProduct(crossVariant: boolean) {
  const cvaSurface = cva1({
    base: surfaceBase,
    variants: surfaceVariants,
    defaultVariants: surfaceDefaultVariants,
  });

  const cvaInteraction = cva1({
    base: interactionBase,
    variants: interactionVariants,
    compoundVariants: crossVariant ? [...interactionCompoundVariants] : [],
    defaultVariants: interactionDefaultVariants,
  });

  const cvaProductOnly = cva1({
    base: productBase,
    variants: productVariants,
    compoundVariants: crossVariant ? [...productCompoundVariants] : [],
    defaultVariants: productDefaultVariants,
  });

  return cva1({ composes: [cvaSurface, cvaInteraction, cvaProductOnly] });
}

function createCva0Product(crossVariant: boolean) {
  return cva0([surfaceBase, interactionBase, productBase].join(" "), {
    variants: {
      ...surfaceVariants,
      ...interactionVariants,
      ...productVariants,
    },
    compoundVariants: crossVariant
      ? [...interactionCompoundVariants, ...productCompoundVariants]
      : [],
    defaultVariants: {
      ...surfaceDefaultVariants,
      ...interactionDefaultVariants,
      ...productDefaultVariants,
    },
  });
}

function createTailwindVariantsProduct(
  createTv: typeof tv | typeof tvLite,
  crossVariant: boolean,
) {
  const surface = createTv({
    base: surfaceBase,
    variants: surfaceVariants,
    defaultVariants: surfaceDefaultVariants,
  });

  const interaction = createTv({
    extend: surface,
    base: interactionBase,
    variants: interactionVariants,
    compoundVariants: crossVariant ? [...interactionCompoundVariants] : [],
    defaultVariants: interactionDefaultVariants,
  });

  return createTv({
    extend: interaction,
    base: productBase,
    variants: productVariants,
    compoundVariants: crossVariant ? [...productCompoundVariants] : [],
    defaultVariants: productDefaultVariants,
  });
}

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

function describeGroup(title: string, crossVariant: boolean) {
  const clavaProduct = createClavaProduct(crossVariant);
  const cvaProduct = createCvaProduct(crossVariant);
  const cva0Product = createCva0Product(crossVariant);
  const tvLiteProduct = createTailwindVariantsProduct(tvLite, crossVariant);
  const tvProduct = createTailwindVariantsProduct(tv, crossVariant);

  describe(title, () => {
    test(packageLabel("clava"), async ({ bench }) => {
      await bench(packageLabel("clava"), () => {
        consume(clavaProduct(resolveProps).class);
      }).run(options);
    });

    test(packageLabel("cva"), async ({ bench }) => {
      await bench(packageLabel("cva"), () => {
        consume(cvaProduct(resolveProps));
      }).run(options);
    });

    test(packageLabel("class-variance-authority"), async ({ bench }) => {
      await bench(packageLabel("class-variance-authority"), () => {
        consume(cva0Product(resolveProps));
      }).run(options);
    });

    test(
      packageLabel("tailwind-variants", "tailwind-variants/lite"),
      async ({ bench }) => {
        await bench(
          packageLabel("tailwind-variants", "tailwind-variants/lite"),
          () => {
            consume(tvLiteProduct(resolveProps));
          },
        ).run(options);
      },
    );

    test(packageLabel("tailwind-variants"), async ({ bench }) => {
      await bench(packageLabel("tailwind-variants"), () => {
        consume(tvProduct(resolveProps));
      }).run(options);
    });
  });
}

describeGroup("alternatives: resolve composed tailwind variants", false);
describeGroup(
  "alternatives: resolve composed tailwind variants with cross-variant conditions",
  true,
);

export { sink };
