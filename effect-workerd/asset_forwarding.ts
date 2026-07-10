export default {
  fetch: (request: Request, env: { readonly ASSETS: Fetcher }) => env.ASSETS.fetch(request),
}
