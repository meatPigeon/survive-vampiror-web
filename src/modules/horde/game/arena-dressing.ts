import type { Object3D } from 'three';

// Reuse the authored rock/plant meshes, but gather them into uneven, open clusters.
// Absolute placements make this safe to reapply after a source asset reload.
const ROCKS = [
  [-34.2, -18.7], [-35.1, -13.5], [-33.4, 4.8], [-36.5, 8.4],
  [33.7, -9.4], [35.3, -5.6], [33.2, 17.2], [37.8, 20.2],
  [-26.5, -25.8], [-21.2, -27.6], [-4.7, -25.2], [12.8, -27.8], [25.2, -25.8],
  [-24.6, 26.7], [-20.5, 25.6], [1.6, 25.4], [16.2, 28.1], [24.7, 25.9],
  [-39.5, -20.5], [39, 11.5], [-16, -33], [26, 33],
] as const;
const SCRUB = [
  [-32.5, -17.5], [-35, -15.4], [-32.3, 2.7], [-34.1, 7.2],
  [32.8, -12.6], [35.4, -8.1], [32.5, 15.1], [35.7, 20.8],
  [-27.3, -25], [-23, -27], [-6.7, -24.6], [10.2, -26.5], [26.8, -25.6],
  [23.1, 26.6], [15.1, 28], [3.2, 24.8], [-19.1, 25.2], [-25.6, 28.1],
] as const;

export function loosenEnvironment(environment: Object3D) {
  for (const [name, positions] of [['Rocks', ROCKS], ['Scrub', SCRUB]] as const) {
    const group = environment.getObjectByName(name);
    positions.forEach(([x, z], index) => {
      const prop = group?.getObjectByName(`${name}${index + 1}`);
      if (!prop) return;
      prop.position.set(x, 0, z);
      prop.rotation.y = Math.sin(index * 2.17 + (name === 'Scrub' ? 1.4 : 0)) * .65;
    });
  }
}
