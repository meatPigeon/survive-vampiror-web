import { v } from '@idosgames/react/ui';
import { parseLevelBoard } from '../../shared/level-leaderboards';
import type { LeaderboardDefinitionView } from './model';

export function LevelBoardPicker({ boards, id, onChange }: { boards: (LeaderboardDefinitionView & { LeaderboardID: string })[]; id: string; onChange: (id: string) => void }) {
  const current = parseLevelBoard(id)!;
  const levels = boards.filter(b => parseLevelBoard(b.LeaderboardID)?.normal === current.normal)
    .sort((a, b) => parseLevelBoard(a.LeaderboardID)!.wave - parseLevelBoard(b.LeaderboardID)!.wave);
  const selectStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box' as const, minHeight: 44, borderRadius: 8, padding: '8px 10px', color: v.text, background: v.panelDeep, border: `1px solid ${v.line}`, font: 'inherit' };
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
    <label style={{ minWidth: 0 }}>Difficulty<select style={selectStyle} value={current.normal ? 'relentless' : 'adventure'} onChange={event => {
      const normal = event.target.value === 'relentless';
      const candidates = boards.filter(b => parseLevelBoard(b.LeaderboardID)?.normal === normal);
      const next = candidates.find(b => parseLevelBoard(b.LeaderboardID)?.wave === current.wave) ?? candidates[0];
      if (next) onChange(next.LeaderboardID);
    }}><option value="adventure">Adventure</option><option value="relentless">Relentless</option></select></label>
    <label style={{ minWidth: 0 }}>Location<select style={selectStyle} value={id} onChange={event => onChange(event.target.value)}>{levels.map(b => <option key={b.LeaderboardID} value={b.LeaderboardID}>{parseLevelBoard(b.LeaderboardID)!.wave}. {b.DisplayName?.split(' · ')[0] ?? b.LeaderboardID}</option>)}</select></label>
  </div>;
}
