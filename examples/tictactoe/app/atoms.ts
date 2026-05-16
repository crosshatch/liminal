import { TicTacToeClient } from "@liminal-examples/tictactoe/TicTacToeClient"

import { runtime } from "./runtime"

export const stateAtom = runtime.atom(TicTacToeClient.state)
