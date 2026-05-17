import { Schema as S } from "effect"

export const Player = S.Literals(["X", "O"])
export const Coordinate = S.Literals([0, 1, 2])
export const Coordinates = S.Tuple([Coordinate, Coordinate])
