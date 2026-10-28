import * as XLSX from 'xlsx';
import {
  compareMonthlyPerformance,
  detectRecurringExpenses,
  evaluateCategoryBudgets,
} from '@/domain/finance/budget-and-comparison';
import {
  categoryInputSchema,
  onboardingInputSchema,
  transactionInputSchema,
} from '@/domain/finance/validators';
import { buildFinancialExcelWorkbook } from '@/domain/xlsx/excel-exporter';
import { useFinanceStore } from '@/features/finance/use-finance-store';

describe('Fase 2 — MVP Financeiro (Onboarding, Categorias, Lançamentos, Dashboard e Excel)', () => {
  describe('1. Cadastro e Onboarding (Seção 4)', () => {
    it('deve permitir concluir o onboarding sem obrigar o usuário a informar renda, dívidas ou reserva', () => {
      const parsed = onboardingInputSchema.parse({
        displayName: 'Maria Souza',
        email: 'maria.souza@exemplo.com.br',
        primaryObjective: 'emergency_fund',
        monthlyNetIncome: null,
        approxFixedExpenses: null,
        monthlyDebtInstallments: null,
        currentEmergencyFund: null,
        trackingProfile: 'balanced',
        trackedCategorySlugs: ['moradia', 'supermercado'],
        privacyPolicyAccepted: true,
      });

      expect(parsed.displayName).toBe('Maria Souza');
      expect(parsed.monthlyNetIncome).toBeNull();
      expect(parsed.currentEmergencyFund).toBeNull();
    });

    it('deve exigir descrição quando o objetivo financeiro for personalizado ("custom")', () => {
      expect(() =>
        onboardingInputSchema.parse({
          displayName: 'Carlos Lima',
          email: 'carlos@exemplo.com.br',
          primaryObjective: 'custom',
          customObjectiveDescription: '',
          trackedCategorySlugs: ['moradia'],
          privacyPolicyAccepted: true,
        }),
      ).toThrow(/Descreva seu objetivo personalizado/);
    });
  });

  describe('2. Validação de Receitas, Despesas, Cartões e Transferências (Seção 5)', () => {
    it('deve rejeitar transferência entre a mesma conta de origem e destino', () => {
      expect(() =>
        transactionInputSchema.parse({
          kind: 'transfer',
          description: 'Transferência inválida',
          amount: 100,
          competenceDate: '2026-10-15',
          accountId: 'acc-1',
          destinationAccountId: 'acc-1',
        }),
      ).toThrow(/A conta de destino deve ser diferente da conta de origem/);
    });

    it('deve exigir seleção de cartão de crédito quando a forma de pagamento for credit_card', () => {
      expect(() =>
        transactionInputSchema.parse({
          kind: 'expense',
          description: 'Compra Supermercado',
          amount: 250.5,
          competenceDate: '2026-10-15',
          paymentMethod: 'credit_card',
          creditCardId: null,
        }),
      ).toThrow(/Selecione o cartão de crédito utilizado na compra/);
    });

    it('deve validar criação de categoria personalizada com orçamento mensal', () => {
      const cat = categoryInputSchema.parse({
        name: 'Pet Shop',
        kind: 'expense',
        colorHex: '#10B981',
        monthlyBudget: 350,
        alertThresholdPercent: 80,
      });
      expect(cat.name).toBe('Pet Shop');
      expect(cat.monthlyBudget).toBe(350);
    });
  });

  describe('3. Orçamentos Mensais, Alertas, Comparação Mensal e Despesas Recorrentes (Seção 5 e 8)', () => {
    const mockCategories = [
      {
        id: 'cat-mercado',
        name: 'Supermercado',
        kind: 'expense' as const,
        color_hex: '#16A34A',
        icon: 'shopping-cart',
        monthly_budget: 1000,
        alert_threshold_percent: 80,
      },
      {
        id: 'cat-lazer',
        name: 'Lazer',
        kind: 'expense' as const,
        color_hex: '#EC4899',
        icon: 'smile',
        monthly_budget: 300,
        alert_threshold_percent: 80,
      },
    ];

    const mockTransactions = [
      // Setembro (mês anterior)
      {
        id: 'tx-sep-1',
        category_id: 'cat-mercado',
        subcategory_id: null,
        kind: 'expense' as const,
        description: 'Supermercado Mensal',
        amount: 700,
        competence_date: '2026-09-10',
        settlement_date: '2026-09-10',
        payment_method: 'pix' as const,
        status: 'paid' as const,
        is_fixed: false,
        is_recurring: false,
      },
      {
        id: 'tx-sep-2',
        category_id: 'cat-lazer',
        subcategory_id: null,
        kind: 'expense' as const,
        description: 'Streaming Musical',
        amount: 34.9,
        competence_date: '2026-09-15',
        settlement_date: '2026-09-15',
        payment_method: 'credit_card' as const,
        status: 'paid' as const,
        is_fixed: true,
        is_recurring: true,
      },
      // Outubro (mês atual)
      {
        id: 'tx-oct-1',
        category_id: 'cat-mercado',
        subcategory_id: null,
        kind: 'expense' as const,
        description: 'Supermercado Mensal',
        amount: 850, // 85% do orçamento de R$ 1.000 -> warning
        competence_date: '2026-10-12',
        settlement_date: '2026-10-12',
        payment_method: 'pix' as const,
        status: 'paid' as const,
        is_fixed: false,
        is_recurring: false,
      },
      {
        id: 'tx-oct-2',
        category_id: 'cat-lazer',
        subcategory_id: null,
        kind: 'expense' as const,
        description: 'Show e passeio',
        amount: 360, // 120% do orçamento de R$ 300 -> exceeded
        competence_date: '2026-10-18',
        settlement_date: null,
        payment_method: 'credit_card' as const,
        status: 'pending' as const,
        is_fixed: false,
        is_recurring: false,
      },
      {
        id: 'tx-oct-3',
        category_id: 'cat-lazer',
        subcategory_id: null,
        kind: 'expense' as const,
        description: 'Streaming Musical',
        amount: 34.9,
        competence_date: '2026-10-15',
        settlement_date: null,
        payment_method: 'credit_card' as const,
        status: 'pending' as const,
        is_fixed: true,
        is_recurring: true,
      },
    ];

    it('deve disparar alerta warning (>= 80%) e exceeded (> 100%) corretamente', () => {
      const budgets = evaluateCategoryBudgets(
        mockCategories,
        mockTransactions,
        '2026-10',
      );
      const mercado = budgets.find((b) => b.categoryId === 'cat-mercado');
      const lazer = budgets.find((b) => b.categoryId === 'cat-lazer');

      expect(mercado?.spentCompetenceAmount).toBe(850);
      expect(mercado?.usagePercent).toBe(85);
      expect(mercado?.alertLevel).toBe('warning');

      expect(lazer?.spentCompetenceAmount).toBe(394.9);
      expect(lazer?.alertLevel).toBe('exceeded');
    });

    it('deve comparar o mês atual contra o anterior e identificar aumentos por categoria', () => {
      const comp = compareMonthlyPerformance(
        mockCategories,
        mockTransactions,
        '2026-10',
        '2026-09',
      );

      expect(comp.previousMonth.competenceExpensesTotal).toBe(734.9);
      expect(comp.currentMonth.competenceExpensesTotal).toBe(1244.9);
      expect(comp.competenceExpensesDelta).toBe(510);
      expect(comp.topIncreases.length).toBeGreaterThanOrEqual(2);
    });

    it('deve detectar despesas recorrentes por flag explícita ou repetição mensal', () => {
      const recurring = detectRecurringExpenses(mockTransactions);
      const descriptions = recurring.map((r) => r.normalizedDescription);
      expect(descriptions).toContain('streaming musical');
      expect(descriptions).toContain('supermercado mensal');
    });
  });

  describe('4. Fluxo completo da Store (CRUD, Autorização e Anti-Duplicidade)', () => {
    it('deve salvar onboarding, criar/editar/excluir lançamento e bloquear duplicidade por externalId', async () => {
      const store = useFinanceStore.getState();

      const savedProfile = await store.completeOnboardingAndSaveProfile({
        displayName: 'Douglas Teste',
        email: 'douglas@dkctech.com.br',
        primaryObjective: 'monthly_savings',
        monthlyNetIncome: 6500,
        incomeFrequency: 'monthly',
        approxFixedExpenses: 2500,
        monthlyDebtInstallments: 0,
        currentEmergencyFund: 10000,
        trackingProfile: 'detailed',
        trackedCategorySlugs: ['moradia', 'supermercado', 'investimentos'],
        privacyPolicyAccepted: true,
      });

      expect(savedProfile.onboarding_completed).toBe(true);
      expect(savedProfile.current_emergency_fund).toBe(10000);

      // Criar receita
      const createdTx = await useFinanceStore.getState().createTransaction({
        kind: 'income',
        description: 'Salário Outubro',
        amount: 6500,
        competenceDate: '2026-10-05',
        settlementDate: '2026-10-05',
        paymentMethod: 'pix',
        status: 'received',
        isFixed: true,
        isRecurring: true,
        recurrenceFrequency: 'monthly',
        origin: 'manual',
        externalId: 'ext-salario-2026-10',
      });

      expect(createdTx.amount).toBe(6500);

      // Tentar duplicar o mesmo externalId e origin deve falhar
      await expect(
        useFinanceStore.getState().createTransaction({
          kind: 'income',
          description: 'Salário Outubro Duplicado',
          amount: 6500,
          competenceDate: '2026-10-05',
          settlementDate: '2026-10-05',
          paymentMethod: 'pix',
          status: 'received',
          isFixed: true,
          isRecurring: true,
          recurrenceFrequency: 'monthly',
          origin: 'manual',
          externalId: 'ext-salario-2026-10',
        }),
      ).rejects.toThrow(/duplicidade bloqueada/);

      // Editar lançamento
      const updatedTx = await useFinanceStore
        .getState()
        .updateTransaction(createdTx.id, {
          kind: 'income',
          description: 'Salário Outubro Atualizado',
          amount: 6800,
          competenceDate: '2026-10-05',
          settlementDate: '2026-10-05',
          paymentMethod: 'pix',
          status: 'received',
          isFixed: true,
          isRecurring: true,
          recurrenceFrequency: 'monthly',
          origin: 'manual',
          externalId: 'ext-salario-2026-10',
        });

      expect(updatedTx.amount).toBe(6800);

      // Excluir lançamento
      await useFinanceStore.getState().deleteTransaction(createdTx.id);
      const remaining = useFinanceStore
        .getState()
        .transactions.find((t) => t.id === createdTx.id);
      expect(remaining).toBeUndefined();
    });
  });

  describe('5. Exportação Real para Excel (.XLSX) com 9 abas (Seção 10)', () => {
    it('deve gerar um arquivo XLSX binário/base64 válido contendo todas as 9 abas exigidas e totais exatos', () => {
      const state = useFinanceStore.getState();

      const result = buildFinancialExcelWorkbook({
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        referenceYearMonth: '2026-10',
        userDisplayName: 'Douglas Teste',
        categories: state.categories,
        transactions: [
          {
            id: 'tx-1',
            user_id: state.currentUserId,
            account_id: 'acc-principal',
            destination_account_id: null,
            credit_card_id: null,
            card_invoice_id: null,
            category_id: state.categories[0]?.id ?? null,
            subcategory_id: null,
            kind: 'income',
            description: 'Receita Consultoria',
            amount: 4200,
            competence_date: '2026-10-05',
            settlement_date: '2026-10-05',
            payment_method: 'pix',
            status: 'received',
            is_fixed: false,
            is_recurring: false,
            recurrence_frequency: 'none',
            installment_number: null,
            total_installments: null,
            recurrence_group_id: null,
            notes: null,
            origin: 'manual',
            external_id: null,
            created_at: '2026-10-05T12:00:00Z',
            updated_at: '2026-10-05T12:00:00Z',
          },
          {
            id: 'tx-2',
            user_id: state.currentUserId,
            account_id: 'acc-principal',
            destination_account_id: null,
            credit_card_id: null,
            card_invoice_id: null,
            category_id: state.categories[2]?.id ?? null,
            subcategory_id: null,
            kind: 'expense',
            description: 'Feira do Mês',
            amount: 650.4,
            competence_date: '2026-10-11',
            settlement_date: '2026-10-11',
            payment_method: 'pix',
            status: 'paid',
            is_fixed: false,
            is_recurring: false,
            recurrence_frequency: 'none',
            installment_number: null,
            total_installments: null,
            recurrence_group_id: null,
            notes: null,
            origin: 'manual',
            external_id: null,
            created_at: '2026-10-11T12:00:00Z',
            updated_at: '2026-10-11T12:00:00Z',
          },
        ],
      });

      expect(result.fileName).toBe('financeiro-inteligente-2026-10.xlsx');
      expect(result.base64Content.length).toBeGreaterThan(100);
      expect(result.sheetNames).toEqual([
        'Resumo financeiro',
        'Receitas',
        'Despesas',
        'Categorias',
        'Compras e notas fiscais',
        'Itens e histórico de preços',
        'Cartões e faturas',
        'Metas financeiras',
        'Evolução mensal',
      ]);

      // Faz o parse de volta do binário base64 gerado para comprovar que é um XLSX autêntico
      const parsedWorkbook = XLSX.read(result.base64Content, { type: 'base64' });
      expect(parsedWorkbook.SheetNames).toHaveLength(9);

      const summarySheet = parsedWorkbook.Sheets['Resumo financeiro'];
      expect(summarySheet).toBeDefined();
      const summaryJson = XLSX.utils.sheet_to_json<{
        Indicador: string;
        Valor_Numerico: number | null;
      }>(summarySheet!);

      const incomeRow = summaryJson.find(
        (r) => r.Indicador === 'Receitas Recebidas (Fluxo de Caixa)',
      );
      const expenseRow = summaryJson.find(
        (r) => r.Indicador === 'Despesas Pagas (Fluxo de Caixa)',
      );
      expect(incomeRow?.Valor_Numerico).toBe(4200);
      expect(expenseRow?.Valor_Numerico).toBe(650.4);
    });
  });
});
