import Rx from 'rxjs';
import type { Wallet as WalletApi } from '@midnight-ntwrk/wallet-api';
import { nativeToken } from '@midnight-ntwrk/zswap';

// Convert Uint8Array to hex string
export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

// Wait until the wallet has fully synchronized with the network
export const waitForSync = async (wallet: WalletApi): Promise<void> => {
  await new Promise<void>((resolve) => {
    const sub = wallet.state().subscribe((s) => {
      if (s.syncProgress?.synced) {
        sub.unsubscribe();
        resolve();
      }
    });
  });
};

// Wait until the wallet native token balance reaches at least `minBalance`
export const waitForFunds = async (
  wallet: WalletApi,
  minBalance: bigint = 1n
): Promise<bigint> => {
  return await new Promise<bigint>((resolve) => {
    const sub = wallet.state().subscribe((s) => {
      const bal = s.balances[nativeToken()] ?? 0n;
      if (bal >= minBalance) {
        sub.unsubscribe();
        resolve(bal);
      }
    });
  });
}; 