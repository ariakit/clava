import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { generateApiReference } from "./src/lib/generate-api-reference.ts";
import { generateChangelogPage } from "./src/lib/generate-changelog-page.ts";
import { virtualModuleOptimizeDepsExclude } from "./src/lib/vite-deps.ts";

await generateApiReference({
  outputDir: new URL("./src/content/docs/reference/api/", import.meta.url),
  repoBaseUrl: "https://github.com/ariakit/clava/blob/main/",
  sourceFile: new URL("../packages/clava/src/index.ts", import.meta.url),
  tsconfigFile: new URL("../packages/clava/tsconfig.json", import.meta.url),
});
await generateChangelogPage({
  outputFile: new URL(
    "./src/content/docs/reference/changelog.mdx",
    import.meta.url,
  ),
  sourceFile: new URL("../packages/clava/CHANGELOG.md", import.meta.url),
});

export default defineConfig({
  adapter: cloudflare({
    prerenderEnvironment: "node",
  }),
  site: "https://clava.style",
  vite: {
    optimizeDeps: {
      exclude: [...virtualModuleOptimizeDepsExclude],
    },
    ssr: {
      optimizeDeps: {
        exclude: [...virtualModuleOptimizeDepsExclude],
      },
    },
  },
  integrations: [
    starlight({
      title: "Clava",
      description: "Type-safe class variance for building reusable style APIs.",
      customCss: ["./src/styles/docs.css"],
      social: [
        {
          href: "https://github.com/ariakit/clava",
          icon: "github",
          label: "GitHub",
        },
      ],
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
      },
      sidebar: [
        {
          label: "Start",
          items: [
            { slug: "start/overview" },
            { slug: "start/installation" },
            { slug: "start/quick-start" },
            { slug: "start/first-component" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Core Concepts",
              items: [
                { slug: "guides/core-concepts/variants-defaults" },
                { slug: "guides/core-concepts/computed-behavior" },
                { slug: "guides/core-concepts/composition" },
                { slug: "guides/core-concepts/output-modes" },
              ],
            },
            {
              label: "Recipes",
              items: [
                { slug: "guides/recipes/design-system-patterns" },
                { slug: "guides/recipes/split-props-patterns" },
                { slug: "guides/recipes/migration-from-cva" },
                { slug: "guides/recipes/interop-patterns" },
              ],
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/public-api" },
            {
              label: "API Symbols",
              autogenerate: { directory: "reference/api" },
            },
            { slug: "reference/changelog" },
          ],
        },
      ],
    }),
    mdx(),
  ],
});
