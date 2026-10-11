import { useEffect, useState } from 'react';
import { useIDosGamesClient, useUserState } from '@idosgames/react';

/** Identity comes from the authenticated server state, never a typed wallet address. */
export function CommanderIdentity() {
  const client = useIDosGamesClient();
  const user = useUserState();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    void client.blockchain.getUserState().then(result => {
      if (active) setStatus(result.ok ? 'ready' : 'error');
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [client, attempt]);
  const login = user?.Blockchain?.LastWalletLogin;
  const address = login?.NetworkID === 'solana' ? login.Address : null;
  return <details className="horde-identity">
    <summary>{status === 'ready' && address ? 'Solana commander' : 'Your commander account'}</summary>
    {status === 'loading' ? <p role="status">Checking your account…</p> : status === 'error' ? <><p role="status">Could not check your wallet identity. Your save connection is shown above.</p><button onClick={() => setAttempt(n => n + 1)}>Retry identity check</button></> : address ? <>
      <p>Signed in with Solana</p><code title={address}>{address.slice(0, 6)}…{address.slice(-6)}</code>
      <p>Use this same wallet at sign-in to recover this account’s march, settings and personal records on another browser.</p>
      <small>Your signature verifies your identity. Saves stay private on iDos. No transaction or token purchase is required.</small>
    </> : <p>Solana sign-in gives your march a wallet identity. Choose “Sign in with Solana” at the sign-in screen. Guest and wallet accounts have separate saves.</p>}
  </details>;
}
