import Rx from 'rxjs';
import { nativeToken } from '@midnight-ntwrk/zswap';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import {
  WALLET_2,
  INDEXER_HTTP,
  INDEXER_WS,
  PROVING_SERVER,
  NODE_URL,
  getNetworkId,
} from './config';
import type { WalletWithResource } from './walletFactory';

import { buildPrimaryWallet, deriveRecipientAddress } from './walletFactory';
import { waitForFunds, waitForSync } from './utils';
import { executeTransfer } from './transfer';

(async () => {
  try {
    // 1. Build and start the primary wallet
    const { wallet: wallet1, seed: seed1 } = await buildPrimaryWallet();

    console.log('\n=== WALLET_1 INFORMATION ===');
    console.log('Wallet seed:', seed1);

    // Prepare WALLET_2 (recipient) if its seed is provided
    let wallet2: WalletWithResource | undefined;
    let recipientAddress: string | undefined;
    let initialBalanceWallet2: bigint | undefined;

    if (WALLET_2) {
      wallet2 = (await WalletBuilder.buildFromSeed(
        INDEXER_HTTP,
        INDEXER_WS,
        PROVING_SERVER,
        NODE_URL,
        WALLET_2,
        getNetworkId()
      )) as WalletWithResource;
      wallet2.start();

      console.log('\n=== RECIPIENT WALLET (WALLET_2) INFORMATION ===');
      console.log(`Recipient wallet seed: ${WALLET_2}`);
      console.log('Waiting for WALLET_2 to synchronize with the network...');
      await waitForSync(wallet2);

      const w2State = await Rx.firstValueFrom(wallet2.state());
      recipientAddress = w2State.address;
      initialBalanceWallet2 = w2State.balances[nativeToken()] ?? 0n;
      console.log(`Recipient wallet address: ${recipientAddress}`);
    }

    // 2. Make sure WALLET_1 has funds
    let state = await Rx.firstValueFrom(wallet1.state());
    let balance = state.balances[nativeToken()] ?? 0n;
    if (balance === 0n) {
      console.log('Waiting for incoming funds (native token)...');
      balance = await waitForFunds(wallet1);
      console.log('Funds detected. Current balance:', balance.toString(), 'DUST');
    }

    // 3. Wait until WALLET_1 is fully synchronized
    console.log('Waiting for wallet to synchronize with the network...');
    await waitForSync(wallet1);
    console.log('Wallet is synchronized!');

    // Capture initial balances **after** full sync
    state = await Rx.firstValueFrom(wallet1.state());
    const initialBalanceWallet1 = state.balances[nativeToken()] ?? 0n;

    console.log('\n=== BALANCES BEFORE TRANSFER ===');
    console.log('WALLET_1 balance:', initialBalanceWallet1.toString(), 'DUST');
    if (wallet2 && initialBalanceWallet2 !== undefined) {
      console.log('WALLET_2 balance:', initialBalanceWallet2.toString(), 'DUST');
    }

    // 4. Determine recipient address (fallback to deriveRecipientAddress when WALLET_2 is absent)
    if (!recipientAddress) {
      recipientAddress = await deriveRecipientAddress();
    }
    if (!recipientAddress) {
      throw new Error(
        '❌ ERROR: No recipient address or WALLET_2 seed provided! Please set WALLET_2 or RECIPIENT_ADDRESS in your .env file.'
      );
    }

    // 5. Execute the transfer (1 DUST)
    const amountToSend = 1n;
    await executeTransfer(wallet1, recipientAddress, amountToSend);

    // 6. Give the network a moment to process
    console.log('\nWaiting for transaction to be processed...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 7. Report final state
    state = await Rx.firstValueFrom(wallet1.state());
    const balanceAfterWallet1 = state.balances[nativeToken()] ?? 0n;

    let balanceAfterWallet2: bigint | undefined;
    if (wallet2) {
      // Ensure WALLET_2 state is up-to-date
      await waitForSync(wallet2);
      const w2StateAfter = await Rx.firstValueFrom(wallet2.state());
      balanceAfterWallet2 = w2StateAfter.balances[nativeToken()] ?? 0n;
    }

    console.log('\n=== BALANCES AFTER TRANSFER ===');
    console.log('WALLET_1 remaining balance:', balanceAfterWallet1.toString(), 'DUST');
    if (wallet2 && balanceAfterWallet2 !== undefined) {
      console.log('WALLET_2 new balance:', balanceAfterWallet2.toString(), 'DUST');
    }

    // 8. Graceful shutdown
    await wallet1.close();
    if (wallet2) {
      await wallet2.close();
      console.log('Recipient wallet closed.');
    }
    console.log('Primary wallet closed.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
