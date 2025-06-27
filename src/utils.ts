import Rx from 'rxjs';
import type { Wallet as WalletApi, WalletState } from '@midnight-ntwrk/wallet-api';
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

// Wait until the wallet is *almost* fully synced (within `syncThreshold` blocks)
// and the native token balance is at least `minBalance`.
export const waitForFunds = async (
  wallet: WalletApi,
  minBalance: bigint = 1n,
  syncThreshold: bigint = 100n
): Promise<bigint> => {
  return await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state: WalletState) => {
        const time = new Date().toISOString();
        const inSync = state.syncProgress?.synced ? '✅' : '❌';
        const bal = state.balances[nativeToken()] ?? 0n;
        const lag = state.syncProgress?.lag;
        const lagStr = lag
          ? `sourceGap=${lag.sourceGap}, applyGap=${lag.applyGap}`
          : 'no-lag-info';
        console.log(
          `[waitForFunds] ${time} – synced: ${inSync} (${lagStr}), balance: ${bal}/${minBalance}`
        );
      }),
      Rx.filter((state) => {
        const fullySynced = state.syncProgress?.synced === true;
        const bal = state.balances[nativeToken()] ?? 0n;
        return fullySynced && bal >= minBalance;
      }),
      Rx.map((state) => state.balances[nativeToken()] ?? 0n)
    )
  );
}; 