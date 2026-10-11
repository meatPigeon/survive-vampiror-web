// Godot defaults: scripts/gameplay/*.gd and scenes/main.tscn at source dc97542.
import { CAMPAIGN } from '../data/campaign';
import { PERK_INFO } from '../data/perks';
import type { Perk } from './types';
export const RULES = {
  count: 40, zombieHealth: 30, knightHealth: 800, waveHealthIncrease: 200, waves: CAMPAIGN.length, waveBreak: 4,
  halfWidth: 30, halfDepth: 22, zombieRadius: 0.28, knightRadius: 0.55,
  spawnX: -8, spawnZ: 3, spawnSpacing: 0.8, maxAgents: 60, lifetime: 45,
  speed: 3.6, cohesionRadius: 4, separationRadius: 1.2, separationStrength: 7,
  knightSpeed: 1.5, biteRange: 1.15, biteDamage: 4, biteInterval: 0.8,
  attackRange: 2.2, attackDamage: 15, windup: 1.3, strike: 0.18, recovery: 1.4,
  chargeRange: 8, chargeWidth: 2, chargeDamage: 20, chargeWindup: 1.5, chargeDuration: 0.7, chargeRecovery: 2,
  spinRadius: 3.2, spinDamage: 20, spinWindup: 1.8, spinDuration: 0.5, spinRecovery: 2.4,
  crossbowRange: 16, crossbowMinRange: 3.5, crossbowWindup: 1.2, crossbowRecovery: 1.6, crossbowInterval: 6,
  boltSpeed: 16, boltRadius: 0.4,
  rushRange: 16, rushWindup: 1.4, rushDuration: 4.2, rushRecovery: 2.8, rushInterval: 14,
  rushSpeed: 8, rushAcceleration: 12, rushTurnSpeed: 50, rushTurnAcceleration: 100, rushWidth: 2, rushDamage: 20,
  sprintDuration: 1.4, sprintCooldown: 7, sprintMultiplier: 2,
  siteInterval: 30, siteRespawnDelay: 5, reserves: 12, siteRadius: 2.4, summonTime: 2,
  fuseDuration: 2, blastRadius: 2.8, blastDamage: 45, mineCooldown: 8,
  slingRange: 22, slingSpread: 2.5, flightDuration: 0.8, flightHeight: 3.5, impactRadius: 2, impactDamage: 100, slingCooldown: 2.5,
  feastDuration: 5, feastCooldown: 15, feastIntervalScale: 0.5, feastHealing: 2,
} as const;
export const PERKS = Object.keys(PERK_INFO) as Perk[];
export const PERK_TITLES = Object.fromEntries(PERKS.map(perk => [perk, PERK_INFO[perk].title])) as Record<Perk, string>;
export const SITES = [
  { name: "West", x: -14, z: -8 },
  { name: "South", x: -10, z: 10 },
  { name: "East", x: 14, z: 8 },
  { name: "North", x: 6, z: -13 },
  { name: "Northeast", x: 22, z: -7 },
];
