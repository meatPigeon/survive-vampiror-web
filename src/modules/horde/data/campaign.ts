export type SignatureAttack = 'bash' | 'consecration' | 'lance' | 'firebomb' | 'shockwave';
export type Scenery = 'graveyard' | 'chapel' | 'road' | 'outskirts' | 'castle';
export interface LocationDefinition {
  id: Scenery; name: string; shortName: string; subtitle: string; defender: string; craterName: string;
  hp: number; knightModel: 1 | 2 | 3; special: SignatureAttack;
  palette: { sky: number; moon: number; fill: number; low: number; soil: number; stone: number; accent: number };
}

// Ordered campaign data is the single source for progression, defenders and environment themes.
// A later location is another entry, without changing wave counters or victory checks.
export const CAMPAIGN = [
  { id: 'graveyard', name: 'Village Graveyard', shortName: 'Graveyard', subtitle: 'The dead rise. The village is unprepared.', defender: 'Village Watchman', craterName: 'Open graves', hp: 800, knightModel: 1, special: 'bash',
    palette: { sky: 0x152b30, moon: 0xd3e6ff, fill: 0xffd1a2, low: 0x59694a, soil: 0x364a35, stone: 0x66756e, accent: 0xb4d3a0 } },
  { id: 'chapel', name: 'Village Chapel', shortName: 'Chapel', subtitle: 'Bells sound. The doors are barricaded.', defender: 'Chapel Guardian', craterName: 'Burial pits', hp: 1000, knightModel: 2, special: 'consecration',
    palette: { sky: 0x233e44, moon: 0xdce7e0, fill: 0xffddb0, low: 0x607461, soil: 0x4f6455, stone: 0xb5b2a0, accent: 0x8eaead } },
  { id: 'road', name: 'Royal Road', shortName: 'Royal Road', subtitle: 'The kingdom has heard of your march.', defender: 'Royal Lancer', craterName: 'Roadside graves', hp: 1200, knightModel: 3, special: 'lance',
    palette: { sky: 0x293e35, moon: 0xdce6d4, fill: 0xffd4a1, low: 0x697650, soil: 0x526449, stone: 0x94866a, accent: 0xb79c64 } },
  { id: 'outskirts', name: 'Fortress Outskirts', shortName: 'Outskirts', subtitle: 'They burn their own land to stop you.', defender: 'Ashbound Warden', craterName: 'Burned burial mounds', hp: 1450, knightModel: 2, special: 'firebomb',
    palette: { sky: 0x343b39, moon: 0xded8c8, fill: 0xf2c38e, low: 0x655f50, soil: 0x6b6150, stone: 0x8d8070, accent: 0xba8759 } },
  { id: 'castle', name: 'Castle Courtyard', shortName: 'Castle', subtitle: 'The last champion guards the heart of the kingdom.', defender: 'Crown Champion', craterName: 'Royal tombs', hp: 1800, knightModel: 3, special: 'shockwave',
    palette: { sky: 0x2d3d49, moon: 0xdce2e6, fill: 0xffd9a5, low: 0x657463, soil: 0x596657, stone: 0xa9a8a0, accent: 0x8da8b5 } },
] as const satisfies readonly LocationDefinition[];

export function locationForWave(wave: number): LocationDefinition {
  return CAMPAIGN[Math.min(CAMPAIGN.length - 1, Math.max(0, Math.floor(wave) - 1))]!;
}
