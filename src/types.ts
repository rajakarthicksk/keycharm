// The "settings form" every charm fills in (charm.json).
export interface CharmConfig {
  name: string;
  image: string;            // file name inside the charm folder
  size: number;             // longest side of the charm, in screen pixels
  thickness: number;        // how thick the sticker is (fraction of size)
  ring: [number, number];   // where the thread ties on the picture (0..1, from top-left)
  weight: number;           // 0.1 feather ... 3 heavy
  threadLength: number;     // pixels
  threadStyle: "solid" | "dotted";
  threadColor: string;
  drag: number;             // air resistance. higher = settles faster
  spin: number;             // how much it twists when you move the mouse
  twistStiffness: number;   // how strongly the thread untwists
  twistDamping: number;     // 0.05 = keeps twisting a long time, 1 = no wobble
  glow: boolean;
  glowColor: string;
  glowSize: number;         // glow size as a multiple of charm size
}

export const DEFAULT_CHARM: CharmConfig = {
  name: "Charm",
  image: "charm.png",
  size: 90,
  thickness: 0.2,
  ring: [0.5, 0.05],
  weight: 1,
  threadLength: 130,
  threadStyle: "solid",
  threadColor: "#8a8a8a",
  drag: 0.02,
  spin: 1,
  twistStiffness: 28,
  twistDamping: 0.3,
  glow: false,
  glowColor: "#ffd45a",
  glowSize: 2.2,
};

export function withDefaults(c: Partial<CharmConfig>): CharmConfig {
  return { ...DEFAULT_CHARM, ...c };
}

// Messages between content script and background worker.
export type GetCharmRequest = { type: "getCharm"; id?: string };
export type GetCharmResponse =
  | { ok: true; id: string; config: Partial<CharmConfig>; mime: string; base64: string }
  | { ok: false; error: string };
