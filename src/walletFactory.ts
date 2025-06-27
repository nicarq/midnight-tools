import { WalletBuilder } from '@midnight-ntwrk/wallet';
// @ts-ignore - TypeScript definitions might be incomplete
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import Rx from 'rxjs';
import type { Wallet as WalletApi } from '@midnight-ntwrk/wallet-api';
import type { Resource } from '@midnight-ntwrk/wallet';

import {
  INDEXER_HTTP,
  INDEXER_WS,
  PROVING_SERVER,
  NODE_URL,
  MIDNIGHT_SEED,
  WALLET_2,
  RECIPIENT_ADDRESS,
  getNetworkId,
} from './config';
import { bytesToHex } from './utils';

export type WalletWithResource = WalletApi & Resource;

export const buildPrimaryWallet = async (): Promise<{ wallet: WalletWithResource; seed: string }> => {
  const seed = MIDNIGHT_SEED ?? bytesToHex(generateRandomSeed());
  if (!MIDNIGHT_SEED) {
    console.log('No MIDNIGHT_SEED provided. Using a new random seed:', seed);
  }

  const wallet: WalletWithResource = await WalletBuilder.buildFromSeed(
    INDEXER_HTTP,
    INDEXER_WS,
    PROVING_SERVER,
    NODE_URL,
    seed,
    getNetworkId()
  ) as WalletWithResource;
  wallet.start();
  console.log('Wallet started and syncing...');
  return { wallet, seed };
};

export const deriveRecipientAddress = async (): Promise<string | undefined> => {
  if (WALLET_2) {
    console.log('\n=== RECIPIENT WALLET (WALLET_2) INFORMATION ===');
    try {
      const wallet2: WalletWithResource = await WalletBuilder.buildFromSeed(
        INDEXER_HTTP,
        INDEXER_WS,
        PROVING_SERVER,
        NODE_URL,
        WALLET_2,
        getNetworkId()
      ) as WalletWithResource;
      wallet2.start();
      const recipientState = await Rx.firstValueFrom(wallet2.state());
      const recipientAddress = recipientState.address;
      console.log(`Recipient wallet seed: ${WALLET_2}`);
      console.log(`Recipient wallet address: ${recipientAddress}`);
      await wallet2.close();
      return recipientAddress;
    } catch (error) {
      console.error('Error deriving recipient wallet address from WALLET_2 seed:', error);
    }
  }

  if (RECIPIENT_ADDRESS) {
    console.log('\nUsing RECIPIENT_ADDRESS from .env file as target:', RECIPIENT_ADDRESS);
    return RECIPIENT_ADDRESS;
  }

  return undefined;
}; 