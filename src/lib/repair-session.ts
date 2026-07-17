/** In-memory flag: repairTransactions runs once per app session. */
export let hasRepairedTransactionsThisSession = false;

export function markTransactionsRepairedThisSession(): void {
  hasRepairedTransactionsThisSession = true;
}
