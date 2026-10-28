import {
  AiConfidenceLevelType,
  CategoryRow,
  FinancialGoalRow,
  ProductCatalogRow,
  ProfileRow,
  ReceiptItemRow,
  TransactionRow,
} from '@/types/database.types';
import { evaluateCategoryBudgets } from '@/domain/finance/budget-and-comparison';
import { calculateMonthlyMetrics } from '@/domain/finance/cashflow-calculator';
import { compareCatalogPricesByMonth } from '@/domain/price-comparison/price-analyzer';
import { formatCurrencyBRL, fromCents, toCents } from '@/utils/currency';

/**
 * Estrutura obrigatória de 8 campos para toda recomendação do Orientador Financeiro (Seção 11):
 * 1. Situação identificada (identifiedSituation)
 * 2. Dados que fundamentam a análise (supportingData — sempre determinísticos)
 * 3. Impacto financeiro estimado (estimatedFinancialImpact + isImpactEstimate)
 * 4. Ação concreta sugerida (suggestedAction)
 * 5. Prazo ou frequência (timeframeOrFrequency)
 * 6. Nível de confiança (confidenceLevel)
 * 7. Riscos e limitações (risksAndLimitations)
 * 8. Como avaliar o resultado posteriormente (evaluationMethod)
 */
export interface StructuredAdvisorRecommendationDraft {
  title: string;
  identifiedSituation: string;
  supportingData: {
    facts: Record<string, string | number | boolean | null>;
    estimates: Record<string, string | number | null>;
  };
  estimatedFinancialImpact: number;
  isImpactEstimate: boolean;
  suggestedAction: string;
  timeframeOrFrequency: string;
  confidenceLevel: AiConfidenceLevelType;
  risksAndLimitations: string;
  evaluationMethod: string;
  requiresProfessionalReview: boolean;
}

const FORBIDDEN_RECOMMENDATION_TERMS = [
  /compre\s+a[cç][oõ]es/i,
  /ticker\s+[A-Z]{4}\d/i,
  /criptomoeda|bitcoin|alavancagem|day\s*trade|op[cç][oõ]es\s+bin[aá]rias/i,
  /retorno\s+garantido|lucro\s+certo|rendimento\s+garantido/i,
  /contratar\s+empr[eé]stimo\s+para\s+investir/i,
];

/**
 * Guardrail de segurança (Seção 11):
 * Impede que qualquer recomendação sugira investimentos específicos, operações especulativas,
 * promessa de rendimentos ou contratação automática de novos empréstimos.
 */
export function validateAdvisorSafetyConstraints(
  draft: StructuredAdvisorRecommendationDraft,
): boolean {
  const combinedText = `${draft.title} ${draft.identifiedSituation} ${draft.suggestedAction}`;
  for (const pattern of FORBIDDEN_RECOMMENDATION_TERMS) {
    if (pattern.test(combinedText)) {
      throw new Error(
        'Violação de segurança do Orientador Financeiro: não é permitido recomendar ativos específicos, operações especulativas ou prometer rendimentos.',
      );
    }
  }
  return true;
}

/**
 * Gera recomendações financeiras baseadas EXCLUSIVAMENTE em cálculos determinísticos
 * sobre os dados reais do usuário (Seção 11).
 * Nunca inventa transações ou dados ausentes, distinguindo explicitamente `facts` de `estimates`.
 */
export function generateDeterministicAdvisorRecommendations(params: {
  referenceYearMonth: string; // 'YYYY-MM'
  previousYearMonth: string; // 'YYYY-MM'
  profile: ProfileRow | null;
  categories: readonly CategoryRow[];
  transactions: readonly TransactionRow[];
  goals: readonly FinancialGoalRow[];
  receiptItems: readonly ReceiptItemRow[];
  productCatalog: readonly ProductCatalogRow[];
}): StructuredAdvisorRecommendationDraft[] {
  const {
    referenceYearMonth,
    previousYearMonth,
    profile,
    categories,
    transactions,
    goals,
    receiptItems,
    productCatalog,
  } = params;

  const metrics = calculateMonthlyMetrics(transactions, referenceYearMonth);
  const budgets = evaluateCategoryBudgets(categories, transactions, referenceYearMonth);
  const priceComparisons = compareCatalogPricesByMonth(
    receiptItems,
    productCatalog,
    referenceYearMonth,
    previousYearMonth,
  );

  const recommendations: StructuredAdvisorRecommendationDraft[] = [];

  // 1. Análise de Categorias com Orçamento Estourado ou em Alerta (Controle de Gastos)
  const exceededOrWarning = budgets.filter(
    (b) => b.alertLevel === 'exceeded' || b.alertLevel === 'warning',
  );

  for (const b of exceededOrWarning.slice(0, 2)) {
    const budgetVal = b.monthlyBudget ?? 0;
    const excessCents = Math.max(
      0,
      toCents(b.spentCompetenceAmount) - toCents(budgetVal),
    );
    const targetReduction =
      excessCents > 0
        ? fromCents(excessCents)
        : fromCents(Math.round(toCents(b.spentCompetenceAmount) * 0.1));

    const draft: StructuredAdvisorRecommendationDraft = {
      title: `Ajuste de Orçamento: ${b.categoryName}`,
      identifiedSituation:
        b.alertLevel === 'exceeded'
          ? `O gasto por competência na categoria "${b.categoryName}" atingiu ${formatCurrencyBRL(b.spentCompetenceAmount)}, ultrapassando o teto planejado de ${formatCurrencyBRL(budgetVal)} (${b.usagePercent}% utilizado).`
          : `A categoria "${b.categoryName}" atingiu ${b.usagePercent}% do limite mensal de ${formatCurrencyBRL(budgetVal)}.`,
      supportingData: {
        facts: {
          categoria: b.categoryName,
          gastoRealCompetenciaBRL: b.spentCompetenceAmount,
          orcamentoPlanejadoBRL: budgetVal,
          percentualUtilizado: b.usagePercent,
          quantidadeLancamentosNoMes: b.transactionCount,
        },
        estimates: {
          economiaPotencialMensalBRL: targetReduction,
        },
      },
      estimatedFinancialImpact: targetReduction,
      isImpactEstimate: true,
      suggestedAction: `Revisar os ${b.transactionCount} lançamento(s) de "${b.categoryName}" neste mês e estabelecer um limite semanal para os próximos 30 dias visando reduzir ${formatCurrencyBRL(targetReduction)}.`,
      timeframeOrFrequency: 'Próximos 30 dias (acompanhamento semanal)',
      confidenceLevel: b.transactionCount >= 2 ? 'high' : 'medium',
      risksAndLimitations:
        'Caso parte do gasto decorra de imprevisto inadiável, priorize o reequilíbrio entre categorias não essenciais sem comprometer itens básicos.',
      evaluationMethod: `Comparar o total de competência da categoria "${b.categoryName}" no fechamento do próximo mês contra o teto de ${formatCurrencyBRL(budgetVal)}.`,
      requiresProfessionalReview: false,
    };

    validateAdvisorSafetyConstraints(draft);
    recommendations.push(draft);
  }

  // 2. Análise de Aumento de Preços de Supermercado (Planejamento de Compras via NFC-e)
  const significantPriceIncreases = priceComparisons.filter(
    (p) => p.hasSufficientHistory && p.percentDelta != null && p.percentDelta >= 8,
  );

  if (significantPriceIncreases.length > 0) {
    const topItem = significantPriceIncreases[0]!;
    const unitDiff = topItem.absoluteDelta ?? 0;

    const draft: StructuredAdvisorRecommendationDraft = {
      title: `Alerta de Preço na Feira: ${topItem.productDisplayName}`,
      identifiedSituation: `O item "${topItem.productDisplayName}" apresentou alta de +${topItem.percentDelta}% em ${referenceYearMonth} (${formatCurrencyBRL(topItem.currentMonthAvgPrice ?? 0)}/${topItem.baseUnit}) em relação a ${previousYearMonth} (${formatCurrencyBRL(topItem.previousMonthAvgPrice ?? 0)}/${topItem.baseUnit}).`,
      supportingData: {
        facts: {
          produto: topItem.productDisplayName,
          unidadeBase: topItem.baseUnit,
          precoMedioMesAnteriorBRL: topItem.previousMonthAvgPrice,
          precoMedioMesAtualBRL: topItem.currentMonthAvgPrice,
          menorPrecoObservadoBRL: topItem.minObservedPrice,
          estabelecimentoMenorPreco: topItem.minPriceMerchant,
        },
        estimates: {
          economiaEstimadaEm4UnidadesBRL: fromCents(toCents(unitDiff) * 4),
        },
      },
      estimatedFinancialImpact: fromCents(Math.max(toCents(unitDiff) * 4, 100)),
      isImpactEstimate: true,
      suggestedAction: `Priorizar a compra de "${topItem.productDisplayName}" no estabelecimento com menor histórico registrado (${topItem.minPriceMerchant}: ${formatCurrencyBRL(topItem.minObservedPrice)}/${topItem.baseUnit}) ou avaliar marca equivalente no catálogo.`,
      timeframeOrFrequency: 'Na próxima compra de supermercado',
      confidenceLevel: 'high',
      risksAndLimitations:
        'Os preços em supermercados sofrem variações sazonais; confira sempre o preço por unidade de medida (KG/L) na gôndola.',
      evaluationMethod:
        'Importar a próxima NFC-e pelo scanner e verificar se o preço unitário líquido ficou abaixo da média atual.',
      requiresProfessionalReview: false,
    };

    validateAdvisorSafetyConstraints(draft);
    recommendations.push(draft);
  }

  // 3. Avaliação de Dívidas Elevadas / Fluxo de Caixa Negativo (Recomendando Avaliação Profissional quando complexo)
  const declaredDebt = profile?.monthly_debt_installments ?? 0;
  const effectiveIncome =
    metrics.incomeReceived > 0
      ? metrics.incomeReceived
      : (profile?.monthly_net_income ?? 0);

  if (
    (effectiveIncome > 0 && declaredDebt / effectiveIncome >= 0.3) ||
    metrics.cashFlowBalance < 0
  ) {
    const deficitOrDebt =
      metrics.cashFlowBalance < 0
        ? Math.abs(metrics.cashFlowBalance)
        : declaredDebt;

    const draft: StructuredAdvisorRecommendationDraft = {
      title: 'Equilíbrio de Caixa e Organização de Compromissos',
      identifiedSituation:
        metrics.cashFlowBalance < 0
          ? `O fluxo de caixa de ${referenceYearMonth} encontra-se negativo em ${formatCurrencyBRL(Math.abs(metrics.cashFlowBalance))} (despesas pagas superaram as receitas recebidas).`
          : `O comprometimento declarado com parcelas e dívidas (${formatCurrencyBRL(declaredDebt)}) representa ${((declaredDebt / effectiveIncome) * 100).toFixed(1)}% da renda mensal.`,
      supportingData: {
        facts: {
          receitasRecebidasMesBRL: metrics.incomeReceived,
          despesasPagasMesBRL: metrics.expensesPaidCash,
          saldoCaixaPeriodoBRL: metrics.cashFlowBalance,
          parcelasDividasDeclaradasBRL: declaredDebt,
        },
        estimates: {
          necessidadeReequilibrioMensalBRL: deficitOrDebt,
        },
      },
      estimatedFinancialImpact: deficitOrDebt,
      isImpactEstimate: true,
      suggestedAction:
        'Mapear todas as despesas variáveis não essenciais para interromper o uso de limite rotativo/cheque especial e listar os contratos por Custo Efetivo Total (CET). Como há alto comprometimento de caixa, recomenda-se avaliação profissional especializada antes de qualquer renegociação contratual.',
      timeframeOrFrequency: 'Imediato (revisão mensal)',
      confidenceLevel: 'high',
      risksAndLimitations:
        'Este aplicativo não recomenda contratação automática de novos empréstimos. Renegociações exigem análise individual das taxas de juros e cláusulas contratuais com um planejador financeiro ou instituição credora.',
      evaluationMethod:
        'Acompanhar a redução do saldo devedor e a reversão do saldo de caixa mensal para território positivo no Dashboard.',
      requiresProfessionalReview: true,
    };

    validateAdvisorSafetyConstraints(draft);
    recommendations.push(draft);
  }

  // 4. Formação de Reserva de Emergência e Metas Ativas (Planejamento de Aportes sem prometer rendimentos)
  const activeGoals = goals.filter((g) => g.status === 'active');
  if (activeGoals.length > 0 || recommendations.length === 0) {
    const primaryGoal = activeGoals[0];
    const suggestedContribution =
      primaryGoal?.monthly_contribution_target &&
      primaryGoal.monthly_contribution_target > 0
        ? primaryGoal.monthly_contribution_target
        : metrics.cashFlowBalance > 0
          ? fromCents(Math.round(toCents(metrics.cashFlowBalance) * 0.2))
          : 100;

    const draft: StructuredAdvisorRecommendationDraft = {
      title: primaryGoal
        ? `Constância na Meta: ${primaryGoal.name}`
        : 'Construção de Reserva de Emergência e Hábito de Poupança',
      identifiedSituation: primaryGoal
        ? `A meta "${primaryGoal.name}" acumula ${formatCurrencyBRL(primaryGoal.current_amount)} de um objetivo de ${formatCurrencyBRL(primaryGoal.target_amount)}.`
        : `Em ${referenceYearMonth}, seu saldo de caixa positivo é de ${formatCurrencyBRL(Math.max(0, metrics.cashFlowBalance))}, permitindo estruturar aportes regulares para sua reserva de segurança.`,
      supportingData: {
        facts: {
          metaAtiva: primaryGoal?.name ?? 'Reserva de Emergência Inicial',
          saldoAtualMetaBRL: primaryGoal?.current_amount ?? 0,
          valorAlvoMetaBRL: primaryGoal?.target_amount ?? 3000,
          saldoCaixaDisponivelNoMesBRL: metrics.cashFlowBalance,
        },
        estimates: {
          aporteMensalSugeridoBRL: suggestedContribution,
        },
      },
      estimatedFinancialImpact: suggestedContribution,
      isImpactEstimate: true,
      suggestedAction: `Programar a separação de ${formatCurrencyBRL(suggestedContribution)} logo após o recebimento da renda principal, registrando o aporte no módulo de Metas Financeiras (sempre priorizando liquidez e segurança, sem assumir riscos especulativos).`,
      timeframeOrFrequency: 'Mensal (no dia do recebimento da renda)',
      confidenceLevel: metrics.incomeReceived > 0 ? 'high' : 'medium',
      risksAndLimitations:
        'O valor estimado de aporte depende da manutenção das receitas e do controle das despesas variáveis do período. Nenhuma projeção constitui promessa de rentabilidade.',
      evaluationMethod:
        'Verificar o aumento do saldo acumulado na tela de Metas Financeiras e a manutenção da taxa de poupança mensal.',
      requiresProfessionalReview: false,
    };

    validateAdvisorSafetyConstraints(draft);
    recommendations.push(draft);
  }

  return recommendations;
}
