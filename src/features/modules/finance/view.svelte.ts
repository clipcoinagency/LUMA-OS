// Which part of Finance is showing. Shared so the command palette / Home can open "Debts" directly.
export type FinanceTab = 'money' | 'debts';
export const financeView = $state<{ tab: FinanceTab }>({ tab: 'money' });
