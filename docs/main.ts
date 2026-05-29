interface AssetsBinding {
  fetch: (request: Request) => Response | Promise<Response>
}

export default {
  fetch: (request: Request, env: { ASSETS: AssetsBinding }) =>
    env.ASSETS.fetch(request),
}
