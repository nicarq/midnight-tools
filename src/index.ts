import { getPrimarySeed } from './walletFactory';
import {
  buildWallet,
  startAndSync,
  ensureFunds,
  getBalance,
  getAddress,
  WalletWithResource,
  reopenWallet,
} from './walletService';
import { executeTransfer } from './transfer';
import { WALLET_2, RECIPIENT_ADDRESS } from './config';
import { printBalances } from './balanceReporter';
import { waitForFunds } from './utils';

(async () => {
  try {
    // ────────────────────────────────────────────────────────────────
    // 1. SET-UP PRIMARY WALLET (WALLET_1)
    // ────────────────────────────────────────────────────────────────
    const wallet1 = await buildWallet(getPrimarySeed());
    await startAndSync(wallet1);
    await ensureFunds(wallet1);

    // ────────────────────────────────────────────────────────────────
    // 2. OPTIONAL RECIPIENT WALLET (WALLET_2)
    // ────────────────────────────────────────────────────────────────
    let wallet2: WalletWithResource | undefined;
    if (WALLET_2) {
      wallet2 = await buildWallet(WALLET_2);
      await startAndSync(wallet2);
    }

    // ────────────────────────────────────────────────────────────────
    // 3. BALANCES BEFORE TRANSFER
    // ────────────────────────────────────────────────────────────────
    const balancesBefore: Record<string, bigint> = {
      WALLET_1: await getBalance(wallet1),
    };
    let wallet2BalanceBefore: bigint | undefined;
    if (wallet2) {
      wallet2BalanceBefore = await getBalance(wallet2);
      balancesBefore.WALLET_2 = wallet2BalanceBefore;
    }
    printBalances('BEFORE', balancesBefore);

    // ────────────────────────────────────────────────────────────────
    // 4. EXECUTE TRANSFER
    // ────────────────────────────────────────────────────────────────
    const recipientAddress = wallet2
      ? await getAddress(wallet2)
      : RECIPIENT_ADDRESS;

    if (!recipientAddress) {
      throw new Error(
        '❌ ERROR: No recipient address. Provide WALLET_2 seed or RECIPIENT_ADDRESS in .env.'
      );
    }

    const amountToSend = 1n;
    await executeTransfer(wallet1, recipientAddress, amountToSend);

    if (wallet2 && wallet2BalanceBefore !== undefined) {
      console.log('\nWaiting for WALLET_2 to receive funds…');
      // Ensure wallet2 is up-to-date; reopen to clear cache then wait for funds
      wallet2 = await reopenWallet(WALLET_2 as string, wallet2);
      await waitForFunds(wallet2, wallet2BalanceBefore + amountToSend);
    } else {
      console.log('\nWaiting briefly for network confirmation…');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // ────────────────────────────────────────────────────────────────
    // 5. BALANCES AFTER TRANSFER
    // ────────────────────────────────────────────────────────────────
    const balancesAfter: Record<string, bigint> = {
      WALLET_1: await getBalance(wallet1),
    };
    if (wallet2) {
      balancesAfter.WALLET_2 = await getBalance(wallet2);
    }
    printBalances('AFTER', balancesAfter);

    // ────────────────────────────────────────────────────────────────
    // 6. SHUTDOWN
    // ────────────────────────────────────────────────────────────────
    await wallet1.close();
    if (wallet2) await wallet2.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
