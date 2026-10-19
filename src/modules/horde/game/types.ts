export interface Point { x: number; z: number }
export type Outcome = "ready" | "playing" | "won" | "lost";
export type ActivePerk = "mines" | "sling" | "feast";
export type PassivePerk = "vigor" | "fangs" | "necromancy" | "haste" | "lasting";
export type Perk = ActivePerk | PassivePerk | "sprint";
export type Attack = "sweep" | "charge" | "spin" | "crossbow" | "rush" | "bash" | "consecration" | "lance" | "firebomb" | "shockwave";
export type KnightState = "hunt" | "windup" | "strike" | "recovery" | "stopped";
export interface Zombie extends Point {
  id: number; kind: "permanent" | "temporary"; hp: number; maxHp: number; bite: number;
  lifetime: number; expired: boolean; locked: boolean; feasting: boolean;
  facing: number; moving: boolean; speed: number; flash: number; deadFor: number; airborne: number; flightSpin: number;
}
export interface Bolt extends Point { flying: boolean; direction: Point; remaining: number }
export interface Knight extends Point {
  hp: number; maxHp: number; facing: number; phase: number; state: KnightState; attack: Attack;
  timer: number; attackNumber: number; flash: number; moving: boolean;
  origin: Point; direction: Point; chargeEnd: Point; target: Point; hitIds: number[];
  crossbowCooldown: number; rushCooldown: number; specialCooldown: number; rushSpeed: number; rushTurn: number; bolt: Bolt;
}
export interface Ability {
  upgrade: ActivePerk | null; cooldown: number; fuse: number; feast: number; armed: number[];
  projectile: number | null; flightElapsed: number; launch: Point; landing: Point;
  aiming: boolean; aim: Point; aimValid: boolean; aimOnGround: boolean;
}
export interface GameEvent {
  type: string; attack?: Attack; upgrade?: Perk; x?: number; z?: number; radius?: number; amount?: number;
}
export interface Encounter {
  status: Outcome; normal: boolean; paused: boolean; elapsed: number; levelElapsed: number; zombies: Zombie[]; knight: Knight;
  wave: number; betweenWaves: boolean; awaitingReward: boolean; offeredRewards: Perk[]; waveTimeLeft: number;
  sprintUnlocked: boolean; sprintRemaining: number; sprintCooldown: number; abilities: Ability[]; passives: PassivePerk[];
  casualties: number; recruited: number; expiredCount: number; nextId: number;
  activeSite: number | null; lastSite: number | null; nextSiteAt: number; siteProgress: number;
  rng: number; events: GameEvent[];
}
