import { cva as cvaV0 } from "class-variance-authority";
import { compose, cva as cvaV1 } from "cva";
import { twMerge } from "tailwind-merge";
import { createTV, tv as tvWithTwMerge } from "tailwind-variants";
import { bench, describe } from "vitest";
import { create, cv } from "../clava/src/index.ts";

// Local-only comparison: clava vs cva v0 (`class-variance-authority`) vs cva v1
// (`cva`) vs tailwind-variants. Each scenario only includes libraries that
// natively support the feature. cva v0 has no extension API so it is skipped
// from the extend/compose scenario.
//
// tailwind-variants enables tailwind-merge by default. That would benchmark
// tailwind-merge instead of tv's variant resolver, so we use `createTV` to
// disable it for an apples-to-apples comparison.

const tv = createTV({ twMerge: false });

const options = {
  time: 2000,
  warmupTime: 500,
};

let sink: unknown;
function consume(value: unknown) {
  sink = value;
}

// ─── Scenario 1: simple variants + defaults ─────────────────────────────────

const simpleVariants = {
  intent: {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
  },
  size: {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
  },
  disabled: {
    true: "btn-disabled",
    false: "btn-enabled",
  },
} as const;

const simpleDefaults = {
  intent: "primary",
  size: "md",
  disabled: false,
} as const;

const clavaSimpleConfig = {
  class: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
} as const;

const cvaV0SimpleOptions = {
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
} as const;

const cvaV1SimpleConfig = {
  base: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
} as const;

const tvSimpleConfig = {
  base: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
} as const;

const clavaSimple = cv(clavaSimpleConfig);
const cvaV0Simple = cvaV0("btn", cvaV0SimpleOptions);
const cvaV1Simple = cvaV1(cvaV1SimpleConfig);
const tvSimple = tv(tvSimpleConfig);

const simpleProps = { intent: "danger", size: "lg", disabled: true } as const;

describe("simple component (variants + defaults)", () => {
  describe("create", () => {
    bench("clava", () => consume(cv(clavaSimpleConfig)), options);
    bench("cva v0", () => consume(cvaV0("btn", cvaV0SimpleOptions)), options);
    bench("cva v1", () => consume(cvaV1(cvaV1SimpleConfig)), options);
    bench("tailwind-variants", () => consume(tv(tvSimpleConfig)), options);
  });

  describe("resolve", () => {
    bench(
      "clava (class)",
      () => consume(clavaSimple.class(simpleProps)),
      options,
    );
    bench("clava (full)", () => consume(clavaSimple(simpleProps)), options);
    bench("cva v0", () => consume(cvaV0Simple(simpleProps)), options);
    bench("cva v1", () => consume(cvaV1Simple(simpleProps)), options);
    bench("tailwind-variants", () => consume(tvSimple(simpleProps)), options);
  });
});

// ─── Scenario 2: compound variants ──────────────────────────────────────────
//
// clava expresses compound variants through the `computed` callback; cva v0,
// cva v1, and tailwind-variants ship a dedicated `compoundVariants` array. The
// rules below are equivalent so the resolver path covers the same match
// surface in every library.

// Type the list explicitly: cva v0/v1 and tailwind-variants need literal
// variant values (e.g. `intent: "danger"`, not `string`) but also need a
// mutable array type, so neither plain widening nor `as const` works alone.
type CompoundRule = {
  intent?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  class: string;
};
const compoundVariantsList: CompoundRule[] = [
  { intent: "danger", size: "lg", class: "ring-2 ring-red-300" },
  { intent: "primary", disabled: true, class: "btn-primary-disabled" },
];

const clavaCompoundConfig = {
  class: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
  computed: ({
    variants,
    addClass,
  }: {
    variants: { intent?: string; size?: string; disabled?: boolean };
    addClass: (className: string) => void;
  }) => {
    if (variants.intent === "danger" && variants.size === "lg") {
      addClass("ring-2 ring-red-300");
    }
    if (variants.intent === "primary" && variants.disabled === true) {
      addClass("btn-primary-disabled");
    }
  },
} as const;

const cvaV0CompoundOptions = {
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
  compoundVariants: compoundVariantsList,
};

const cvaV1CompoundConfig = {
  base: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
  compoundVariants: compoundVariantsList,
};

const tvCompoundConfig = {
  base: "btn",
  variants: simpleVariants,
  defaultVariants: simpleDefaults,
  compoundVariants: compoundVariantsList,
};

const clavaCompound = cv(clavaCompoundConfig);
const cvaV0Compound = cvaV0("btn", cvaV0CompoundOptions);
const cvaV1Compound = cvaV1(cvaV1CompoundConfig);
const tvCompound = tv(tvCompoundConfig);

describe("compound variants", () => {
  describe("create", () => {
    bench("clava (computed)", () => consume(cv(clavaCompoundConfig)), options);
    bench("cva v0", () => consume(cvaV0("btn", cvaV0CompoundOptions)), options);
    bench("cva v1", () => consume(cvaV1(cvaV1CompoundConfig)), options);
    bench("tailwind-variants", () => consume(tv(tvCompoundConfig)), options);
  });

  describe("resolve (matching combo)", () => {
    bench(
      "clava (class)",
      () => consume(clavaCompound.class(simpleProps)),
      options,
    );
    bench("clava (full)", () => consume(clavaCompound(simpleProps)), options);
    bench("cva v0", () => consume(cvaV0Compound(simpleProps)), options);
    bench("cva v1", () => consume(cvaV1Compound(simpleProps)), options);
    bench("tailwind-variants", () => consume(tvCompound(simpleProps)), options);
  });
});

// ─── Scenario 3: extending another component ────────────────────────────────
//
// cva v0 has no extension API and is excluded. clava and tailwind-variants
// both express extension as part of the new component's config; cva v1 builds
// a child component first and then merges via `compose`.

const childVariants = {
  active: {
    true: "toolbar-btn-active",
    false: "toolbar-btn-idle",
  },
} as const;

const childDefaults = { active: false } as const;

const clavaParent = cv(clavaSimpleConfig);
const cvaV1Parent = cvaV1(cvaV1SimpleConfig);
const tvParent = tv(tvSimpleConfig);

// Not `as const`: clava's `extend` is typed as a mutable AnyComponent[].
const clavaExtendedConfig = {
  extend: [clavaParent],
  class: "toolbar-btn",
  variants: childVariants,
  defaultVariants: childDefaults,
};

const cvaV1ChildConfig = {
  base: "toolbar-btn",
  variants: childVariants,
  defaultVariants: childDefaults,
} as const;

const tvExtendedConfig = {
  extend: tvParent,
  base: "toolbar-btn",
  variants: childVariants,
  defaultVariants: childDefaults,
} as const;

const clavaExtended = cv(clavaExtendedConfig);
const cvaV1Extended = compose(cvaV1Parent, cvaV1(cvaV1ChildConfig));
const tvExtended = tv(tvExtendedConfig);

const extendedProps = {
  intent: "danger",
  size: "lg",
  disabled: true,
  active: true,
} as const;

describe("extend / compose", () => {
  describe("create", () => {
    bench("clava (extend)", () => consume(cv(clavaExtendedConfig)), options);
    bench(
      "cva v1 (compose)",
      () => consume(compose(cvaV1Parent, cvaV1(cvaV1ChildConfig))),
      options,
    );
    bench(
      "tailwind-variants (extend)",
      () => consume(tv(tvExtendedConfig)),
      options,
    );
  });

  describe("resolve", () => {
    bench(
      "clava (class)",
      () => consume(clavaExtended.class(extendedProps)),
      options,
    );
    bench("clava (full)", () => consume(clavaExtended(extendedProps)), options);
    bench("cva v1", () => consume(cvaV1Extended(extendedProps)), options);
    bench(
      "tailwind-variants",
      () => consume(tvExtended(extendedProps)),
      options,
    );
  });
});

// ─── Scenario 4: with tailwind-merge ────────────────────────────────────────
//
// tailwind-variants enables tailwind-merge by default. clava integrates the
// same behavior via `create({ transformClass: twMerge })`. cva v0/v1 don't
// ship tailwind-merge integration so they are excluded.
//
// We use real Tailwind utilities here so `tailwind-merge` actually has
// conflicting classes to resolve — measuring the realistic merge cost rather
// than just its parsing overhead on synthetic class names.

const { cv: cvTwMerge } = create({ transformClass: twMerge });

const twMergeVariants = {
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
} as const;

const twMergeDefaults = { intent: "primary", size: "md" } as const;

const clavaTwMergeConfig = {
  class: "px-3 py-2 bg-slate-100 text-black",
  variants: twMergeVariants,
  defaultVariants: twMergeDefaults,
} as const;

const tvTwMergeConfig = {
  base: "px-3 py-2 bg-slate-100 text-black",
  variants: twMergeVariants,
  defaultVariants: twMergeDefaults,
} as const;

const clavaTwMerge = cvTwMerge(clavaTwMergeConfig);
const tvTwMerge = tvWithTwMerge(tvTwMergeConfig);

const twMergeProps = { intent: "danger", size: "lg" } as const;

describe("with tailwind-merge", () => {
  describe("create", () => {
    bench(
      "clava (transformClass: twMerge)",
      () => consume(cvTwMerge(clavaTwMergeConfig)),
      options,
    );
    bench(
      "tailwind-variants (default twMerge)",
      () => consume(tvWithTwMerge(tvTwMergeConfig)),
      options,
    );
  });

  describe("resolve", () => {
    bench(
      "clava (class)",
      () => consume(clavaTwMerge.class(twMergeProps)),
      options,
    );
    bench("clava (full)", () => consume(clavaTwMerge(twMergeProps)), options);
    bench("tailwind-variants", () => consume(tvTwMerge(twMergeProps)), options);
  });
});

export { sink };
