import fs from 'node:fs';
import path from 'node:path';
import {
  APP_CURRENCY,
  APP_LOCALE,
  APP_TIMEZONE,
  FINANCIAL_OBJECTIVE_OPTIONS,
  INITIAL_SYSTEM_CATEGORIES,
} from '@/config/constants';
import { getPublicEnv } from '@/config/env';
import { calculateMonthlyMetrics } from '@/domain/finance/cashflow-calculator';
import { formatCurrencyBRL, formatDateBR, sumCurrencyExact } from '@/utils/currency';

describe('Fase 1 — Fundação, Segurança, Cálculos Determinísticos e Schema SQL', () => {
  describe('1. Configurações regionais e constantes obrigatórias', () => {
    it('deve utilizar pt-BR, BRL e fuso America/Bahia como padrão', () => {
      expect(APP_LOCALE).toBe('pt-BR');
      expect(APP_CURRENCY).toBe('BRL');
      expect(APP_TIMEZONE).toBe('America/Bahia');
    });

    it('deve conter exatamente as 19 categorias iniciais exigidas na Seção 5', () => {
      expect(INITIAL_SYSTEM_CATEGORIES).toHaveLength(19);
      const slugs = INITIAL_SYSTEM_CATEGORIES.map((c) => c.slug);
      expect(slugs).toEqual(
        expect.arrayContaining([
          'moradia',
          'alimentacao',
          'supermercado',
          'almoco-refeicoes-fora',
          'transporte',
          'combustivel',
          'saude',
          'educacao',
          'lazer',
          'assinaturas',
          'cartao-de-credito',
          'emprestimos-e-dividas',
          'investimentos',
          'impostos',
          'compras-pessoais',
          'receitas-salariais',
          'renda-extra',
          'outras-receitas',
          'outras-despesas',
        ]),
      );
    });

    it('deve conter os 10 objetivos financeiros do Onboarding (Seção 4)', () => {
      expect(FINANCIAL_OBJECTIVE_OPTIONS).toHaveLength(10);
    });
  });

  describe('2. Segurança de variáveis de ambiente (Seção 3 e Seção 14)', () => {
    it('deve bloquear qualquer tentativa de expor chaves privadas com EXPO_PUBLIC_', () => {
      expect(() =>
        getPublicEnv({
          EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role',
        }),
      ).toThrow(/Violação de segurança crítica/);

      expect(() =>
        getPublicEnv({
          EXPO_PUBLIC_AI_API_KEY: 'sk-12345',
        }),
      ).toThrow(/Violação de segurança crítica/);
    });

    it('deve carregar variáveis públicas válidas com defaults seguros', () => {
      const env = getPublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://exemplo.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-jwt-public-token-12345',
      });
      expect(env.EXPO_PUBLIC_DEFAULT_CURRENCY).toBe('BRL');
      expect(env.EXPO_PUBLIC_DEFAULT_TIMEZONE).toBe('America/Bahia');
    });
  });

  describe('3. Precisão monetária e formatação brasileira', () => {
    it('deve somar valores decimais sem erro de ponto flutuante IEEE 754 (0.1 + 0.2 === 0.3)', () => {
      expect(sumCurrencyExact([0.1, 0.2])).toBe(0.3);
      expect(sumCurrencyExact([19.99, 0.01, 100.5])).toBe(120.5);
    });

    it('deve formatar moeda em BRL e datas em DD/MM/AAAA', () => {
      const formatted = formatCurrencyBRL(1234.56);
      expect(formatted).toContain('1.234,56');
      expect(formatDateBR('2026-10-28')).toBe('28/10/2026');
    });
  });

  describe('4. Cálculos determinísticos: Cartão de Crédito e Transferências (Seção 5 e 8)', () => {
    it('não deve duplicar compras no cartão de crédito quando a fatura é paga e deve ignorar transferências próprias', () => {
      const metrics = calculateMonthlyMetrics(
        [
          {
            kind: 'income',
            amount: 5000.0,
            competence_date: '2026-10-05',
            settlement_date: '2026-10-05',
            payment_method: 'pix',
            status: 'received',
            is_fixed: true,
          },
          {
            // Despesa à vista no Pix (afeta competência e caixa)
            kind: 'expense',
            amount: 1200.0,
            competence_date: '2026-10-10',
            settlement_date: '2026-10-10',
            payment_method: 'pix',
            status: 'paid',
            is_fixed: true,
          },
          {
            // Compra no cartão de crédito em outubro (afeta competência em R$ 450, mas não sai do caixa até o pagamento da fatura)
            kind: 'expense',
            amount: 450.0,
            competence_date: '2026-10-14',
            settlement_date: null,
            payment_method: 'credit_card',
            status: 'pending',
            is_fixed: false,
          },
          {
            // Pagamento da fatura anterior em outubro (afeta o caixa em R$ 800, mas NÃO duplica a competência de outubro)
            kind: 'invoice_payment',
            amount: 800.0,
            competence_date: '2026-10-15',
            settlement_date: '2026-10-15',
            payment_method: 'pix',
            status: 'paid',
            is_fixed: false,
          },
          {
            // Transferência entre conta corrente e reserva (NÃO é receita nem despesa)
            kind: 'transfer',
            amount: 1000.0,
            competence_date: '2026-10-20',
            settlement_date: '2026-10-20',
            payment_method: 'bank_transfer',
            status: 'paid',
            is_fixed: false,
          },
        ],
        '2026-10',
      );

      expect(metrics.incomeReceived).toBe(5000.0);
      // Caixa: R$ 1.200 (Pix) + R$ 800 (Pagamento de fatura) = R$ 2.000
      expect(metrics.expensesPaidCash).toBe(2000.0);
      expect(metrics.cashFlowBalance).toBe(3000.0);
      // Competência: R$ 1.200 (Aluguel/Fixo) + R$ 450 (Compra no cartão em outubro) = R$ 1.650 (Sem somar os R$ 800 da fatura!)
      expect(metrics.competenceExpensesTotal).toBe(1650.0);
      expect(metrics.fixedExpensesTotal).toBe(1200.0);
      expect(metrics.variableExpensesTotal).toBe(450.0);
      expect(metrics.creditCardSpendTotal).toBe(450.0);
      expect(metrics.invoicePaymentsTotal).toBe(800.0);
      expect(metrics.internalTransfersTotal).toBe(1000.0);
      expect(metrics.savingsRatePercent).toBe(60.0);
    });
  });

  describe('5. Verificação estática das Migrations SQL e Políticas RLS (Seção 13)', () => {
    const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
    const schemaSql = fs.readFileSync(
      path.join(migrationsDir, '20261028000001_initial_schema.sql'),
      'utf8',
    );
    const rlsSql = fs.readFileSync(
      path.join(migrationsDir, '20261028000002_rls_policies.sql'),
      'utf8',
    );

    const requiredTables = [
      'profiles',
      'categories',
      'accounts',
      'credit_cards',
      'card_invoices',
      'transactions',
      'financial_goals',
      'receipts',
      'receipt_items',
      'product_catalog',
      'bank_connections',
      'bank_transactions',
      'monthly_summaries',
      'goals_progress',
      'gamification_events',
      'user_levels',
      'ai_recommendations',
    ];

    it.each(requiredTables)(
      'deve definir a tabela public.%s com RLS habilitado e forçado',
      (tableName) => {
        expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS public.${tableName}`);
        expect(rlsSql).toContain(
          `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`,
        );
        expect(rlsSql).toContain(
          `ALTER TABLE public.${tableName} FORCE ROW LEVEL SECURITY;`,
        );
      },
    );

    it('deve isolar os tokens bancários em private.bank_connection_secrets revogando acesso de anon e authenticated', () => {
      expect(schemaSql).toContain(
        'CREATE TABLE IF NOT EXISTS private.bank_connection_secrets',
      );
      expect(rlsSql).toContain(
        'REVOKE ALL ON TABLE private.bank_connection_secrets FROM PUBLIC, anon, authenticated;',
      );
    });
  });
});
