export default {
  fetch: (
    request: Request,
    env: {
      readonly ASSETS: {
        readonly fetch: (request: Request) => Promise<Response>
      }
    },
  ) => env.ASSETS.fetch(request),
}
