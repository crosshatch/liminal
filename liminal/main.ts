#!/usr/bin/env node

import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { Command } from "effect/unstable/cli"
import { FetchHttpClient } from "effect/unstable/http"

import { logCause } from "./_util/logCause.ts"
import { syncEnv } from "./commands/sync-env.ts"
import PackageJson from "./package.json" with { type: "json" }

Command.make("liminal").pipe(
  Command.withSubcommands([syncEnv]),
  Command.run({ version: PackageJson.version }),
  Effect.scoped,
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  Effect.tapCause(logCause),
  Effect.runFork,
)
