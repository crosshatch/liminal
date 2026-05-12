import { runtime } from "./runtime"
import { TicTacToeClient } from "@liminal-examples/tictactoe/TicTacToeClient"

export const stateAtom = runtime.atom(TicTacToeClient.state)
