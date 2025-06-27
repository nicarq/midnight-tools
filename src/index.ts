import { readFileSync } from 'fs';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId, nativeToken } from '@midnight-ntwrk/zswap';
// @ts-ignore - TypeScript definitions might be incomplete
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import Rx from 'rxjs';
import { parse } from 'dotenv';
import type { Wallet as WalletApi } from '@midnight-ntwrk/wallet-api';

// Load environment variables from .env file using dotenv's parse (without mutating process.env)
let env: Record<string, string>;
try {
  env = parse(readFileSync('.env', 'utf8')) as Record<string, string>;
} catch (error) {
  console.error('❌ ERROR: Could not read .env file:', error);
  process.exit(1);
}

// Load all environment variables into actual variables
const INDEXER_HTTP = env.INDEXER_HTTP || 'https://indexer.testnet-02.midnight.network/api/v1/graphql';
const INDEXER_WS = env.INDEXER_WS || 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws';
const PROVING_SERVER = env.PROVING_SERVER || 'http://localhost:6300';
const NODE_URL = env.NODE_URL || 'https://rpc.testnet-02.midnight.network';
const NETWORK_ID = env.NETWORK_ID;
const MIDNIGHT_SEED = env.MIDNIGHT_SEED;
const WALLET_2 = env.WALLET_2;
const RECIPIENT_ADDRESS_ENV = env.RECIPIENT_ADDRESS;

// Holds the wallet balance at the beginning of the transfer flow
let initialBalance: bigint = 0n;

// Determine network ID from environment
const getNetworkId = (): NetworkId => {
  const networkId = NETWORK_ID?.toLowerCase();
  switch (networkId) {
    case 'undeployed':
      return NetworkId.Undeployed;
    case 'testnet':
      return NetworkId.TestNet;
    default:
      console.log("No NETWORK_ID specified, defaulting to TestNet");
      return NetworkId.TestNet;
  }
};

// Helper function to convert Uint8Array to hex string
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

// -------------------------------------------------
// Helper utilities (sync + funds waiting)
// -------------------------------------------------

/**
 * Wait until the wallet reports that it has fully synchronized with the network.
 */
const waitForSync = async (w: WalletApi): Promise<void> => {
  await new Promise<void>((resolve) => {
    const sub = w.state().subscribe((s) => {
      if (s.syncProgress?.synced) {
        sub.unsubscribe();
        resolve();
      }
    });
  });
};

/**
 * Wait until the wallet native token balance reaches at least `minBalance`.
 * Returns the observed balance value.
 */
const waitForFunds = async (
  w: WalletApi,
  minBalance: bigint = 1n
): Promise<bigint> => {
  return await new Promise<bigint>((resolve) => {
    const sub = w.state().subscribe((s) => {
      const bal = s.balances[nativeToken()] ?? 0n;
      if (bal >= minBalance) {
        sub.unsubscribe();
        resolve(bal);
      }
    });
  });
};

// Load or create wallet seed
const seed = MIDNIGHT_SEED ?? bytesToHex(generateRandomSeed());
if (!MIDNIGHT_SEED) {
  console.log("No MIDNIGHT_SEED provided. Using a new random seed:", seed);
}

// Build the wallet instance
const wallet = await WalletBuilder.buildFromSeed(
  INDEXER_HTTP,
  INDEXER_WS,
  PROVING_SERVER,
  NODE_URL,
  seed,
  getNetworkId()
);

// Start synchronization
try {
  wallet.start();
  console.log("Wallet started and syncing...");
  
  // Print wallet information
  console.log("\n=== WALLET INFORMATION ===");
  console.log(`Wallet seed: ${seed}`);
  // TODO: wait for funds
  let state = await Rx.firstValueFrom(wallet.state());
  let balance = state.balances[nativeToken()] ?? 0n;
  if (balance === 0n) {
    console.log("Waiting for incoming funds (native token)...");
    balance = await waitForFunds(wallet);
    console.log("Funds detected. Current balance:", balance.toString(), "DUST");
  }
  initialBalance = balance;
  const synced = state.syncProgress?.synced ?? 0n;
  
  console.log(`Our wallet balance: ${balance} DUST`);
  console.log(`Sync progress: ${synced} blocks synced`);
  console.log("Wallet synchronized and ready for transfers");
  
  // Wait until the wallet is fully synchronized with the chain
  console.log("Waiting for wallet to synchronize with the network...");
  await waitForSync(wallet);
  console.log("Wallet is synchronized!");
} catch (err) {
  console.error("Error: Failed to connect/start wallet. Is the Midnight node/indexer/prover running?", err);
  process.exit(1);
}

// Check wallet state and balance before transfer
console.log("\n=== WALLET STATE BEFORE TRANSFER ===");

// --------------------
// Derive recipient address
// --------------------
let recipientAddress: string | undefined;
if (WALLET_2) {
  console.log("\n=== RECIPIENT WALLET (WALLET_2) INFORMATION ===");
  try {
    const wallet2 = await WalletBuilder.buildFromSeed(
      INDEXER_HTTP,
      INDEXER_WS,
      PROVING_SERVER,
      NODE_URL,
      WALLET_2,
      getNetworkId()
    );
    wallet2.start();
    const recipientState = await Rx.firstValueFrom(wallet2.state());
    recipientAddress = recipientState.address;
    console.log(`Recipient wallet seed: ${WALLET_2}`);
    console.log(`Recipient wallet address: ${recipientAddress}`);
    // No need to keep wallet2 running once we have the address
    await wallet2.close();
  } catch (err) {
    console.error("Error deriving recipient wallet address from WALLET_2 seed:", err);
  }
}

// Fallback to RECIPIENT_ADDRESS env variable if WALLET_2 not provided or derivation failed
if (!recipientAddress && RECIPIENT_ADDRESS_ENV) {
  recipientAddress = RECIPIENT_ADDRESS_ENV;
  console.log("\nUsing RECIPIENT_ADDRESS from .env file as target:", recipientAddress);
}

if (!recipientAddress) {
  console.error("❌ ERROR: No recipient address or WALLET_2 seed provided! Please set WALLET_2 or RECIPIENT_ADDRESS in your .env file.");
  await wallet.close();
  process.exit(1);
}

// Prepare a transfer transaction
console.log(`\nTarget address: ${recipientAddress}`);
const amountToSend = 1n;

if (initialBalance < amountToSend) {
  console.error("\n❌ ERROR: Insufficient funds. Your balance is", initialBalance.toString(), "DUST but the transfer requires", amountToSend.toString(), "DUST.");
  console.error("Please fund the wallet and try again.");
  await wallet.close();
  process.exit(1);
}

const transferRecipe = await wallet.transferTransaction([
  {
    amount: amountToSend,
    receiverAddress: recipientAddress,
    type: nativeToken(),
  },
]);
console.log("Transfer transaction prepared.");

// Prove the transaction (generate ZK proofs)
console.log("Proving the transaction (this may take some time)...");
const provenTransaction = await wallet.proveTransaction(transferRecipe);
console.log("Transaction proven.");

// Submit the transaction to the network
const submitResult = await wallet.submitTransaction(provenTransaction);
console.log("\n=== TRANSACTION RESULT ===");
console.log("Transaction submitted successfully!");
console.log("Transaction result:", submitResult);
console.log(`Amount sent: ${amountToSend} DUST`);
console.log(`Sent to: ${recipientAddress}`);

// Wait a moment for the transaction to be processed
console.log("\nWaiting for transaction to be processed...");
await new Promise((resolve) => setTimeout(resolve, 3000));

// Check wallet state and balance after transfer
console.log("\n=== WALLET STATE AFTER TRANSFER ===");
try {
  const stateAfter = await Rx.firstValueFrom(wallet.state());
  const balanceAfter = stateAfter.balances[nativeToken()] ?? 0n;
  const syncedAfter = stateAfter.syncProgress?.synced ?? 0n;

  console.log(`Our wallet balance: ${balanceAfter} DUST`);
  console.log(`Sync progress: ${syncedAfter} blocks synced`);
  console.log("Post-transfer wallet state retrieved");
} catch (err) {
  console.error("Error getting post-transfer wallet state:", err);
}

// Close the wallet (optional cleanup)
await wallet.close();
console.log("Wallet closed.");
