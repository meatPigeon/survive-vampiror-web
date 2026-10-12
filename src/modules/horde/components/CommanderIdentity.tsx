import { useEffect, useState } from 'react';
import { useIDosGamesClient, useUserState } from '@idosgames/react';

/** Identity comes from the authenticated server state, never a typed wallet address. */
export function CommanderIdentity({ openAccount }: { openAccount?: () => void }) {
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
    <summary><b>{status === 'ready' && address ? 'Solana commander' : 'Play across devices'}</b><span>{status === 'ready' && address ? `${address.slice(0, 6)}…${address.slice(-6)} · Same wallet, same march` : 'Recover your march with a Solana wallet'}</span></summary>
    {status === 'loading' ? <p role="status">Checking your account…</p> : status === 'error' ? <><p role="status">Could not check your wallet identity. Your save connection is shown above.</p><button onClick={() => setAttempt(n => n + 1)}>Retry identity check</button></> : address ? <>
      <p>Signed in with Solana</p><code title={address}>{address.slice(0, 6)}…{address.slice(-6)}</code>
      <ol><li>Open the game on your other device.</li><li>Choose “Sign in with Solana” and use this wallet.</li><li>Select “Continue march”. Your checkpoint opens paused.</li></ol>
      <small>Your signature verifies your identity. Saves stay private on iDos. No transaction or token purchase is required.</small>
    </> : <>
      <p>Your wallet is your commander identity. Sign a login message to recover the same march, settings and records in another browser.</p>
      <ol><li>Open Account, then log out.</li><li>Choose “Sign in with Solana” on the sign-in screen.</li><li>Use that same wallet whenever you return.</li></ol>
      <small>No transaction fee or token purchase. Switching from guest to wallet opens a separate account; your guest march is not transferred.</small>
    </>}
    {openAccount && <button onClick={openAccount}>Open account</button>}
  </details>;
}
