/** 'G' = grass, 'P' = path — a tile's four edges in [N, E, S, W] order */
export type Edge = 'G' | 'P'
export type Edges = [Edge, Edge, Edge, Edge]

export interface BaseTile {
  edges: Edges
  weight: number
}

export interface OrientedTile {
  edges: Edges
  weight: number
}
