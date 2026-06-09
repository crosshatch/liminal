import { Changelog, McpSource, type Config } from "vocs/config"

export const VocsConfig = ({ title }: { readonly title: string }) =>
  ({
    title,
    titleTemplate: `%s ⋅ ${title}`,
    accentColor: "light-dark(#6D5BD0, #A99BFF)",
    codeHighlight: {
      themes: {
        light: "nord",
        dark: "tokyo-night",
      },
    },
    checkDeadlinks: true,
    changelog: Changelog.github({
      prereleases: true,
      repo: "crosshatch/crosshatch",
    }),
    editLink: {
      link: (p: string) => `https://github.com/crosshatch/crosshatch/edit/main/docs/src/pages/${p}`,
      text: "Edit on GitHub",
    },
    mcp: {
      enabled: true,
      sources: [McpSource.github({ repo: "crosshatch/crosshatch" })],
    },
  }) satisfies Partial<Config>
