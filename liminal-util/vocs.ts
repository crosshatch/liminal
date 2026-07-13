import { Changelog, McpSource, type Config } from "vocs/config"

export const VocsConfig = ({ title, repo }: { readonly title: string; readonly repo: string }) => {
  return {
    title,
    titleTemplate: `%s ⋅ ${title}`,
    accentColor: "light-dark(#6D5BD0, #A99BFF)",
    codeHighlight: {
      themes: {
        light: "github-light",
        dark: "tokyo-night",
      },
    },
    checkDeadlinks: true,
    changelog: Changelog.github({
      repo: `crosshatch/${repo}`,
      prereleases: true,
    }),
    editLink: {
      link: `https://github.com/crosshatch/${repo}/edit/main/docs/src/pages/:path`,
      text: "Edit on GitHub",
    },
    renderStrategy: "full-static",
    mcp: {
      enabled: true,
      sources: [
        McpSource.github({
          repo: `crosshatch/${repo}`,
        }),
      ],
    },
    ogImageUrl: (_path, { baseUrl }) => `${baseUrl ?? ""}/api/og?title=%title&description=%description`,
  } satisfies Partial<Config>
}
