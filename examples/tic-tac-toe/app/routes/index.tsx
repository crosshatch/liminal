import { useAtomValue } from "@effect-atom/atom-react"
import { createFileRoute } from "@tanstack/react-router"

import { stateAtom } from "@/atoms"

export const Route = createFileRoute("/")({
  component: RouteComponent,
})

function RouteComponent() {
  const state = useAtomValue(stateAtom)
  console.log(state)
  return <div>hi</div>
}
