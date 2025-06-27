import { WalletBuilder } from '@midnight-ntwrk/wallet';
import type { Wallet as WalletApi } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';
import Rx from 'rxjs';
import { nativeToken } from '@midnight-ntwrk/zswap';

import {
  INDEXER_HTTP,
  INDEXER_WS,
  PROVING_SERVER,
  NODE_URL,
  getNetworkId,
} from './config';
import { waitForFunds, waitForSync } from './utils';

// Composite type that exposes both Wallet API and the underlying resource management helpers
export type WalletWithResource = WalletApi & Resource;

// Builds a wallet from a seed and starts it (but does not wait for sync)
export async function buildWallet(seed: string): Promise<WalletWithResource> {
  const wallet: WalletWithResource = (await WalletBuilder.buildFromSeed(
    INDEXER_HTTP,
    INDEXER_WS,
    PROVING_SERVER,
    NODE_URL,
    seed,
    getNetworkId()
  )) as WalletWithResource;
  wallet.start();
  return wallet;
}

// Wait until the wallet is fully synced
export async function startAndSync(wallet: WalletWithResource): Promise<void> {
  await waitForSync(wallet);
}

// Ensure the wallet has at least `minBalance` of native tokens, waiting if necessary
export async function ensureFunds(
  wallet: WalletWithResource,
  minBalance: bigint = 1n
): Promise<void> {
  const bal = await getBalance(wallet);
  if (bal < minBalance) {
    await waitForFunds(wallet, minBalance);
  }
}

// Retrieve the current native token balance
export async function getBalance(wallet: WalletWithResource): Promise<bigint> {
  const state = await Rx.firstValueFrom(wallet.state());
  return state.balances[nativeToken()] ?? 0n;
}

// Convenient helper to fetch the wallet's address
export async function getAddress(wallet: WalletWithResource): Promise<string> {
  const state = await Rx.firstValueFrom(wallet.state());
  return state.address;
}

// Reopens (closes and rebuilds) a wallet from the given seed and waits until it is fully synced
export async function reopenWallet(
  seed: string,
  existingWallet?: WalletWithResource
): Promise<WalletWithResource> {
  if (existingWallet) {
    try {
      await existingWallet.close();
    } catch {
      /* ignore */
    }
  }
  const wallet = await buildWallet(seed);
  await startAndSync(wallet);
  return wallet;
} 