// @ts-nocheck
// @ts-ignore - SDK lacks TypeScript types for these import paths
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
// @ts-ignore - SDK lacks TypeScript types for these import paths
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @ts-ignore - zod has its own types but TS resolver may not find before install
import { z } from "zod";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// Re-exported helpers from midnight-lib
// @ts-ignore - local workspace package, type declarations resolved via workspace
import {
  buildWallet,
  getBalance as libGetBalance,
  getAddress as libGetAddress,
  executeTransfer,
} from "midnight-lib";

// In-memory cache for the active seed & its wallet instance
let currentSeed: string | null = null;
let cachedWallet: any | null = null;

// Redirect console.log output to stderr to avoid contaminating MCP JSON on stdout
console.log = (...args: unknown[]) => {
  // Serialize non-string arguments similarly to default console.log behaviour
  const message = args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg, null, 2)))
    .join(" ");
  process.stderr.write(message + "\n");
};

// Ensure other common logging methods also go to stderr
console.info = console.log;
console.warn = console.log;

/**
 * MCP server exposing midnight-lib as resources & tools.
 */
async function main() {
  const server = new McpServer({
    name: "midnight-mcp",
    version: "0.1.0",
    summary: "MCP interface for the midnight-lib package",
  });

  // Pre-initialize the wallet if the seed is provided via an environment
  // variable (MIDNIGHT_SEED or SEED) or a command-line flag ("--seed=<value>").
  // This lets the server come up with an active wallet without requiring the
  // client to invoke the `set_seed` tool first.
  const seedFromEnv = process.env.MIDNIGHT_SEED ?? process.env.SEED;
  const seedFromArg = process.argv.find((arg) => arg.startsWith("--seed="))?.slice("--seed=".length);
  const initialSeed = seedFromEnv || seedFromArg;
  if (initialSeed) {
    try {
      // Close any previously opened wallet to free resources (unlikely at
      // startup but keeps logic symmetrical with the `set_seed` tool).
      if (cachedWallet && typeof (cachedWallet as any).close === "function") {
        await (cachedWallet as any).close();
      }
      currentSeed = initialSeed;
      cachedWallet = await buildWallet(initialSeed);
      console.log(
        `Wallet initialised from ${seedFromEnv ? "environment variable" : "command-line argument"}.`
      );
    } catch (err) {
      console.error("Failed to initialise wallet from provided seed:", err);
      process.exit(1);
    }
  }

  /* ---------------- Tools ---------------- */

  // Tool: set_seed – stores the seed and builds the wallet for later use
  server.registerTool(
    "set_seed",
    {
      title: "Set active wallet seed",
      description:
        "Stores the provided seed and builds the associated wallet, making it available for subsequent operations.",
      inputSchema: { seed: z.string() },
      outputSchema: { success: z.boolean() },
    },
    async ({ seed }: { seed: string }) => {
      // Close any previously opened wallet to free resources
      if (cachedWallet && typeof (cachedWallet as any).close === "function") {
        try {
          await (cachedWallet as any).close();
        } catch {
          /* ignore */
        }
      }
      currentSeed = seed;
      cachedWallet = await buildWallet(seed);
      return {
        content: [
          { type: "text", text: "Seed stored and wallet initialized" },
        ],
        structuredContent: { success: true },
      };
    }
  );

  // Tool: get_balance – returns the wallet's balance for the currently set seed
  server.registerTool(
    "get_balance",
    {
      title: "Get wallet balance",
      description:
        "Returns the native token balance for the wallet derived from the previously provided seed.",
      inputSchema: {},
      outputSchema: { balance: z.string() },
    },
    async () => {
      if (!cachedWallet) {
        throw new Error("Seed not set. Please call set_seed first.");
      }
      const balance = await libGetBalance(cachedWallet);
      return {
        content: [
          { type: "text", text: `Balance: ${balance.toString()}` },
        ],
        structuredContent: { balance: balance.toString() },
      };
    }
  );

  // Tool: get_address – returns the wallet address for the currently set seed
  server.registerTool(
    "get_address",
    {
      title: "Get wallet address",
      description:
        "Returns the wallet address derived from the previously provided seed.",
      inputSchema: {},
      outputSchema: { address: z.string() },
    },
    async () => {
      if (!cachedWallet) {
        throw new Error("Seed not set. Please call set_seed first.");
      }
      const address = await libGetAddress(cachedWallet);
      return {
        content: [
          { type: "text", text: `Wallet address: ${address}` },
        ],
        structuredContent: { address },
      };
    }
  );

  // Tool: transfer_funds – sends DUST from wallet to recipient
  server.registerTool(
    "transfer_funds",
    {
      title: "Transfer funds",
      description:
        "Transfers native tokens from the active wallet (seed must have been set via set_seed) to the specified recipient address.",
      inputSchema: {
        recipient: z.string(),
        amount: z.string().refine((str: string) => /^\d+$/.test(str), {
          message: "amount must be an integer represented as a string",
        }),
      },
      outputSchema: { success: z.boolean() },
    },
    async ({ recipient, amount }: { recipient: string; amount: string }) => {
      if (!cachedWallet) {
        throw new Error("Seed not set. Please call set_seed first.");
      }
      await executeTransfer(cachedWallet, recipient, BigInt(amount));
      return {
        content: [
          { type: "text", text: `Transferred ${amount} to ${recipient}` },
        ],
        structuredContent: { success: true },
      };
    }
  );

  // Start the stdio transport – suitable for local agent subprocess integration
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Failed to start midnight-mcp server:", err);
  process.exit(1);
}); 