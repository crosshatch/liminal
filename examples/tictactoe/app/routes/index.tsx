import { useAtomValue } from "@effect/atom-react"
import { createFileRoute } from "@tanstack/react-router"

import { stateAtom } from "@/atoms"

export const Route = createFileRoute("/")({
  component: RouteComponent,
})

function RouteComponent() {
  useAtomValue(stateAtom)
  return <div>hi</div>
}
