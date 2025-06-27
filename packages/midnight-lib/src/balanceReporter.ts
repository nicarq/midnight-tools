export function printBalances(stage: 'BEFORE' | 'AFTER', balances: Record<string, bigint>): void {
  console.log(`\n=== BALANCES ${stage} TRANSFER ===`);
  for (const [label, amount] of Object.entries(balances)) {
    console.log(`${label} balance: ${amount.toString()} DUST`);
  }
} 