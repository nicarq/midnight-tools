import Rx from 'rxjs';
import { nativeToken } from '@midnight-ntwrk/zswap';
import type { Wallet as WalletApi } from '@midnight-ntwrk/wallet-api';

export const executeTransfer = async (
  wallet: WalletApi,
  recipientAddress: string,
  amountToSend: bigint
): Promise<void> => {
  if (amountToSend <= 0n) {
    throw new Error('Transfer amount must be positive');
  }

  const state = await Rx.firstValueFrom(wallet.state());
  const balance = state.balances[nativeToken()] ?? 0n;
  if (balance < amountToSend) {
    throw new Error(`❌ ERROR: Insufficient funds. Your balance is ${balance} DUST but the transfer requires ${amountToSend} DUST.`);
  }

  console.log(`\nTarget address: ${recipientAddress}`);

  // Prepare transaction
  const transferRecipe = await wallet.transferTransaction([
    {
      amount: amountToSend,
      receiverAddress: recipientAddress,
      type: nativeToken(),
    },
  ]);
  console.log('Transfer transaction prepared.');

  // Prove (generate ZK proofs)
  console.log('Proving the transaction (this may take some time)...');
  const provenTransaction = await wallet.proveTransaction(transferRecipe);
  console.log('Transaction proven.');

  // Submit
  const submitResult = await wallet.submitTransaction(provenTransaction);
  console.log('\n=== TRANSACTION RESULT ===');
  console.log('Transaction submitted successfully!');
  console.log('Transaction result:', submitResult);
  console.log(`Amount sent: ${amountToSend} DUST`);
  console.log(`Sent to: ${recipientAddress}`);
}; 