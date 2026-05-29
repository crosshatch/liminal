export default {
  fetch: (request: Request, env: { ASSETS: Fetcher }) => env.ASSETS.fetch(request),
}
