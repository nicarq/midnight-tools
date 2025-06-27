export {
  buildPrimaryWallet,
  deriveRecipientAddress,
  getPrimarySeed,
} from './walletFactory';

export {
  buildWallet,
  startAndSync,
  ensureFunds,
  getBalance,
  getAddress,
  reopenWallet,
  type WalletWithResource,
} from './walletService';

export * from './transfer';
export * from './utils';
export * from './balanceReporter';
export * from './config'; 