import { alive, centerOf } from './world';
import { RULES } from './rules';
import type { Encounter, Point } from './types';
export function boundedDestination(p: Point): Point | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  return { x: Math.max(-RULES.halfWidth + 2, Math.min(RULES.halfWidth - 2, p.x)), z: Math.max(-RULES.halfDepth + 2, Math.min(RULES.halfDepth - 2, p.z)) };
}
export function destinationDirection(world: Encounter, target: Point | null): { x: number; z: number; arrived: boolean } {
  const members = alive(world).filter(z => !z.locked);
  if (!target || !members.length) return { x: 0, z: 0, arrived: true };
  const center = centerOf(members), x = target.x - center.x, z = target.z - center.z, length = Math.hypot(x, z);
  if (length <= 0.45) return { x: 0, z: 0, arrived: true };
  return { x: x / length, z: z / length, arrived: false };
}
