import {
  assertNoBankPasswordProvided,
  isBankConsentActive,
  normalizeAndClassifyBankTransaction,
} from '@/domain/open-finance/open-finance-provider';
import { calculateMonthlyMetrics } from '@/domain/finance/cashflow-calculator';
import { useFinanceStore } from '@/features/finance/use-finance-store';

describe('Fase 5 — Integração Bancária (Open Finance Brasil) e Cartões/Faturas', () => {
  describe('1. Segurança e Consentimento Open Finance (Seção 9 e 14)', () => {
    it('deve rejeitar imediatamente qualquer tentativa de fornecer senha bancária ou PIN', () => {
      expect(() =>
        assertNoBankPasswordProvided({
          institutionIspb: '00000000',
          senhaBancaria: '123456',
        }),
      ).toThrow(/O aplicativo jamais solicita, processa ou armazena senhas bancárias/);

      expect(() =>
        assertNoBankPasswordProvided({
          institutionIspb: '00000000',
          cardPassword: '9999',
        }),
      ).toThrow(/O aplicativo jamais solicita, processa ou armazena senhas bancárias/);
    });

    it('deve registrar consentimento explícito por escopo e permitir revogação imediata', async () => {
      const conn = await useFinanceStore
        .getState()
        .authorizeBankConnectionConsent({
          providerName: 'pluggy',
          institutionName: 'Banco do Brasil S.A.',
          institutionIspb: '00000000',
          grantedScopes: ['accounts', 'transactions', 'credit_cards'],
        });

      expect(conn.status).toBe('active');
      expect(isBankConsentActive(conn)).toBe(true);
      expect(conn.granted_scopes).toEqual([
        'accounts',
        'transactions',
        'credit_cards',
      ]);

      const revoked = await useFinanceStore
        .getState()
        .revokeBankConnectionConsent(conn.id);
      expect(revoked.status).toBe('revoked');
      expect(revoked.revoked_at).not.toBeNull();
      expect(isBankConsentActive(revoked)).toBe(false);
    });
  });

  describe('2. Sincronização, Normalização (Pix, Cartão, Transferência) e Anti-Duplicidade (Seção 9)', () => {
    it('deve normalizar transações sincronizadas, classificar Pix/Supermercado, evitar importar duplicatas e conciliar com o livro caixa', async () => {
      const activeConn = await useFinanceStore
        .getState()
        .authorizeBankConnectionConsent({
          providerName: 'pluggy',
          institutionName: 'Itaú Unibanco S.A.',
          institutionIspb: '60701190',
          grantedScopes: ['accounts', 'transactions'],
        });

      const batch1 = await useFinanceStore
        .getState()
        .syncBankTransactionsBatch(activeConn.id, [
          {
            providerTransactionId: 'of-tx-pix-001',
            providerAccountId: 'itau-acc-1',
            rawDescription: 'PIX ENVIADO   ATAKAREJO SALVADOR',
            amount: 312.45,
            direction: 'DEBIT',
            occurredAt: '2026-10-19T14:20:00.000Z',
          },
          {
            providerTransactionId: 'of-tx-sal-002',
            providerAccountId: 'itau-acc-1',
            rawDescription: 'CREDITO SALARIO FOLHA OUTUBRO',
            amount: 5400.0,
            direction: 'CREDIT',
            occurredAt: '2026-10-05T08:00:00.000Z',
          },
        ]);

      expect(batch1.stagedCount).toBe(2);
      expect(batch1.skippedDuplicatesCount).toBe(0);

      const stagedPix = batch1.stagedItems.find(
        (i) => i.provider_transaction_id === 'of-tx-pix-001',
      )!;
      expect(stagedPix.payment_method_hint).toBe('pix');
      expect(stagedPix.normalized_description).toBe(
        'PIX ENVIADO ATAKAREJO SALVADOR',
      );

      // Sincronizar novamente a mesma transação 'of-tx-pix-001' deve ser ignorado como duplicata
      const batch2 = await useFinanceStore
        .getState()
        .syncBankTransactionsBatch(activeConn.id, [
          {
            providerTransactionId: 'of-tx-pix-001',
            providerAccountId: 'itau-acc-1',
            rawDescription: 'PIX ENVIADO   ATAKAREJO SALVADOR',
            amount: 312.45,
            direction: 'DEBIT',
            occurredAt: '2026-10-19T14:20:00.000Z',
          },
        ]);

      expect(batch2.stagedCount).toBe(0);
      expect(batch2.skippedDuplicatesCount).toBe(1);

      // Conciliar e importar a transação para a tabela principal `transactions`
      const importedTx = await useFinanceStore
        .getState()
        .reconcileAndImportBankTransaction(stagedPix.id);
      expect(importedTx.origin).toBe('bank_integration');
      expect(importedTx.external_id).toBe('of-tx-pix-001');
      expect(importedTx.amount).toBe(312.45);

      // Tentar conciliar novamente a mesma transação já importada deve lançar erro de proteção
      await expect(
        useFinanceStore
          .getState()
          .reconcileAndImportBankTransaction(stagedPix.id),
      ).rejects.toThrow(/já foi conciliada e importada/);
    });

    it('deve identificar transferências de mesma titularidade para não inflar receitas ou despesas', () => {
      const state = useFinanceStore.getState();
      const classified = normalizeAndClassifyBankTransaction(
        {
          providerTransactionId: 'of-tx-transf-999',
          providerAccountId: 'acc-1',
          rawDescription: 'TRANSF MESMA TITULARIDADE CONTA PROPRIA',
          amount: 1000,
          direction: 'DEBIT',
          occurredAt: '2026-10-21T10:00:00Z',
        },
        state.categories,
        [],
        [],
      );

      expect(classified.suggestedKind).toBe('transfer');
    });
  });

  describe('3. Cartões de Crédito e Pagamento de Fatura sem Dupla Contagem (Seção 5 e 8)', () => {
    it('deve cadastrar cartão, lançar compra na competência e quitar fatura no caixa sem duplicar a despesa na competência', async () => {
      const card = await useFinanceStore.getState().createCreditCard({
        name: 'Cartão Teste Fase 5',
        brand: 'Visa',
        lastFourDigits: '9876',
        creditLimit: 6000,
        closingDay: 5,
        dueDay: 12,
      });

      await useFinanceStore.getState().createTransaction({
        kind: 'expense',
        description: 'Notebook Estudo no Cartão',
        amount: 2100,
        competenceDate: '2026-11-03',
        settlementDate: null,
        creditCardId: card.id,
        paymentMethod: 'credit_card',
        status: 'pending',
        isFixed: false,
        isRecurring: false,
        recurrenceFrequency: 'none',
        origin: 'manual',
      });

      const paidResult = await useFinanceStore
        .getState()
        .payCreditCardInvoice({
          creditCardId: card.id,
          referenceYearMonth: '2026-11',
          paymentAccountId: 'acc-principal',
          paymentDate: '2026-11-12',
        });

      expect(paidResult.invoice.status).toBe('paid');
      expect(paidResult.invoice.paid_amount).toBe(2100);
      expect(paidResult.paymentTransaction.kind).toBe('invoice_payment');

      const novMetrics = calculateMonthlyMetrics(
        useFinanceStore.getState().transactions,
        '2026-11',
      );

      // A despesa por competência em 2026-11 deve ser R$ 2.100 (e NÃO R$ 4.200)
      expect(novMetrics.competenceExpensesTotal).toBe(2100);
      // E o desembolso de caixa em 2026-11 pela quitação da fatura também é R$ 2.100
      expect(novMetrics.expensesPaidCash).toBe(2100);
      expect(novMetrics.invoicePaymentsTotal).toBe(2100);
    });
  });
});
