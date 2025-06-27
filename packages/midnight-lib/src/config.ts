import { readFileSync } from 'fs';
import { parse } from 'dotenv';
import { NetworkId } from '@midnight-ntwrk/zswap';

// 1. Try to read a local .env file (non-fatal if it does not exist)
let fileEnv: Record<string, string> = {};
try {
  fileEnv = parse(readFileSync('.env', 'utf8')) as Record<string, string>;
} catch {
  // Silently ignore when the .env file is absent – we'll fall back to process.env or defaults
}

// 2. Merge process.env and .env values giving precedence to the .env file
const env: Record<string, string | undefined> = {
  ...process.env,
  ...fileEnv,
};

export const {
  INDEXER_HTTP = 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
  INDEXER_WS = 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
  PROVING_SERVER = 'http://localhost:6300',
  NODE_URL = 'https://rpc.testnet-02.midnight.network',
  MIDNIGHT_SEED,
  WALLET_2,
  RECIPIENT_ADDRESS,
  NETWORK_ID,
} = env as Record<string, string>;

// 3. Ensure these resolved values are also available on process.env so that any
//    downstream library that looks at process.env directly continues to work.
for (const [key, value] of Object.entries({
  INDEXER_HTTP,
  INDEXER_WS,
  PROVING_SERVER,
  NODE_URL,
  NETWORK_ID,
})) {
  if (process.env[key] === undefined) {
    process.env[key] = value as string;
  }
}

export const getNetworkId = (): NetworkId => {
  const networkId = (NETWORK_ID ?? '').toLowerCase();
  switch (networkId) {
    case 'undeployed':
      return NetworkId.Undeployed;
    case 'testnet':
      return NetworkId.TestNet;
    default:
      console.log('No NETWORK_ID specified, defaulting to TestNet');
      return NetworkId.TestNet;
  }
};

// Export raw env object in case other modules need it
export { env }; 