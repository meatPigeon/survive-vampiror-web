import { SolanaLogin } from "./base/login/SolanaLogin";
import type { RenderLinkWallet } from "@idosgames/app-shell";
import type { LoginScreenExtras } from "./base/login/LoginScreen";
import { ENV_WALLETCONNECT_PROJECT_ID } from "./env";
import { IDOS_WEB3_NETWORK_ID, IDOS_WEB3_WALLETCONNECT_PROJECT_ID } from "./idos.title";

// Solana sign-in verifies a message signature with iDos, then uses the resulting
// account for the game's existing private cloud saves. It never submits a transaction.
// Keep the SDK lazy entry: the wallet stack loads only after the player's click.
const walletConnectProjectId = IDOS_WEB3_WALLETCONNECT_PROJECT_ID || ENV_WALLETCONNECT_PROJECT_ID || undefined;
export const renderWalletLogin: LoginScreenExtras["renderWalletLogin"] = ({ client, onAuthenticated, disabled, style }) => (
  <>
    <SolanaLogin client={client} networkID={IDOS_WEB3_NETWORK_ID || "solana"}
      appName="Survive Vampiror" label="Sign in with Solana" onAuthenticated={onAuthenticated}
      disabled={disabled} style={style} walletConnectProjectId={walletConnectProjectId} />
    <small style={{ textAlign: "center", lineHeight: 1.5 }}>Use the same wallet to resume your march on another browser. Sign a message, with no transaction fee or token purchase. Guest and wallet accounts have separate saves.</small>
  </>
);
export const renderWalletLink: RenderLinkWallet = ({ client, networkID, onLinked, disabled, style }) => (
  <SolanaLogin mode="link" client={client} networkID={networkID || IDOS_WEB3_NETWORK_ID || "solana"}
    appName="Survive Vampiror" label="Link Solana wallet" onLinked={onLinked}
    disabled={disabled} style={style} walletConnectProjectId={walletConnectProjectId} />
);
