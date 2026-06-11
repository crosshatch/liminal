import { Changelog, type Config } from "vocs/config"

export const VocsConfig = ({ title, repo }: { readonly title: string; readonly repo: string }) =>
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
      repo: `crosshatch/${repo}`,
    }),
    editLink: {
      link: `https://github.com/crosshatch/${repo}/edit/main/docs/src/pages/:path`,
      text: "Edit on GitHub",
    },
  }) satisfies Partial<Config>
