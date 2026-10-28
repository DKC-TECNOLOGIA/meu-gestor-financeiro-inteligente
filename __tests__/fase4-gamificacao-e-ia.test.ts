import {
  generateDeterministicAdvisorRecommendations,
  validateAdvisorSafetyConstraints,
} from '@/domain/advisor/financial-advisor';
import {
  GAMIFICATION_LEVELS,
  resolveGamificationLevel,
} from '@/domain/gamification/gamification-engine';
import { useFinanceStore } from '@/features/finance/use-finance-store';

describe('Fase 4 — Gamificação, Metas Financeiras e Orientador Financeiro (IA)', () => {
  describe('1. Metas Financeiras e Evolução de Aportes (Seção 2 e 12)', () => {
    it('deve criar uma meta financeira, registrar aportes e concluir automaticamente ao atingir o alvo', async () => {
      const goal = await useFinanceStore.getState().createFinancialGoal({
        name: 'Reserva de Emergência 3 Meses',
        objectiveType: 'emergency_fund',
        targetAmount: 3000,
        currentAmount: 500,
        monthlyContributionTarget: 500,
        targetDate: '2027-04-30',
      });

      expect(goal.current_amount).toBe(500);
      expect(goal.status).toBe('active');

      const firstContrib = await useFinanceStore
        .getState()
        .recordGoalContribution(goal.id, 1000, 'Aporte Outubro');
      expect(firstContrib.goal.current_amount).toBe(1500);
      expect(firstContrib.goal.status).toBe('active');

      const finalContrib = await useFinanceStore
        .getState()
        .recordGoalContribution(goal.id, 1500, 'Aporte Bônus');
      expect(finalContrib.goal.current_amount).toBe(3000);
      expect(finalContrib.goal.status).toBe('completed');
    });
  });

  describe('2. Gamificação Auditável, Idempotência e 4 Níveis (Seção 12)', () => {
    it('deve mapear os 4 níveis (Iniciante, Consciente, Disciplinado, Estratégico) corretamente', () => {
      expect(GAMIFICATION_LEVELS).toHaveLength(4);
      expect(resolveGamificationLevel(0).level).toBe('iniciante');
      expect(resolveGamificationLevel(199).level).toBe('iniciante');
      expect(resolveGamificationLevel(200).level).toBe('consciente');
      expect(resolveGamificationLevel(600).level).toBe('disciplinado');
      expect(resolveGamificationLevel(1500).level).toBe('estrategico');
    });

    it('deve registrar evento auditável e impedir duplicação pela mesma idempotencyKey', async () => {
      const store = useFinanceStore.getState();
      const beforePoints = store.userLevel.total_points;

      const afterFirst = await store.recordAuditGamificationEvent({
        ruleCode: 'REGULAR_RECORDING_WEEK',
        reasonDescription: '3 lançamentos registrados na semana',
        pointsDelta: 210,
        idempotencyKey: 'TEST_IDEMPOTENCY_OCT_W1',
        referenceMonth: '2026-10-01',
      });

      expect(afterFirst.total_points).toBe(beforePoints + 210);
      expect(afterFirst.current_level).toBe('consciente');

      // Repetir exatamente a mesma idempotencyKey NÃO deve somar pontos novamente
      const afterDuplicate = await useFinanceStore
        .getState()
        .recordAuditGamificationEvent({
          ruleCode: 'REGULAR_RECORDING_WEEK',
          reasonDescription: 'Tentativa duplicada de pontos',
          pointsDelta: 210,
          idempotencyKey: 'TEST_IDEMPOTENCY_OCT_W1',
          referenceMonth: '2026-10-01',
        });

      expect(afterDuplicate.total_points).toBe(beforePoints + 210);
    });
  });

  describe('3. Orientador Financeiro por IA e Guardrails Éticos (Seção 11)', () => {
    it('deve bloquear qualquer recomendação que contenha ativos especulativos, promessa de retorno ou empréstimos para investir', () => {
      expect(() =>
        validateAdvisorSafetyConstraints({
          title: 'Dica de Investimento',
          identifiedSituation: 'Saldo livre',
          supportingData: { facts: {}, estimates: {} },
          estimatedFinancialImpact: 500,
          isImpactEstimate: true,
          suggestedAction:
            'Compre ações PETR4 ou faça day trade com retorno garantido.',
          timeframeOrFrequency: 'Hoje',
          confidenceLevel: 'low',
          risksAndLimitations: 'Alto risco',
          evaluationMethod: 'N/A',
          requiresProfessionalReview: true,
        }),
      ).toThrow(/Violação de segurança do Orientador Financeiro/);
    });

    it('deve gerar recomendações contendo todos os 8 campos obrigatórios, distinguindo fatos de estimativas e permitindo aceitar/concluir', async () => {
      const state = useFinanceStore.getState();

      // Configurar orçamento na categoria Lazer e lançar gasto acima do teto
      const lazerCat = state.categories.find((c) => c.slug === 'lazer')!;
      await state.updateCategoryBudget(lazerCat.id, 200, 80);

      await useFinanceStore.getState().createTransaction({
        kind: 'expense',
        description: 'Ingressos Show',
        amount: 280,
        competenceDate: '2026-10-20',
        settlementDate: '2026-10-20',
        categoryId: lazerCat.id,
        paymentMethod: 'pix',
        status: 'paid',
        isFixed: false,
        isRecurring: false,
        recurrenceFrequency: 'none',
        origin: 'manual',
      });

      const recommendations = await useFinanceStore
        .getState()
        .generateAdvisorRecommendationsForMonth('2026-10');

      expect(recommendations.length).toBeGreaterThanOrEqual(1);

      const firstRec = recommendations[0]!;
      // Verificar presença dos 8 elementos obrigatórios (Seção 11)
      expect(firstRec.identified_situation.length).toBeGreaterThan(10);
      expect(firstRec.supporting_data).toHaveProperty('facts');
      expect(firstRec.supporting_data).toHaveProperty('estimates');
      expect(typeof firstRec.estimated_financial_impact).toBe('number');
      expect(firstRec.is_impact_estimate).toBe(true);
      expect(firstRec.suggested_action.length).toBeGreaterThan(10);
      expect(firstRec.timeframe_or_frequency.length).toBeGreaterThan(3);
      expect(['low', 'medium', 'high']).toContain(firstRec.confidence_level);
      expect(firstRec.risks_and_limitations.length).toBeGreaterThan(10);
      expect(firstRec.evaluation_method.length).toBeGreaterThan(10);

      // Testar fluxo de Aceitar -> Concluir com medição de impacto real
      const accepted = await useFinanceStore
        .getState()
        .updateAdvisorRecommendationStatus(firstRec.id, 'accepted');
      expect(accepted.status).toBe('accepted');
      expect(accepted.responded_at).not.toBeNull();

      const completed = await useFinanceStore
        .getState()
        .updateAdvisorRecommendationStatus(
          firstRec.id,
          'completed',
          95.5,
          'Reduzi os gastos variáveis conforme planejado.',
        );
      expect(completed.status).toBe('completed');
      expect(completed.actual_measured_impact).toBe(95.5);
      expect(completed.completed_at).not.toBeNull();
    });

    it('deve recomendar avaliação profissional quando houver alto comprometimento com dívidas ou fluxo de caixa negativo', () => {
      const state = useFinanceStore.getState();
      const drafts = generateDeterministicAdvisorRecommendations({
        referenceYearMonth: '2026-10',
        previousYearMonth: '2026-09',
        profile: {
          ...(state.profile ?? {
            id: 'u1',
            display_name: 'Teste',
            email: 't@t.com',
            primary_objective: 'exit_debt',
            custom_objective_description: null,
            income_frequency: 'monthly',
            approx_fixed_expenses: 2000,
            current_emergency_fund: 0,
            tracking_profile: 'balanced',
            tracked_category_slugs: ['moradia'],
            currency: 'BRL',
            timezone: 'America/Bahia',
            onboarding_completed: true,
            privacy_policy_accepted_at: '2026-10-01T00:00:00Z',
            privacy_policy_version: '1.0.0',
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
          }),
          monthly_net_income: 3000,
          monthly_debt_installments: 1500, // 50% da renda comprometida
        },
        categories: state.categories,
        transactions: [],
        goals: [],
        receiptItems: [],
        productCatalog: [],
      });

      const debtRec = drafts.find((d) => d.requiresProfessionalReview);
      expect(debtRec).toBeDefined();
      expect(debtRec?.requiresProfessionalReview).toBe(true);
    });
  });
});
