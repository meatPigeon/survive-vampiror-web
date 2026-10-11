import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type { StandardConnectFeature } from '@wallet-standard/features';
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features';

export type MessageWallet = Wallet & { features: StandardConnectFeature & SolanaSignMessageFeature };
export function supportsSolanaMessages(wallet: Wallet): wallet is MessageWallet {
  const features = wallet.features as Partial<StandardConnectFeature & SolanaSignMessageFeature>;
  return wallet.chains.some(chain => chain.startsWith('solana:')) &&
    typeof features['standard:connect']?.connect === 'function' &&
    typeof features['solana:signMessage']?.signMessage === 'function';
}
export function solanaAccount(accounts: readonly WalletAccount[]) {
  return accounts.find(account => account.chains.some(chain => chain.startsWith('solana:')) && account.features.includes('solana:signMessage'));
}
export async function signChallenge(wallet: MessageWallet, account: WalletAccount, message: Uint8Array) {
  const [output] = await wallet.features['solana:signMessage'].signMessage({ account, message });
  // iDos validates its exact server challenge. Never authenticate modified/prefixed bytes.
  if (!output || output.signature.length !== 64 || output.signedMessage.length !== message.length ||
      !message.every((byte, index) => output.signedMessage[index] === byte)) {
    throw new Error('The wallet did not sign the requested login message.');
  }
  return output.signature;
}
