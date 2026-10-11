import type { ReactNode } from 'react';
import type { Perk } from '../game/types';
import type { Scenery } from '../data/campaign';

export type HordeIconName = Perk | Scenery | 'permanent' | 'temporary' | 'recruit' | 'pause' | 'clock' | 'attack' | 'check' | 'crown' | 'arrow' | 'zoom-in' | 'zoom-out';
const skull = <><path d="M8 21v-4a8 8 0 1 1 16 0v4l-4 2v5h-8v-5Z" fill="currentColor" fillOpacity=".16" /><path d="M8 21v-4a8 8 0 1 1 16 0v4l-4 2v5h-8v-5Z" /><path d="M12 24v4m4-4v4m4-4v4" /><circle cx="12.5" cy="17" r="1.4" fill="currentColor" /><circle cx="19.5" cy="17" r="1.4" fill="currentColor" /><path d="m15 21 1-2 1 2" /></>;
const symbols: Record<HordeIconName, ReactNode> = {
  permanent: skull,
  temporary: <>{skull}<path d="M23 3v5m-2.5-2.5H26M25 10a5 5 0 0 1 4 5" /></>,
  mines: <><path d="M6 25q2-6 10-6t10 6l-2 3H8Z" fill="currentColor" fillOpacity=".18" /><circle cx="16" cy="16" r="7" fill="currentColor" fillOpacity=".18" /><path d="M16 9V6l4-2m-9 10 2 3m8-3-2 3m-4 3h4M4 23l3 2m18 0 3-2M23 4l2-2m0 4h3" /></>,
  sling: <><path d="M16 28V15L7 7l3-3 6 7 6-7 3 3-9 8Z" fill="currentColor" fillOpacity=".2" /><path d="m9 6 7 11 7-11M16 17v11M20 20q8-2 8-11" strokeDasharray="2 3" /><circle cx="27" cy="6" r="2" fill="currentColor" /></>,
  feast: <><path d="M5 8h22l-3 7q-2 5-8 5T8 15Z" fill="currentColor" fillOpacity=".2" /><path d="M16 20v7m-6 1h12m-4-23 4-3m-11 3-3-3M14 7l2-4 2 4m-7 4 2 5 2-5m2 0 2 5 2-5" /></>,
  sprint: <><path d="M13 5h8l-2 11 7 4 1 7H10l-4-4 7-6Z" fill="currentColor" fillOpacity=".22" /><path d="M12 11h8m-7 4h6M3 9h6m-8 6h7m-4 6h4m2 6h17" /></>,
  vigor: <><path d="m16 3 11 5-2 13q-2 6-9 9-7-3-9-9L5 8Z" fill="currentColor" fillOpacity=".2" /><path d="M16 10v12m-6-6h12" /></>,
  fangs: <><path d="M5 7q11 6 22 0v9l-4 11-5-13h-4L9 27 5 16Z" fill="currentColor" fillOpacity=".2" /><path d="M5 10q11 7 22 0m-16 2 1 6m8-6-1 6" /></>,
  necromancy: <><path d="M8 27V13a8 8 0 0 1 16 0v14Z" fill="currentColor" fillOpacity=".15" /><path d="M16 10v10m-4-6h8M4 28h24m-18-4 3-4m8 4-3-4M3 11l3-2m23 2-3-2" /></>,
  haste: <><path d="m18 3-13 15h9l-2 12 15-18h-9l4-9Z" fill="currentColor" fillOpacity=".22" /><path d="M2 8h7m-9 17h6m21-2h4" /></>,
  lasting: <><path d="M8 4h16M8 28h16M10 4v4q0 5 6 8-6 3-6 8v4m12-24v4q0 5-6 8 6 3 6 8v4" /><path d="m12 25 4-5 4 5Z" fill="currentColor" fillOpacity=".3" /><path d="M13 9h6m-14 4-2 2m26 0-2-2" /></>,
  graveyard: <><path d="M9 28V14a7 7 0 0 1 14 0v14Z" fill="currentColor" fillOpacity=".18" /><path d="M16 11v10m-4-6h8M5 28h22" /></>,
  chapel: <><path d="m5 15 11-8 11 8v13H5Z" fill="currentColor" fillOpacity=".16" /><path d="M16 2v6m-3-4h6M12 28v-8a4 4 0 0 1 8 0v8M7 16h2m14 0h2" /></>,
  road: <><path d="m10 3-7 26m19-26 7 26M16 4v5m0 5v5m0 5v5" /><path d="M5 15h5v7H5Z" fill="currentColor" fillOpacity=".18" /></>,
  outskirts: <><path d="M5 28V12h11v16m-13-17V7h4v4h5V7h5v5M8 17h5m-5 5h5" /><path d="M24 28q-8-3-3-10l3-5 1 8 3-2q4 7-4 9Z" fill="currentColor" fillOpacity=".2" /></>,
  castle: <><path d="M4 28V9h5V5h5v4h4V5h5v4h5v19Z" fill="currentColor" fillOpacity=".18" /><path d="M12 28v-7a4 4 0 0 1 8 0v7M7 14h3m12 0h3" /></>,
  recruit: <><path d="M5 23q0-5 11-5t11 5v5H5Z" fill="currentColor" fillOpacity=".15" /><path d="M7 24q9 5 18 0M12 17V9l2-1v6-9h3v9-7h3v10M5 10H2m28 0h-3M8 5 6 3m18 2 2-2" /></>,
  pause: <path d="M10 6h4v20h-4Zm8 0h4v20h-4Z" fill="currentColor" stroke="none" />,
  clock: <><circle cx="16" cy="17" r="11" /><path d="M16 10v7l5 3M12 2h8m-4 0v4" /></>,
  attack: <><path d="m9 25 16-18 4-3-1 6-16 18Z" fill="currentColor" fillOpacity=".2" /><path d="m5 21 8 7m-7 1 4-5M5 4l8 8m-7 0 6-6" /></>,
  check: <path d="m7 16 6 6L26 8" strokeWidth="2.8" />,
  crown: <><path d="m4 9 6 5 6-9 6 9 6-5-3 17H7Z" fill="currentColor" fillOpacity=".2" /><path d="M7 23h18m-16 6h14" /></>,
  arrow: <path d="M5 16h21m-7-7 7 7-7 7" />,
  'zoom-in': <><circle cx="13" cy="13" r="8" /><path d="m19 19 10 10M9 13h8m-4-4v8" /></>,
  'zoom-out': <><circle cx="13" cy="13" r="8" /><path d="m19 19 10 10M9 13h8" /></>,
};
export function IconGlyph({ name }: { name: HordeIconName }) { return <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{symbols[name]}</g>; }
export function HordeIcon({ name, className = '' }: { name: HordeIconName; className?: string }) {
  return <svg className={`horde-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false"><IconGlyph name={name} /></svg>;
}
