import { describe, expectTypeOf, test } from "vitest";
import { type CVConfig, create, cv } from "../src/index.ts";
import type { AnyRecipe, Recipe, RecipeLike, Variants } from "../src/types.ts";

const callback = (value: string) => value.toUpperCase();

describe("variants type inference", () => {
  test("function variant infers parameter type as prop type", () => {
    const button = cv({
      variants: {
        size: (value: number) => `size-${value}`,
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      size?: number;
    }>();
    button({ size: 3 });
    button({
      // @ts-expect-error string is not assignable to number
      size: "lg",
    });
  });

  test("method variant infers optional parameter type as prop type", () => {
    const grid = cv({
      variants: {
        columns(value?: number) {
          return `columns-${value}`;
        },
      },
    });
    expectTypeOf(grid.getVariants()).branded.toEqualTypeOf<{
      columns?: number;
    }>();
    grid({ columns: 3 });
    grid({ columns: undefined });
    grid({
      // @ts-expect-error string is not assignable to number
      columns: "3",
    });
  });

  test("function variant infers union parameter type", () => {
    const button = cv({
      variants: {
        tone: (value: "info" | "warn") => `tone-${value}`,
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      tone?: "info" | "warn";
    }>();
    button({ tone: "info" });
    button({ tone: "warn" });
    button({
      // @ts-expect-error "danger" is not in the union
      tone: "danger",
    });
  });

  test("function variant infers boolean parameter type", () => {
    const button = cv({
      variants: {
        active: (value: boolean) => (value ? "active" : "idle"),
      },
    });
    expectTypeOf(button.getVariants()).branded.toEqualTypeOf<{
      active?: boolean;
    }>();
    button({ active: true });
    button({ active: false });
    button({
      // @ts-expect-error string is not assignable to boolean
      active: "yes",
    });
  });

  test("function variant accepts nullable parameter", () => {
    const c = cv({
      variants: {
        color: (value: string | null) => (value ? `c-${value}` : "c-default"),
      },
    });
    expectTypeOf(c.getVariants()).branded.toEqualTypeOf<{
      color?: string | null;
    }>();
    c({ color: "red" });
    c({ color: null });
  });

  test("mixed function and object variants infer independently", () => {
    const c = cv({
      variants: {
        size: (value: number) => `s-${value}`,
        color: { red: "r", blue: "b" },
      },
    });
    expectTypeOf(c.getVariants()).branded.toEqualTypeOf<{
      size?: number;
      color?: "red" | "blue";
    }>();
    c({ size: 3, color: "red" });
    c({
      // @ts-expect-error number expected
      size: "3",
    });
    c({
      // @ts-expect-error "yellow" not in object keys
      color: "yellow",
    });
  });

  test("function variant in child overrides object variant in parent", () => {
    const base = cv({ variants: { size: { sm: "sm", lg: "lg" } } });
    const child = cv({
      extend: [base],
      variants: { size: (value: number) => `s-${value}` },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: number;
    }>();
    child({ size: 3 });
    child({
      // @ts-expect-error string is not assignable to number after override
      size: "sm",
    });
  });

  test("object variant in child overrides function variant in parent", () => {
    const base = cv({ variants: { size: (value: number) => `s-${value}` } });
    const child = cv({
      extend: [base],
      variants: { size: { sm: "child-sm", lg: "child-lg" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "lg";
    }>();
    child({ size: "sm" });
    child({
      // @ts-expect-error number is not assignable to "sm" | "lg" after override
      size: 3,
    });
  });

  test("object variant in child merges with object variant in parent", () => {
    const base = cv({ variants: { size: { sm: "base-sm", md: "base-md" } } });
    const child = cv({
      extend: [base],
      variants: { size: { lg: "child-lg" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "md" | "lg";
    }>();
    child({ size: "sm" });
    child({ size: "md" });
    child({ size: "lg" });
    child({
      // @ts-expect-error not in merged keys
      size: "xl",
    });
  });

  test("function variant in parent inherits in child without override", () => {
    const base = cv({
      variants: { size: (value: number) => `s-${value}` },
    });
    const child = cv({
      extend: [base],
      variants: { color: { red: "r" } },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: number;
      color?: "red";
    }>();
    child({ size: 5, color: "red" });
    child({
      // @ts-expect-error inherited size is still number
      size: "5",
    });
  });

  test("modal recipes preserve inherited variants when extended", () => {
    const base = cv({
      variants: { size: { sm: "sm", lg: "lg" } },
    });
    const jsx = cv({ extend: [base.jsx] });
    const html = cv({ extend: [base.html] });
    const htmlObj = cv({ extend: [base.htmlObj] });

    expectTypeOf(jsx.getVariants()).toEqualTypeOf<{
      size?: "sm" | "lg";
    }>();
    expectTypeOf(html.getVariants()).toEqualTypeOf<{
      size?: "sm" | "lg";
    }>();
    expectTypeOf(htmlObj.getVariants()).toEqualTypeOf<{
      size?: "sm" | "lg";
    }>();

    jsx({ size: "sm" });
    html({ size: "lg" });
    htmlObj({ size: "sm" });

    jsx({
      // @ts-expect-error inherited JSX modal variant rejects unknown values
      size: "md",
    });
    html({
      // @ts-expect-error inherited HTML modal variant rejects unknown values
      size: "md",
    });
    htmlObj({
      // @ts-expect-error inherited HTML object modal variant rejects unknown values
      size: "md",
    });
  });

  test("defaultVariants infers types from merged variants", () => {
    cv({
      variants: {
        size: (value: number) => `s-${value}`,
        color: { red: "r", blue: "b" },
      },
      defaultVariants: { size: 3, color: "red" },
    });
    cv({
      variants: { size: (value: number) => `s-${value}` },
      defaultVariants: {
        // @ts-expect-error string is not assignable to number
        size: "3",
      },
    });
  });

  test("computed defaultVariants infer defaultValue and variants", () => {
    cv({
      variants: {
        size: (value: number) => `s-${value}`,
        color: { red: "r", blue: "b" },
      },
      defaultVariants: {
        size: (defaultValue, variants) => {
          expectTypeOf(defaultValue).toEqualTypeOf<number | undefined>();
          expectTypeOf(variants.color).toEqualTypeOf<
            "red" | "blue" | undefined
          >();
          return variants.color === "red" ? 10 : defaultValue;
        },
      },
    });
    cv({
      variants: { size: (value: number) => `s-${value}` },
      defaultVariants: {
        // @ts-expect-error string is not assignable to number
        size: () => "10",
      },
    });
  });

  test("computed defaultVariants method infers defaultValue and variants", () => {
    cv({
      variants: {
        compact: { true: "compact", false: "" },
        size(value?: number) {
          return `s-${value}`;
        },
      },
      defaultVariants: {
        size(defaultValue, variants) {
          expectTypeOf(defaultValue).toEqualTypeOf<number | undefined>();
          expectTypeOf(variants.compact).toEqualTypeOf<boolean | undefined>();
          return variants.compact ? 2 : defaultValue;
        },
      },
    });
    cv({
      variants: {
        size(value?: number) {
          return `s-${value}`;
        },
      },
      defaultVariants: {
        // @ts-expect-error string is not assignable to number
        size() {
          return "10";
        },
      },
    });
  });

  test("function-valued defaultVariants must return the function", () => {
    cv({
      variants: {
        transform: (value: (value: string) => string) => value("a"),
      },
      defaultVariants: {
        transform: () => callback,
      },
    });
    cv({
      variants: {
        transform: (value: (value: string) => string) => value("a"),
      },
      defaultVariants: {
        // @ts-expect-error function values must be returned from a computed default
        transform: callback,
      },
    });
  });

  test("mixed function-valued defaultVariants must return the function", () => {
    cv({
      variants: {
        transform: (value: ((value: string) => string) | "none") => {
          return value === "none" ? "none" : value("a");
        },
      },
      defaultVariants: {
        transform: "none",
      },
    });
    cv({
      variants: {
        transform: (value: ((value: string) => string) | "none") => {
          return value === "none" ? "none" : value("a");
        },
      },
      defaultVariants: {
        transform: () => callback,
      },
    });
    cv({
      variants: {
        transform: (value: ((value: string) => string) | "none") => {
          return value === "none" ? "none" : value("a");
        },
      },
      defaultVariants: {
        // @ts-expect-error function values must be returned from a computed default
        transform: callback,
      },
    });
  });

  test("refine callback sees function variant param type", () => {
    cv({
      variants: { size: (value: number) => `s-${value}` },
      refine: ({ variants, setVariants }) => {
        expectTypeOf(variants.size).toEqualTypeOf<number | undefined>();
        setVariants({ size: 10 });
        setVariants({
          // @ts-expect-error string not assignable to number
          size: "10",
        });
      },
    });
  });

  test("refine method infers context from method variants", () => {
    cv({
      variants: {
        size(value?: number) {
          return `s-${value}`;
        },
      },
      refine({ variants, setVariants }) {
        expectTypeOf(variants.size).toEqualTypeOf<number | undefined>();
        setVariants({ size: 10 });
        setVariants({
          // @ts-expect-error string not assignable to number
          size: "10",
        });
      },
    });
  });

  test("function variant return type accepts ClassValue and StyleClassValue", () => {
    cv({
      variants: {
        a: (_value: number) => "class-a",
        b: (_value: number) => null,
        c: (_value: number) => undefined,
        d: (_value: number) => ["x", "y"],
        e: (_value: number) => ({ class: "c", style: { color: "red" } }),
        f: (_value: number) => ({ style: { color: "red" } }),
      },
    });
  });

  test("variantKeys includes function variant keys", () => {
    const c = cv({
      variants: {
        size: { sm: "sm" },
        columns: (value: number) => `cols-${value}`,
      },
    });
    expectTypeOf(c.variantKeys).toEqualTypeOf<("size" | "columns")[]>();
  });

  test("intermediate object variant hides grandparent function variant from descendants", () => {
    const base = cv({
      variants: { size: (value: number) => `s-${value}` },
    });
    const middle = cv({
      extend: [base],
      variants: { size: { sm: "middle-sm", md: "middle-md" } },
    });
    // Descendant has no own `size` — it should inherit `middle`'s object,
    // not the grandparent function. The intersection used to leak through.
    const descendant = cv({ extend: [middle] });
    expectTypeOf(descendant.getVariants()).branded.toEqualTypeOf<{
      size?: "sm" | "md";
    }>();
    descendant({ size: "sm" });
    descendant({
      // @ts-expect-error grandparent function is no longer in the chain
      size: 3,
    });
  });

  test("null disables inherited function variant", () => {
    const base = cv({
      variants: {
        size: (value: number) => `s-${value}`,
      },
    });
    const child = cv({
      extend: [base],
      variants: { size: null },
    });
    expectTypeOf(child.getVariants()).branded.toEqualTypeOf<{
      size?: never;
    }>();
    child({
      // @ts-expect-error size was disabled
      size: 1,
    });
  });

  describe("sibling extends", () => {
    const reader = cv({ variants: { tone: { loud: "a", calm: "b" } } });
    const filtered = cv({
      extend: [reader],
      variants: { tone: { loud: null } },
    });
    const other = cv({ variants: { tone: { loud: "x", calm: "y" } } });

    test("sibling that disables a value keeps the other values", () => {
      const filteredLast = cv({ extend: [other, filtered] });
      const filteredFirst = cv({ extend: [filtered, other] });
      expectTypeOf(filteredLast.getVariants()).toEqualTypeOf<{
        tone?: "calm";
      }>();
      expectTypeOf(filteredFirst.getVariants()).toEqualTypeOf<{
        tone?: "calm";
      }>();
      filteredLast({ tone: "calm" });
      filteredFirst({ tone: "calm" });
      filteredLast({
        // @ts-expect-error a sibling disabled loud
        tone:
          // no error
          "loud",
      });
      filteredFirst({
        // @ts-expect-error a sibling disabled loud
        tone:
          // no error
          "loud",
      });
    });

    test("nested recipe keeps the merged sibling values", () => {
      const merged = cv({ extend: [other, filtered] });
      const recipe = cv({
        extend: [merged],
        variants: { tone: { soft: "z" } },
        defaultVariants: { tone: "calm" },
      });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        tone?: "calm" | "soft";
      }>();
    });

    test("sibling that disables a variant keeps the other variants", () => {
      const enabled = cv({ variants: { flag: "on", size: { sm: "sm" } } });
      const disabled = cv({ extend: [enabled], variants: { flag: null } });
      const recipe = cv({ extend: [enabled, disabled] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        flag?: never;
        size?: "sm";
      }>();
      recipe({ size: "sm" });
      recipe({
        // @ts-expect-error a sibling disabled flag
        flag: true,
      });
    });

    test("sibling boolean values keep their shared value", () => {
      const yes = cv({ variants: { state: { on: true, off: "yes" } } });
      const no = cv({ variants: { state: { on: false, off: "no" } } });
      const recipe = cv({ extend: [yes, no] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        state?: "on" | "off";
      }>();
    });

    test("recipe can enable a variant that a sibling disabled", () => {
      const enabled = cv({ variants: { flag: "on", size: { sm: "sm" } } });
      const disabled = cv({ extend: [enabled], variants: { flag: null } });
      const merged = cv({ extend: [enabled, disabled] });
      const recipe = cv({
        extend: [merged],
        variants: { flag: { yes: "yes" } },
      });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        flag?: "yes";
        size?: "sm";
      }>();
    });

    test("any-typed sibling value stays enabled", () => {
      const styles: any = { sm: "css-sm" };
      const untyped = cv({ variants: { size: { sm: styles.sm, lg: "lg" } } });
      const typed = cv({ variants: { size: { sm: "sm", lg: "lg" } } });
      const recipe = cv({ extend: [untyped, typed] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: "sm" | "lg";
      }>();
    });

    test("nullable sibling variant keeps its declared values", () => {
      const definition = { sm: "x" } as null | { sm: string };
      const base = cv({ variants: { size: { sm: "a" } } });
      const maybe = cv({ variants: { size: definition } });
      const recipe = cv({ extend: [base, maybe] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: "sm";
      }>();
      recipe({
        // @ts-expect-error charAt isn't a declared value
        size: "charAt",
      });
    });

    test("disabled variant stays disabled in a nested sibling merge", () => {
      const enabled = cv({ variants: { flag: "on", size: { sm: "sm" } } });
      const disabled = cv({ extend: [enabled], variants: { flag: null } });
      const merged = cv({ extend: [enabled, disabled] });
      const unrelated = cv({ variants: { gap: { sm: "g" } } });
      const recipe = cv({ extend: [merged, unrelated] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        flag?: never;
        size?: "sm";
        gap?: "sm";
      }>();
    });

    test("any-typed sibling definition stays untyped", () => {
      const sizes: any = { sm: "css-sm" };
      const untyped = cv({ variants: { size: sizes } });
      const unrelated = cv({ variants: { gap: { sm: "g" } } });
      const recipe = cv({ extend: [untyped, unrelated] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: unknown;
        gap?: "sm";
      }>();
    });

    test("any-typed sibling recipe keeps the shared values", () => {
      const untyped: AnyRecipe = cv({ variants: { size: { sm: "a" } } });
      const typed = cv({ variants: { size: { sm: "b" } } });
      const recipe = cv({ extend: [untyped, typed] });
      recipe({ size: "sm" });
    });

    test("sibling function variant keeps its parameter type", () => {
      const scale = cv({ variants: { size: (value: number) => `s-${value}` } });
      const unrelated = cv({ variants: { gap: { sm: "g" } } });
      const recipe = cv({ extend: [scale, unrelated] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: number;
        gap?: "sm";
      }>();
    });

    test("optional sibling variant keeps its declared values", () => {
      const variants: { size?: { sm: string } } = { size: { sm: "a" } };
      const optional = cv({ variants });
      const required = cv({ variants: { size: { sm: "b" } } });
      const recipe = cv({ extend: [optional, required] });
      recipe({ size: "sm" });
      recipe({
        // @ts-expect-error charAt isn't a declared value
        size: "charAt",
      });
    });

    test("sibling scalar boolean variants stay enabled", () => {
      const yes = cv({ variants: { flag: true } });
      const no = cv({ variants: { flag: false } });
      const recipe = cv({ extend: [yes, no] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{ flag?: boolean }>();
    });

    test("sibling values merge across three recipes", () => {
      const third = cv({ variants: { tone: { soft: "z" }, gap: { sm: "g" } } });
      const recipe = cv({ extend: [other, filtered, third] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        tone?: "calm" | "soft";
        gap?: "sm";
      }>();
    });

    test("union-typed sibling keeps the values of each member", () => {
      const first = cv({ variants: { size: { sm: "a" } } });
      const second = cv({ variants: { size: { lg: "b" } } });
      const third = cv({ variants: { size: { xl: "c" } } });
      // The cast keeps TypeScript from narrowing the condition to one branch.
      const recipe = cv({
        extend: [(false as boolean) ? first : second, third],
      });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: "sm" | "lg" | "xl";
      }>();
    });

    test("union-typed definition keeps the values of each member", () => {
      // The cast keeps TypeScript from narrowing the definition to one member.
      const definition = { sm: "a" } as { sm: string } | { lg: string };
      const first = cv({ variants: { size: definition } });
      const second = cv({ variants: { size: { xl: "b" } } });
      const recipe = cv({ extend: [first, second] });
      expectTypeOf(recipe.getVariants()).toEqualTypeOf<{
        size?: "sm" | "lg" | "xl";
      }>();
    });

    test("generic sibling keeps variant reads", () => {
      const disclosure = cv({ variants: { open: "a" } });
      const sibling = cv({ variants: { size: { sm: "b" } } });
      const readSize = <R extends RecipeLike<typeof disclosure, R>>(
        recipe: R,
      ) => cv({ extend: [recipe, sibling] }).getVariants().size;
      expectTypeOf(readSize(disclosure)).toEqualTypeOf<"sm" | undefined>();
    });
  });
});

function wrap<V extends Variants = {}, const E extends AnyRecipe[] = []>(
  config: CVConfig<V, E>,
): Recipe<V, E> {
  return cv(config);
}

function createFactory<V extends Variants>(variants: V) {
  const recipe = cv({ variants });
  return { keys: recipe.variantKeys, getVariants: recipe.getVariants };
}

function createExtended<const E extends AnyRecipe[]>(extend: E) {
  return cv({ extend });
}

function dropExtend<V extends Variants, const E extends AnyRecipe[]>(
  config: CVConfig<V, E>,
): Recipe<V> {
  // @ts-expect-error the return type omits E
  return cv(config);
}

function dropVariants<V extends Variants, const E extends AnyRecipe[]>(
  config: CVConfig<V, E>,
): Recipe<{}, E> {
  // @ts-expect-error the return type omits V
  return cv(config);
}

describe("inline recipes in extend", () => {
  test("infers a single inline recipe", () => {
    const button = cv({
      extend: [cv({ variants: { size: { sm: "sm" } } })],
    });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{
      size?: "sm";
    }>();
    expectTypeOf(button).toEqualTypeOf<
      Recipe<{}, [Recipe<{ size: { sm: string } }>]>
    >();
  });

  test("infers an inline recipe next to a stored recipe", () => {
    const size = cv({ variants: { size: { sm: "sm" } } });
    const button = cv({
      extend: [size, cv({ variants: { other: "other" } })],
      variants: { own: "own" },
    });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{
      size?: "sm";
      other?: boolean;
      own?: boolean;
    }>();
    button({
      // @ts-expect-error invalid size
      size:
        // no error
        "lg",
    });
  });

  test("infers nested inline recipes", () => {
    const button = cv({
      extend: [cv({ extend: [cv({ variants: { size: { sm: "sm" } } })] })],
    });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{
      size?: "sm";
    }>();
  });

  test("infers an inline call to a wrapper that is generic only in E", () => {
    const size = cv({ variants: { size: { sm: "sm" } } });
    const button = cv({ extend: [createExtended([size])] });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{ size?: "sm" }>();
  });

  test("infers inline recipes with create()", () => {
    const { cv: customCV } = create();
    const button = customCV({
      extend: [customCV({ variants: { size: { sm: "sm" } } })],
    });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{
      size?: "sm";
    }>();
  });

  test("types defaults and refine from an inline recipe", () => {
    cv({
      extend: [cv({ variants: { size: { sm: "sm" } } })],
      defaultVariants: { size: "sm" },
      refine: ({ variants }) => {
        expectTypeOf(variants.size).toEqualTypeOf<"sm" | undefined>();
      },
    });
  });

  test("rejects an inline value that is not a recipe", () => {
    // The call stays unexecuted because invalid extend values have no runtime
    // contract.
    expectTypeOf(() =>
      cv({
        extend: [
          // @ts-expect-error not a recipe
          "recipe",
        ],
      }),
    ).toBeFunction();
  });

  test("keeps generic variants in cv() results", () => {
    const factory = createFactory({ size: { sm: "sm" } });
    expectTypeOf(factory.keys).toEqualTypeOf<"size"[]>();
    factory.getVariants({
      // @ts-expect-error invalid size
      size:
        // no error
        "lg",
    });
    expectTypeOf(dropExtend).toBeFunction();
    expectTypeOf(dropVariants).toBeFunction();
  });

  test("keeps annotated and generic recipes assignable", () => {
    const button: Recipe<{ size: { sm: string } }> = cv({
      variants: { size: { sm: "sm" } },
    });
    expectTypeOf(button.getVariants()).toEqualTypeOf<{
      size?: "sm";
    }>();
    expectTypeOf(
      wrap({ extend: [cv({ variants: { own: "own" } })] }).getVariants(),
    ).toEqualTypeOf<{ own?: boolean }>();
  });
});
