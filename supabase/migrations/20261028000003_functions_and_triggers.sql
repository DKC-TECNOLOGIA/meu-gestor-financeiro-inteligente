-- ============================================================================
-- MIGRATION 003: FUNCTIONS, TRIGGERS, DETERMINISTIC CALCULATIONS & SEED DATA
-- ============================================================================

-- 1. Trigger universal para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles',
    'categories',
    'accounts',
    'credit_cards',
    'card_invoices',
    'transactions',
    'financial_goals',
    'receipts',
    'product_catalog',
    'bank_connections',
    'user_levels',
    'ai_recommendations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- 2. SEED DAS 19 CATEGORIAS INICIAIS DO SISTEMA (Seção 5)
-- ============================================================================
INSERT INTO public.categories (
  user_id, slug, name, kind, icon, color_hex, is_fixed_expense_default, is_essential, is_system
)
VALUES
  (NULL, 'moradia', 'Moradia', 'expense', 'home', '#1E40AF', TRUE, TRUE, TRUE),
  (NULL, 'alimentacao', 'Alimentação', 'expense', 'utensils', '#EA580C', FALSE, TRUE, TRUE),
  (NULL, 'supermercado', 'Supermercado', 'expense', 'shopping-cart', '#16A34A', FALSE, TRUE, TRUE),
  (NULL, 'almoco-refeicoes-fora', 'Almoço e refeições fora de casa', 'expense', 'coffee', '#D97706', FALSE, FALSE, TRUE),
  (NULL, 'transporte', 'Transporte', 'expense', 'bus', '#2563EB', FALSE, TRUE, TRUE),
  (NULL, 'combustivel', 'Combustível', 'expense', 'fuel', '#4F46E5', FALSE, TRUE, TRUE),
  (NULL, 'saude', 'Saúde', 'expense', 'heart-pulse', '#DC2626', FALSE, TRUE, TRUE),
  (NULL, 'educacao', 'Educação', 'expense', 'graduation-cap', '#7C3AED', TRUE, TRUE, TRUE),
  (NULL, 'lazer', 'Lazer', 'expense', 'smile', '#EC4899', FALSE, FALSE, TRUE),
  (NULL, 'assinaturas', 'Assinaturas', 'expense', 'tv', '#9333EA', TRUE, FALSE, TRUE),
  (NULL, 'cartao-de-credito', 'Cartão de crédito', 'expense', 'credit-card', '#475569', FALSE, FALSE, TRUE),
  (NULL, 'emprestimos-e-dividas', 'Empréstimos e dívidas', 'expense', 'landmark', '#B91C1C', TRUE, TRUE, TRUE),
  (NULL, 'investimentos', 'Investimentos', 'transfer', 'trending-up', '#059669', FALSE, FALSE, TRUE),
  (NULL, 'impostos', 'Impostos', 'expense', 'file-text', '#64748B', FALSE, TRUE, TRUE),
  (NULL, 'compras-pessoais', 'Compras pessoais', 'expense', 'shopping-bag', '#DB2777', FALSE, FALSE, TRUE),
  (NULL, 'receitas-salariais', 'Receitas salariais', 'income', 'briefcase', '#15803D', TRUE, TRUE, TRUE),
  (NULL, 'renda-extra', 'Renda extra', 'income', 'plus-circle', '#0D9488', FALSE, FALSE, TRUE),
  (NULL, 'outras-receitas', 'Outras receitas', 'income', 'arrow-down-left', '#10B981', FALSE, FALSE, TRUE),
  (NULL, 'outras-despesas', 'Outras despesas', 'expense', 'arrow-up-right', '#6B7280', FALSE, FALSE, TRUE)
ON CONFLICT (user_id, parent_id, name, kind) DO NOTHING;

-- ============================================================================
-- 3. FUNÇÃO DETERMINÍSTICA DE CONSOLIDAÇÃO MENSAL (Seção 8 e Seção 11)
-- Diferencia:
-- - Fluxo de caixa (receitas recebidas vs despesas pagas + faturas pagas no mês)
-- - Competência (compras realizadas no mês, incluindo cartão de crédito, sem dupla contagem da fatura)
-- - Ignora transferências entre contas próprias no resultado de receitas/despesas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_monthly_summary(
  p_user_id UUID,
  p_reference_month DATE
)
RETURNS public.monthly_summaries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start DATE := date_trunc('month', p_reference_month)::DATE;
  v_month_end DATE := (date_trunc('month', p_reference_month) + INTERVAL '1 month - 1 day')::DATE;
  v_income_received NUMERIC(15, 2) := 0;
  v_expenses_paid NUMERIC(15, 2) := 0;
  v_competence_expenses NUMERIC(15, 2) := 0;
  v_fixed_expenses NUMERIC(15, 2) := 0;
  v_variable_expenses NUMERIC(15, 2) := 0;
  v_card_spend NUMERIC(15, 2) := 0;
  v_debt_payments NUMERIC(15, 2) := 0;
  v_net_worth NUMERIC(15, 2) := 0;
  v_savings_rate NUMERIC(6, 2) := NULL;
  v_summary public.monthly_summaries;
BEGIN
  -- Garantir que o usuário autenticado só recalcule seus próprios dados (quando chamado via RPC)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido recalcular resumo de outro usuário.';
  END IF;

  -- 1. Receitas efetivamente recebidas no período (Fluxo de Caixa)
  SELECT COALESCE(SUM(t.amount), 0.00)
  INTO v_income_received
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.kind = 'income'
    AND t.status = 'received'
    AND COALESCE(t.settlement_date, t.competence_date) BETWEEN v_month_start AND v_month_end;

  -- 2. Despesas pagas no período (Fluxo de Caixa: despesas à vista/débito/pix pagas + pagamentos de fatura)
  --    Compras individuais no cartão de crédito não saem do caixa no dia da compra, mas no pagamento da fatura.
  SELECT COALESCE(SUM(t.amount), 0.00)
  INTO v_expenses_paid
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND (
      (t.kind = 'expense' AND t.payment_method <> 'credit_card' AND t.status = 'paid')
      OR (t.kind = 'invoice_payment' AND t.status = 'paid')
    )
    AND COALESCE(t.settlement_date, t.competence_date) BETWEEN v_month_start AND v_month_end;

  -- 3. Despesas por competência (inclui compras no cartão de crédito feitas no mês; EXCLUI pagamento de fatura e transferências)
  SELECT
    COALESCE(SUM(t.amount), 0.00),
    COALESCE(SUM(CASE WHEN t.is_fixed THEN t.amount ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN NOT t.is_fixed THEN t.amount ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN t.payment_method = 'credit_card' THEN t.amount ELSE 0 END), 0.00)
  INTO
    v_competence_expenses,
    v_fixed_expenses,
    v_variable_expenses,
    v_card_spend
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.kind = 'expense'
    AND t.status <> 'canceled'
    AND t.competence_date BETWEEN v_month_start AND v_month_end;

  -- 4. Pagamentos de empréstimos e dívidas na competência
  SELECT COALESCE(SUM(t.amount), 0.00)
  INTO v_debt_payments
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.kind = 'expense'
    AND t.status <> 'canceled'
    AND c.slug = 'emprestimos-e-dividas'
    AND t.competence_date BETWEEN v_month_start AND v_month_end;

  -- 5. Patrimônio líquido nas contas ativas
  SELECT COALESCE(SUM(a.current_balance), 0.00)
  INTO v_net_worth
  FROM public.accounts a
  WHERE a.user_id = p_user_id
    AND a.is_archived = FALSE
    AND a.include_in_net_worth = TRUE;

  -- 6. Taxa de poupança (apenas quando houver receita positiva recebida no período)
  IF v_income_received > 0 THEN
    v_savings_rate := ROUND(((v_income_received - v_expenses_paid) / v_income_received) * 100.0, 2);
  END IF;

  INSERT INTO public.monthly_summaries (
    user_id,
    reference_month,
    total_income_received,
    total_expenses_paid,
    total_competence_expenses,
    fixed_expenses_total,
    variable_expenses_total,
    credit_card_spend_total,
    debt_payments_total,
    period_cash_balance,
    savings_rate_percent,
    net_worth_snapshot,
    calculated_at
  )
  VALUES (
    p_user_id,
    v_month_start,
    v_income_received,
    v_expenses_paid,
    v_competence_expenses,
    v_fixed_expenses,
    v_variable_expenses,
    v_card_spend,
    v_debt_payments,
    (v_income_received - v_expenses_paid),
    v_savings_rate,
    v_net_worth,
    NOW()
  )
  ON CONFLICT (user_id, reference_month) DO UPDATE
  SET
    total_income_received = EXCLUDED.total_income_received,
    total_expenses_paid = EXCLUDED.total_expenses_paid,
    total_competence_expenses = EXCLUDED.total_competence_expenses,
    fixed_expenses_total = EXCLUDED.fixed_expenses_total,
    variable_expenses_total = EXCLUDED.variable_expenses_total,
    credit_card_spend_total = EXCLUDED.credit_card_spend_total,
    debt_payments_total = EXCLUDED.debt_payments_total,
    period_cash_balance = EXCLUDED.period_cash_balance,
    savings_rate_percent = EXCLUDED.savings_rate_percent,
    net_worth_snapshot = EXCLUDED.net_worth_snapshot,
    calculated_at = NOW()
  RETURNING * INTO v_summary;

  RETURN v_summary;
END;
$$;

-- ============================================================================
-- 4. FUNÇÃO AUDITADA DE GAMIFICAÇÃO (Seção 12)
-- Registra evento com idempotency_key e recalcula nível sem permitir manipulação
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_gamification_event(
  p_user_id UUID,
  p_rule_code TEXT,
  p_reason_description TEXT,
  p_points_delta INTEGER,
  p_idempotency_key TEXT,
  p_reference_month DATE DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.user_levels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_points INTEGER;
  v_new_level public.gamification_level_type;
  v_user_level public.user_levels;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido registrar pontuação para outro usuário.';
  END IF;

  INSERT INTO public.gamification_events (
    user_id,
    rule_code,
    reason_description,
    points_delta,
    reference_month,
    idempotency_key,
    metadata
  )
  VALUES (
    p_user_id,
    p_rule_code,
    p_reason_description,
    p_points_delta,
    p_reference_month,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  SELECT GREATEST(COALESCE(SUM(points_delta), 0), 0)
  INTO v_total_points
  FROM public.gamification_events
  WHERE user_id = p_user_id;

  -- Níveis baseados em consistência e evolução pessoal (Seção 12):
  -- 0..199     -> iniciante
  -- 200..599   -> consciente
  -- 600..1499  -> disciplinado
  -- >= 1500    -> estrategico
  v_new_level := CASE
    WHEN v_total_points >= 1500 THEN 'estrategico'::public.gamification_level_type
    WHEN v_total_points >= 600 THEN 'disciplinado'::public.gamification_level_type
    WHEN v_total_points >= 200 THEN 'consciente'::public.gamification_level_type
    ELSE 'iniciante'::public.gamification_level_type
  END;

  INSERT INTO public.user_levels (
    user_id,
    current_level,
    total_points,
    last_evaluated_at
  )
  VALUES (
    p_user_id,
    v_new_level,
    v_total_points,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_level = EXCLUDED.current_level,
    total_points = EXCLUDED.total_points,
    last_evaluated_at = NOW()
  RETURNING * INTO v_user_level;

  RETURN v_user_level;
END;
$$;
