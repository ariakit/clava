export interface DocsVersion {
  label: string;
  path: string;
  slug: string;
}

export const docsVersions: DocsVersion[] = [
  {
    label: "v0",
    path: "/",
    slug: "v0",
  },
];

const [currentDocsVersion] = docsVersions;
if (!currentDocsVersion) {
  throw new Error("At least one docs version must be configured.");
}

export { currentDocsVersion };
