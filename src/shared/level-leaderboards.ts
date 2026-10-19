/** Stable IDs and millisecond units shared by the game and the leaderboard screen. */
export function levelBoardId(wave: number, normal: boolean) {
  return `horde_${normal ? 'relentless' : 'adventure'}_${wave}_v1`;
}
export function parseLevelBoard(id: string) {
  const match = /^horde_(adventure|relentless)_([1-9]\d*)_v1$/.exec(id);
  return match ? { normal: match[1] === 'relentless', wave: Number(match[2]) } : null;
}
export function formatClearTime(milliseconds: number | null | undefined) {
  if (!milliseconds || !Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const ms = Math.round(milliseconds);
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
