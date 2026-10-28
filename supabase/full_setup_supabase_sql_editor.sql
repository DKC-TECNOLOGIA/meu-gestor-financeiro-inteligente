-- ============================================================================
-- MIGRATION 001: INITIAL SCHEMA — FINANCEIRO INTELIGENTE
-- Idioma: pt-BR | Moeda: BRL (R$) | Fuso Horário: America/Bahia
-- Precisão Monetária: NUMERIC(15, 2) e NUMERIC(15, 4) para preços unitários
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Schema privado para dados que JAMAIS devem ser expostos via PostgREST ao cliente
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ============================================================================
-- ENUMS E DOMÍNIOS DE INTEGRIDADE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_objective_type') THEN
    CREATE TYPE public.financial_objective_type AS ENUM (
      'exit_debt',
      'stop_overdraft',
      'emergency_fund',
      'monthly_savings',
      'start_investing',
      'buy_house',
      'buy_vehicle',
      'family_budget',
      'reduce_unnecessary_expenses',
      'custom'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'income_frequency_type') THEN
    CREATE TYPE public.income_frequency_type AS ENUM (
      'monthly',
      'biweekly',
      'weekly',
      'variable'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_profile_type') THEN
    CREATE TYPE public.tracking_profile_type AS ENUM (
      'essential',
      'balanced',
      'detailed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_kind_type') THEN
    CREATE TYPE public.category_kind_type AS ENUM (
      'income',
      'expense',
      'transfer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_kind_type') THEN
    CREATE TYPE public.account_kind_type AS ENUM (
      'checking',
      'savings',
      'wallet',
      'investment',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_type') THEN
    CREATE TYPE public.invoice_status_type AS ENUM (
      'open',
      'closed',
      'paid',
      'overdue'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_kind_type') THEN
    CREATE TYPE public.transaction_kind_type AS ENUM (
      'income',
      'expense',
      'transfer',
      'invoice_payment'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE public.payment_method_type AS ENUM (
      'pix',
      'debit_card',
      'credit_card',
      'cash',
      'bank_transfer',
      'boleto',
      'automatic_debit',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status_type') THEN
    CREATE TYPE public.transaction_status_type AS ENUM (
      'planned',
      'pending',
      'paid',
      'received',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_frequency_type') THEN
    CREATE TYPE public.recurrence_frequency_type AS ENUM (
      'none',
      'weekly',
      'biweekly',
      'monthly',
      'yearly'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_origin_type') THEN
    CREATE TYPE public.transaction_origin_type AS ENUM (
      'manual',
      'receipt',
      'bank_integration',
      'file_import'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status_type') THEN
    CREATE TYPE public.goal_status_type AS ENUM (
      'active',
      'paused',
      'completed',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_source_type') THEN
    CREATE TYPE public.receipt_source_type AS ENUM (
      'qr_code',
      'xml_import',
      'assisted_manual'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status_type') THEN
    CREATE TYPE public.receipt_status_type AS ENUM (
      'pending_review',
      'confirmed',
      'failed_consulta',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'measurement_unit_type') THEN
    CREATE TYPE public.measurement_unit_type AS ENUM (
      'UN',
      'KG',
      'G',
      'L',
      'ML',
      'CX',
      'PCT',
      'FD',
      'M',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_connection_status_type') THEN
    CREATE TYPE public.bank_connection_status_type AS ENUM (
      'pending_consent',
      'active',
      'sync_error',
      'expired',
      'revoked'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gamification_level_type') THEN
    CREATE TYPE public.gamification_level_type AS ENUM (
      'iniciante',
      'consciente',
      'disciplinado',
      'estrategico'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_confidence_level_type') THEN
    CREATE TYPE public.ai_confidence_level_type AS ENUM (
      'low',
      'medium',
      'high'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_recommendation_status_type') THEN
    CREATE TYPE public.ai_recommendation_status_type AS ENUM (
      'pending',
      'accepted',
      'rejected',
      'postponed',
      'completed'
    );
  END IF;
END $$;

-- ============================================================================
-- 1. PROFILES (Perfis e Onboarding do Usuário)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) >= 2),
  email TEXT NOT NULL,
  primary_objective public.financial_objective_type NOT NULL DEFAULT 'family_budget',
  custom_objective_description TEXT,
  monthly_net_income NUMERIC(15, 2) CHECK (monthly_net_income IS NULL OR monthly_net_income >= 0),
  income_frequency public.income_frequency_type NOT NULL DEFAULT 'monthly',
  approx_fixed_expenses NUMERIC(15, 2) CHECK (approx_fixed_expenses IS NULL OR approx_fixed_expenses >= 0),
  monthly_debt_installments NUMERIC(15, 2) CHECK (monthly_debt_installments IS NULL OR monthly_debt_installments >= 0),
  current_emergency_fund NUMERIC(15, 2) CHECK (current_emergency_fund IS NULL OR current_emergency_fund >= 0),
  tracking_profile public.tracking_profile_type NOT NULL DEFAULT 'balanced',
  tracked_category_slugs TEXT[] NOT NULL DEFAULT '{}',
  currency CHAR(3) NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  timezone TEXT NOT NULL DEFAULT 'America/Bahia',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_policy_accepted_at TIMESTAMPTZ,
  privacy_policy_version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CATEGORIES (Categorias e Subcategorias + Orçamentos Mensais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  slug TEXT,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  kind public.category_kind_type NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  color_hex CHAR(7) NOT NULL DEFAULT '#2563EB' CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  monthly_budget NUMERIC(15, 2) CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  alert_threshold_percent NUMERIC(5, 2) NOT NULL DEFAULT 80.00 CHECK (alert_threshold_percent > 0 AND alert_threshold_percent <= 100),
  is_fixed_expense_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_essential BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_system_or_user_chk CHECK (
    (is_system = TRUE AND user_id IS NULL) OR (is_system = FALSE AND user_id IS NOT NULL)
  ),
  CONSTRAINT categories_unique_user_name UNIQUE NULLS NOT DISTINCT (user_id, parent_id, name, kind)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- ============================================================================
-- 3. ACCOUNTS (Contas Bancárias e Carteiras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  institution_name TEXT,
  kind public.account_kind_type NOT NULL DEFAULT 'checking',
  initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  include_in_net_worth BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_unique_user_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- ============================================================================
-- 4. CREDIT_CARDS (Cartões de Crédito)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_payment_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  brand TEXT DEFAULT 'Mastercard',
  last_four_digits CHAR(4) CHECK (last_four_digits IS NULL OR last_four_digits ~ '^[0-9]{4}$'),
  credit_limit NUMERIC(15, 2) NOT NULL CHECK (credit_limit >= 0),
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);

-- ============================================================================
-- 5. CARD_INVOICES (Faturas de Cartão de Crédito)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.card_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL CHECK (EXTRACT(DAY FROM reference_month) = 1),
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  status public.invoice_status_type NOT NULL DEFAULT 'open',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT card_invoices_unique_card_month UNIQUE (credit_card_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_card_invoices_user_month ON public.card_invoices(user_id, reference_month);

-- ============================================================================
-- 6. TRANSACTIONS (Receitas, Despesas, Transferências e Pagamento de Fatura)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  card_invoice_id UUID REFERENCES public.card_invoices(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  kind public.transaction_kind_type NOT NULL,
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 2),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  competence_date DATE NOT NULL,
  settlement_date DATE,
  payment_method public.payment_method_type NOT NULL DEFAULT 'pix',
  status public.transaction_status_type NOT NULL DEFAULT 'paid',
  is_fixed Boolean NOT NULL DEFAULT FALSE,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_frequency public.recurrence_frequency_type NOT NULL DEFAULT 'none',
  installment_number SMALLINT CHECK (installment_number IS NULL OR installment_number >= 1),
  total_installments SMALLINT CHECK (total_installments IS NULL OR total_installments >= 1),
  recurrence_group_id UUID,
  notes TEXT,
  origin public.transaction_origin_type NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_installments_chk CHECK (
    (installment_number IS NULL AND total_installments IS NULL) OR
    (installment_number IS NOT NULL AND total_installments IS NOT NULL AND installment_number <= total_installments)
  ),
  CONSTRAINT transactions_transfer_accounts_chk CHECK (
    kind <> 'transfer' OR (account_id IS NOT NULL AND destination_account_id IS NOT NULL AND account_id <> destination_account_id)
  ),
  CONSTRAINT transactions_external_id_unique UNIQUE (user_id, origin, external_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_competence ON public.transactions(user_id, competence_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_settlement ON public.transactions(user_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_invoice ON public.transactions(card_invoice_id);

-- ============================================================================
-- 7. FINANCIAL_GOALS (Metas Financeiras)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  objective_type public.financial_objective_type NOT NULL DEFAULT 'custom',
  target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  monthly_contribution_target NUMERIC(15, 2) CHECK (monthly_contribution_target IS NULL OR monthly_contribution_target >= 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  status public.goal_status_type NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON public.financial_goals(user_id, status);

-- ============================================================================
-- 8. GOALS_PROGRESS (Evolução e Aportes nas Metas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.goals_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  contribution_amount NUMERIC(15, 2) NOT NULL CHECK (contribution_amount <> 0),
  balance_after NUMERIC(15, 2) NOT NULL CHECK (balance_after >= 0),
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_progress_goal_id ON public.goals_progress(goal_id, recorded_at DESC);

-- ============================================================================
-- 9. RECEIPTS (Notas Fiscais de Consumidor — NFC-e)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  access_key CHAR(44) CHECK (access_key IS NULL OR access_key ~ '^[0-9]{44}$'),
  receipt_number TEXT,
  series TEXT,
  issuer_uf CHAR(2) NOT NULL DEFAULT 'BA',
  merchant_name TEXT NOT NULL CHECK (char_length(trim(merchant_name)) >= 2),
  merchant_Trade_name TEXT,
  merchant_cnpj VARCHAR(14) CHECK (merchant_cnpj IS NULL OR merchant_cnpj ~ '^[0-9]{14}$'),
  issued_at TIMESTAMPTZ NOT NULL,
  total_gross_amount NUMERIC(15, 2) NOT NULL CHECK (total_gross_amount >= 0),
  total_discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_discount_amount >= 0),
  total_paid_amount NUMERIC(15, 2) NOT NULL CHECK (total_paid_amount >= 0),
  source_type public.receipt_source_type NOT NULL DEFAULT 'qr_code',
  qr_code_raw_url TEXT,
  status public.receipt_status_type NOT NULL DEFAULT 'pending_review',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT receipts_unique_user_access_key UNIQUE (user_id, access_key)
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_issued_at ON public.receipts(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_cnpj ON public.receipts(user_id, merchant_cnpj);

-- ============================================================================
-- 10. PRODUCT_CATALOG (Catálogo Normalizado de Produtos para Comparação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  equivalent_group_id UUID,
  original_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL CHECK (char_length(trim(normalized_name)) >= 2),
  brand TEXT,
  ean_barcode VARCHAR(14) CHECK (ean_barcode IS NULL OR ean_barcode ~ '^[0-9]{8,14}$'),
  measurement_unit public.measurement_unit_type NOT NULL DEFAULT 'UN',
  package_quantity NUMERIC(15, 4) NOT NULL DEFAULT 1.0000 CHECK (package_quantity > 0),
  last_observed_price NUMERIC(15, 4),
  min_observed_price NUMERIC(15, 4),
  max_observed_price NUMERIC(15, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_user_norm ON public.product_catalog(user_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_product_catalog_user_ean ON public.product_catalog(user_id, ean_barcode);
CREATE INDEX IF NOT EXISTS idx_product_catalog_equiv_group ON public.product_catalog(user_id, equivalent_group_id);

-- ============================================================================
-- 11. RECEIPT_ITEMS (Itens da Nota Fiscal e Histórico de Preços)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  item_sequence SMALLINT NOT NULL DEFAULT 1 CHECK (item_sequence >= 1),
  original_product_name TEXT NOT NULL,
  normalized_product_name TEXT NOT NULL,
  brand TEXT,
  ean_barcode VARCHAR(14),
  quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
  measurement_unit public.measurement_unit_type NOT NULL DEFAULT 'UN',
  unit_gross_price NUMERIC(15, 4) NOT NULL CHECK (unit_gross_price >= 0),
  unit_discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_discount_amount >= 0),
  unit_net_price_paid NUMERIC(15, 4) NOT NULL CHECK (unit_net_price_paid >= 0),
  total_net_paid NUMERIC(15, 2) NOT NULL CHECK (total_net_paid >= 0),
  normalized_price_per_base_unit NUMERIC(15, 4) CHECK (normalized_price_per_base_unit IS NULL OR normalized_price_per_base_unit >= 0),
  normalized_base_unit public.measurement_unit_type,
  is_returned BOOLEAN NOT NULL DEFAULT FALSE,
  purchase_date DATE NOT NULL,
  merchant_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_user_product_date ON public.receipt_items(user_id, product_id, purchase_date DESC);

-- ============================================================================
-- 12. BANK_CONNECTIONS (Conexões Open Finance Brasil — Sem Segredos Expostos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('pluggy', 'belvo', 'open_finance_direct')),
  provider_item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_ispb VARCHAR(8),
  status public.bank_connection_status_type NOT NULL DEFAULT 'pending_consent',
  granted_scopes TEXT[] NOT NULL DEFAULT '{accounts,transactions,credit_cards}',
  consent_granted_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_connections_unique_provider_item UNIQUE (user_id, provider_name, provider_item_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON public.bank_connections(user_id, status);

-- Tabela PRIVADA para tokens de provedores bancários (inacessível pelo cliente)
CREATE TABLE IF NOT EXISTS private.bank_connection_secrets (
  bank_connection_id UUID PRIMARY KEY REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  webhook_signing_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. BANK_TRANSACTIONS (Transações Sincronizadas via Open Finance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  provider_transaction_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  raw_description TEXT NOT NULL,
  normalized_description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  occurred_at TIMESTAMPTZ NOT NULL,
  payment_method_hint public.payment_method_type,
  suggested_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
    reconciliation_status IN ('pending_review', 'imported', 'ignored_duplicate', 'ignored_transfer')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_transactions_unique_provider_tx UNIQUE (user_id, bank_connection_id, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_status ON public.bank_transactions(user_id, reconciliation_status, occurred_at DESC);

-- ============================================================================
-- 14. MONTHLY_SUMMARIES (Resumos Mensais Consolidados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL CHECK (EXTRACT(DAY FROM reference_month) = 1),
  total_income_received NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_expenses_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_competence_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  fixed_expenses_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  variable_expenses_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  credit_card_spend_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  debt_payments_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  period_cash_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  savings_rate_percent NUMERIC(6, 2),
  net_worth_snapshot NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_summaries_unique_user_month UNIQUE (user_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month ON public.monthly_summaries(user_id, reference_month DESC);

-- ============================================================================
-- 15. GAMIFICATION_EVENTS (Histórico Auditável de Pontuação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gamification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL CHECK (char_length(trim(rule_code)) >= 3),
  reason_description TEXT NOT NULL,
  points_delta INTEGER NOT NULL CHECK (points_delta <> 0),
  reference_month DATE,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gamification_events_unique_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gamification_events_user_date ON public.gamification_events(user_id, occurred_at DESC);

-- ============================================================================
-- 16. USER_LEVELS (Níveis de Responsabilidade Financeira)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_levels (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_level public.gamification_level_type NOT NULL DEFAULT 'iniciante',
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  active_streak_weeks INTEGER NOT NULL DEFAULT 0 CHECK (active_streak_weeks >= 0),
  months_within_budget INTEGER NOT NULL DEFAULT 0 CHECK (months_within_budget >= 0),
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 17. AI_RECOMMENDATIONS (Recomendações Estruturadas do Orientador Financeiro)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL CHECK (EXTRACT(DAY FROM reference_month) = 1),
  title TEXT NOT NULL,
  identified_situation TEXT NOT NULL,
  supporting_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_financial_impact NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  is_impact_estimate BOOLEAN NOT NULL DEFAULT TRUE,
  suggested_action TEXT NOT NULL,
  timeframe_or_frequency TEXT NOT NULL,
  confidence_level public.ai_confidence_level_type NOT NULL DEFAULT 'medium',
  risks_and_limitations TEXT NOT NULL,
  evaluation_method TEXT NOT NULL,
  requires_professional_review BOOLEAN NOT NULL DEFAULT FALSE,
  status public.ai_recommendation_status_type NOT NULL DEFAULT 'pending',
  user_feedback_notes TEXT,
  actual_measured_impact NUMERIC(15, 2),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_status ON public.ai_recommendations(user_id, status, created_at DESC);


-- ============================================================================
-- MIGRATION 002: ROW LEVEL SECURITY (RLS) POLICIES — FINANCEIRO INTELIGENTE
-- Garante isolamento estrito por usuário (auth.uid() = user_id / id)
-- ============================================================================

-- Habilitar RLS e FORÇAR RLS em todas as 17 tabelas públicas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards FORCE ROW LEVEL SECURITY;

ALTER TABLE public.card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.goals_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_summaries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.gamification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_levels FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations FORCE ROW LEVEL SECURITY;

-- Tabela privada de segredos bancários: bloquear qualquer acesso exceto service_role
ALTER TABLE private.bank_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.bank_connection_secrets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.bank_connection_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.bank_connection_secrets TO service_role;

-- ============================================================================
-- 1. PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- ============================================================================
-- 2. CATEGORIES POLICIES (Categorias do sistema são visíveis a todos os autenticados;
--    categorias personalizadas são exclusivas do usuário proprietário)
-- ============================================================================
DROP POLICY IF EXISTS categories_select_system_or_own ON public.categories;
CREATE POLICY categories_select_system_or_own ON public.categories
  FOR SELECT TO authenticated
  USING (is_system = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS categories_insert_own ON public.categories;
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (is_system = FALSE AND auth.uid() = user_id);

DROP POLICY IF EXISTS categories_update_own ON public.categories;
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING (is_system = FALSE AND auth.uid() = user_id)
  WITH CHECK (is_system = FALSE AND auth.uid() = user_id);

DROP POLICY IF EXISTS categories_delete_own ON public.categories;
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated
  USING (is_system = FALSE AND auth.uid() = user_id);

-- ============================================================================
-- 3. ACCOUNTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS accounts_select_own ON public.accounts;
CREATE POLICY accounts_select_own ON public.accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_insert_own ON public.accounts;
CREATE POLICY accounts_insert_own ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_update_own ON public.accounts;
CREATE POLICY accounts_update_own ON public.accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_delete_own ON public.accounts;
CREATE POLICY accounts_delete_own ON public.accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CREDIT_CARDS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS credit_cards_select_own ON public.credit_cards;
CREATE POLICY credit_cards_select_own ON public.credit_cards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS credit_cards_insert_own ON public.credit_cards;
CREATE POLICY credit_cards_insert_own ON public.credit_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS credit_cards_update_own ON public.credit_cards;
CREATE POLICY credit_cards_update_own ON public.credit_cards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS credit_cards_delete_own ON public.credit_cards;
CREATE POLICY credit_cards_delete_own ON public.credit_cards
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 5. CARD_INVOICES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS card_invoices_select_own ON public.card_invoices;
CREATE POLICY card_invoices_select_own ON public.card_invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS card_invoices_insert_own ON public.card_invoices;
CREATE POLICY card_invoices_insert_own ON public.card_invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS card_invoices_update_own ON public.card_invoices;
CREATE POLICY card_invoices_update_own ON public.card_invoices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS card_invoices_delete_own ON public.card_invoices;
CREATE POLICY card_invoices_delete_own ON public.card_invoices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 6. TRANSACTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS transactions_insert_own ON public.transactions;
CREATE POLICY transactions_insert_own ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS transactions_update_own ON public.transactions;
CREATE POLICY transactions_update_own ON public.transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS transactions_delete_own ON public.transactions;
CREATE POLICY transactions_delete_own ON public.transactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 7. FINANCIAL_GOALS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS financial_goals_select_own ON public.financial_goals;
CREATE POLICY financial_goals_select_own ON public.financial_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_goals_insert_own ON public.financial_goals;
CREATE POLICY financial_goals_insert_own ON public.financial_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_goals_update_own ON public.financial_goals;
CREATE POLICY financial_goals_update_own ON public.financial_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_goals_delete_own ON public.financial_goals;
CREATE POLICY financial_goals_delete_own ON public.financial_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 8. GOALS_PROGRESS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS goals_progress_select_own ON public.goals_progress;
CREATE POLICY goals_progress_select_own ON public.goals_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_progress_insert_own ON public.goals_progress;
CREATE POLICY goals_progress_insert_own ON public.goals_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_progress_update_own ON public.goals_progress;
CREATE POLICY goals_progress_update_own ON public.goals_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_progress_delete_own ON public.goals_progress;
CREATE POLICY goals_progress_delete_own ON public.goals_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 9. RECEIPTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS receipts_select_own ON public.receipts;
CREATE POLICY receipts_select_own ON public.receipts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS receipts_insert_own ON public.receipts;
CREATE POLICY receipts_insert_own ON public.receipts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS receipts_update_own ON public.receipts;
CREATE POLICY receipts_update_own ON public.receipts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS receipts_delete_own ON public.receipts;
CREATE POLICY receipts_delete_own ON public.receipts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 10. PRODUCT_CATALOG POLICIES
-- ============================================================================
DROP POLICY IF EXISTS product_catalog_select_own ON public.product_catalog;
CREATE POLICY product_catalog_select_own ON public.product_catalog
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS product_catalog_insert_own ON public.product_catalog;
CREATE POLICY product_catalog_insert_own ON public.product_catalog
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS product_catalog_update_own ON public.product_catalog;
CREATE POLICY product_catalog_update_own ON public.product_catalog
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS product_catalog_delete_own ON public.product_catalog;
CREATE POLICY product_catalog_delete_own ON public.product_catalog
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 11. RECEIPT_ITEMS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS receipt_items_select_own ON public.receipt_items;
CREATE POLICY receipt_items_select_own ON public.receipt_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS receipt_items_insert_own ON public.receipt_items;
CREATE POLICY receipt_items_insert_own ON public.receipt_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS receipt_items_update_own ON public.receipt_items;
CREATE POLICY receipt_items_update_own ON public.receipt_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS receipt_items_delete_own ON public.receipt_items;
CREATE POLICY receipt_items_delete_own ON public.receipt_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 12. BANK_CONNECTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS bank_connections_select_own ON public.bank_connections;
CREATE POLICY bank_connections_select_own ON public.bank_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_connections_insert_own ON public.bank_connections;
CREATE POLICY bank_connections_insert_own ON public.bank_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_connections_update_own ON public.bank_connections;
CREATE POLICY bank_connections_update_own ON public.bank_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_connections_delete_own ON public.bank_connections;
CREATE POLICY bank_connections_delete_own ON public.bank_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 13. BANK_TRANSACTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS bank_transactions_select_own ON public.bank_transactions;
CREATE POLICY bank_transactions_select_own ON public.bank_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_transactions_update_own ON public.bank_transactions;
CREATE POLICY bank_transactions_update_own ON public.bank_transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 14. MONTHLY_SUMMARIES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS monthly_summaries_select_own ON public.monthly_summaries;
CREATE POLICY monthly_summaries_select_own ON public.monthly_summaries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS monthly_summaries_insert_own ON public.monthly_summaries;
CREATE POLICY monthly_summaries_insert_own ON public.monthly_summaries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS monthly_summaries_update_own ON public.monthly_summaries;
CREATE POLICY monthly_summaries_update_own ON public.monthly_summaries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 15. GAMIFICATION_EVENTS POLICIES (IMUTÁVEL / SOMENTE LEITURA PELO CLIENTE)
-- Requisito Seção 12: "Impedir duplicação, manipulação de pontuação e alterações
-- arbitrárias no histórico." A concessão de pontos ocorre via função SECURITY DEFINER
-- auditada ou Edge Function, nunca por UPDATE/DELETE direto do cliente.
-- ============================================================================
DROP POLICY IF EXISTS gamification_events_select_own ON public.gamification_events;
CREATE POLICY gamification_events_select_own ON public.gamification_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 16. USER_LEVELS POLICIES (SOMENTE LEITURA DIRETA PELO CLIENTE)
-- ============================================================================
DROP POLICY IF EXISTS user_levels_select_own ON public.user_levels;
CREATE POLICY user_levels_select_own ON public.user_levels
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 17. AI_RECOMMENDATIONS POLICIES
-- O usuário pode ler suas recomendações e atualizar o status (aceitar, rejeitar,
-- adiar, concluir), mas novas recomendações são geradas pelo backend.
-- ============================================================================
DROP POLICY IF EXISTS ai_recommendations_select_own ON public.ai_recommendations;
CREATE POLICY ai_recommendations_select_own ON public.ai_recommendations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_recommendations_update_own ON public.ai_recommendations;
CREATE POLICY ai_recommendations_update_own ON public.ai_recommendations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


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

