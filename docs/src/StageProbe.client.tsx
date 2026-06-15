"use client"

import { useEffect } from "react"

const stage = import.meta.env.VITE_PUBLIC_STAGE

export const StageProbe = () => {
  useEffect(() => {
    console.info("[liminal-docs] VITE_PUBLIC_STAGE", stage)
  }, [])

  return <meta name="liminal-docs-stage" content={stage ?? ""} />
}
