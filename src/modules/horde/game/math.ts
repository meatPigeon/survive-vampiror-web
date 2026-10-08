import type { Point } from "./types";
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const length = (p: Point) => Math.hypot(p.x, p.z);
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, z: a.z - b.z });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, z: a.z + b.z });
export const scale = (a: Point, n: number): Point => ({ x: a.x * n, z: a.z * n });
export const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z;
export const normalized = (p: Point): Point => length(p) > 1e-12 ? scale(p, 1 / length(p)) : { x: 0, z: 0 };
export const limited = (p: Point, limit = 1): Point => length(p) > limit ? scale(p, limit / length(p)) : p;
export const rotate = (p: Point, angle: number): Point => ({ x: p.x * Math.cos(angle) + p.z * Math.sin(angle), z: p.z * Math.cos(angle) - p.x * Math.sin(angle) });
export const lerp = (a: Point, b: Point, t: number): Point => add(a, scale(subtract(b, a), t));
export const moveToward = (n: number, target: number, delta: number) => n + clamp(target - n, -delta, delta);
export const angleBetween = (from: Point, to: Point) => Math.atan2(from.z * to.x - from.x * to.z, dot(from, to));
export const closest = (point: Point, from: Point, to: Point): Point => {
  const line = subtract(to, from), square = dot(line, line);
  return square > 0 ? add(from, scale(line, clamp(dot(subtract(point, from), line) / square, 0, 1))) : from;
};
