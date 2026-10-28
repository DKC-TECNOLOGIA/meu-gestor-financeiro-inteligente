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
