import { readFileSync } from 'fs';
import { parse } from 'dotenv';
import { NetworkId } from '@midnight-ntwrk/zswap';

// Parse .env without mutating process.env
let env: Record<string, string> = {};
try {
  env = parse(readFileSync('.env', 'utf8')) as Record<string, string>;
} catch (error) {
  console.error('❌ ERROR: Could not read .env file:', error);
}

export const {
  INDEXER_HTTP = 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
  INDEXER_WS = 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
  PROVING_SERVER = 'http://localhost:6300',
  NODE_URL = 'https://rpc.testnet-02.midnight.network',
  MIDNIGHT_SEED,
  WALLET_2,
  RECIPIENT_ADDRESS,
  NETWORK_ID,
} = env;

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