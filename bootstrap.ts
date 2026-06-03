import * as Alchemy from "alchemy"
import { bootstrap } from "liminal-util/alchemicals/bootstrap"
import { local } from "liminal-util/alchemicals/config"

export default Alchemy.Stack("liminal-github", local, bootstrap({ repository: "liminal" }))
