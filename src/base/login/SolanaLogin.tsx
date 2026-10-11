import { useEffect, useRef, useState } from 'react';
import { getWallets } from '@wallet-standard/app';
import { isEmbeddedInPlatform, LazySolanaWalletLogin, type LazySolanaWalletLoginProps } from '@idosgames/wallet/react/lazy';
import { supportsSolanaMessages, solanaAccount, signChallenge, type MessageWallet } from './solana-standard';

/** The embedded game always uses the platform bridge. Standalone wallets need no Reown account. */
export function SolanaLogin(props: LazySolanaWalletLoginProps) {
  if (isEmbeddedInPlatform() || props.walletConnectProjectId) return <LazySolanaWalletLogin {...props} />;
  return <InstalledWalletLogin {...props} />;
}
function InstalledWalletLogin(props: LazySolanaWalletLoginProps) {
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<readonly MessageWallet[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    const registry = getWallets();
    const refresh = () => setWallets(registry.get().filter(supportsSolanaMessages));
    refresh();
    const offRegister = registry.on('register', refresh), offUnregister = registry.on('unregister', refresh);
    return () => { offRegister(); offUnregister(); };
  }, [open]);
  async function connect(wallet: MessageWallet) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { accounts } = await wallet.features['standard:connect'].connect();
      const account = solanaAccount(accounts);
      if (!account) throw new Error('Choose a Solana account that supports message signing.');
      if (!mounted.current) return;
      const { loginWithWalletSolana, linkWalletSolana } = await import('@idosgames/wallet');
      const args = { client: props.client, networkID: props.networkID, walletAddress: account.address,
        signMessage: async (message: Uint8Array) => {
          if (!mounted.current) throw new Error('Sign-in screen closed.');
          const signature = await signChallenge(wallet, account, message);
          if (!mounted.current) throw new Error('Sign-in screen closed.');
          return signature;
        } };
      if (props.mode === 'link') {
        const result = await linkWalletSolana(args);
        if (!result.ok) throw new Error(result.stage === 'sign' ? 'Signature declined or unavailable. Try again when ready.' : 'Could not link this wallet. Try again or use another sign-in method.');
        props.onLinked?.(result.data.PlayAccess ?? null);
      } else {
        const result = await loginWithWalletSolana(args);
        if (!result.ok) throw new Error(result.stage === 'sign' ? 'Signature declined or unavailable. Try again when ready.' : 'Could not sign in. Please try again.');
        props.onAuthenticated?.();
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && !/reject|cancel|denied/i.test(cause.message) ? cause.message : 'Wallet request declined. You can retry or play as guest.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <>
    <button type="button" disabled={props.disabled || busy} onClick={() => setOpen(value => !value)} style={props.style} aria-expanded={open}>
      {busy ? 'Check your wallet…' : props.label || 'Sign in with Solana'}
    </button>
    {open && <div aria-label="Installed Solana wallets" style={{ display: 'grid', gap: 8 }}>
      {wallets.map((wallet, index) => <button key={`${wallet.name}-${index}`} type="button" disabled={busy || props.disabled} style={props.style} onClick={() => void connect(wallet)}>{props.mode === 'link' ? 'Link' : 'Continue with'} {wallet.name}</button>)}
      {!wallets.length && <p role="status">No compatible Solana wallet found. Open this game in your wallet’s browser or use a browser wallet such as Phantom. You can also play as guest.</p>}
      {busy && <small role="status">Approve the login message in your wallet, or reject it to cancel.</small>}
    </div>}
    {error && <small role="alert">{error}</small>}
  </>;
}
