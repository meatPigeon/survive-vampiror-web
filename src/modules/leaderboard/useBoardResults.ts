import { useCallback, useEffect, useRef, useState } from 'react';
import { useIDosGamesClient } from '@idosgames/react';
import type { GetLeaderboardResponse, GetMyProgressResponse } from '@idosgames/core';

export function useBoardResults(id: string | undefined) {
  const client = useIDosGamesClient(), request = useRef(0), lastRequest = useRef(0);
  const [state, setState] = useState<{ id?: string; loading: boolean; error: string | null; top: GetLeaderboardResponse | null; progress: GetMyProgressResponse | null }>({ loading: true, error: null, top: null, progress: null });
  const load = useCallback(async () => {
    const current = ++request.current;
    if (!id) return;
    setState({ id, loading: true, error: null, top: null, progress: null });
    const delay = Math.max(0, 650 - (Date.now() - lastRequest.current));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (current !== request.current) return;
    lastRequest.current = Date.now();
    try {
      const response = await client.leaderboard.getOverviewBatch([id]);
      if (current !== request.current) return;
      const entry = response.ok ? response.data.find(item => item.LeaderboardID === id) : undefined;
      if (!response.ok || !entry?.Leaderboard?.Success || !entry.Progress?.Success) throw new Error('Leaderboard unavailable');
      setState({ id, loading: false, error: null, top: entry.Leaderboard.Data ?? null, progress: entry.Progress.Data ?? null });
    } catch {
      if (current === request.current) setState({ id, loading: false, error: 'Could not load these times. Please retry.', top: null, progress: null });
    }
  }, [client, id]);
  useEffect(() => {
    void load();
    const a = client.on('leaderboard:scoreSubmitted', r => { if (r.LeaderboardID === id) void load(); });
    const b = client.on('leaderboard:scoresSubmittedBatch', r => { if (r.some(item => item.Id === id && item.Success)) void load(); });
    return () => { request.current++; a(); b(); };
  }, [client, id, load]);
  return { ...(state.id === id ? state : { loading: true, error: null, top: null, progress: null }), load };
}
