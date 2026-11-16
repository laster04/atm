import { czechIban, setBankAccount } from '../../services/payments/account.js';

/**
 * Made-up accounts for the payment tests: valid check digits, numbers nobody
 * owns. Real account numbers never go into the repository (celek K). Every
 * test file that creates payments sets the same values, so files running in
 * parallel against one database agree.
 */
export const TEST_ACCOUNTS = {
  CZK: { iban: czechIban('123456/0800')!, bic: 'TESTCZPP', recipient: 'Test Recipient s.r.o.' },
  EUR: { iban: czechIban('7654321/0300')!, bic: 'TESTCZPP', recipient: 'Test Recipient s.r.o.' },
};

export async function useTestBankAccounts(): Promise<void> {
  await setBankAccount('CZK', TEST_ACCOUNTS.CZK);
  await setBankAccount('EUR', TEST_ACCOUNTS.EUR);
}
