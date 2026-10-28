/**
 * Tipagem estrita espelhando as 17 tabelas e Enums do PostgreSQL (Supabase).
 * Moeda padrão: BRL | Fuso horário padrão: America/Bahia
 */

export type FinancialObjectiveType =
  | 'exit_debt'
  | 'stop_overdraft'
  | 'emergency_fund'
  | 'monthly_savings'
  | 'start_investing'
  | 'buy_house'
  | 'buy_vehicle'
  | 'family_budget'
  | 'reduce_unnecessary_expenses'
  | 'custom';

export type IncomeFrequencyType = 'monthly' | 'biweekly' | 'weekly' | 'variable';

export type TrackingProfileType = 'essential' | 'balanced' | 'detailed';

export type CategoryKindType = 'income' | 'expense' | 'transfer';

export type AccountKindType = 'checking' | 'savings' | 'wallet' | 'investment' | 'other';

export type InvoiceStatusType = 'open' | 'closed' | 'paid' | 'overdue';

export type TransactionKindType = 'income' | 'expense' | 'transfer' | 'invoice_payment';

export type PaymentMethodType =
  | 'pix'
  | 'debit_card'
  | 'credit_card'
  | 'cash'
  | 'bank_transfer'
  | 'boleto'
  | 'automatic_debit'
  | 'other';

export type TransactionStatusType =
  | 'planned'
  | 'pending'
  | 'paid'
  | 'received'
  | 'canceled';

export type RecurrenceFrequencyType =
  | 'none'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

export type TransactionOriginType =
  | 'manual'
  | 'receipt'
  | 'bank_integration'
  | 'file_import';

export type GoalStatusType = 'active' | 'paused' | 'completed' | 'canceled';

export type ReceiptSourceType = 'qr_code' | 'xml_import' | 'assisted_manual';

export type ReceiptStatusType =
  | 'pending_review'
  | 'confirmed'
  | 'failed_consulta'
  | 'rejected';

export type MeasurementUnitType =
  | 'UN'
  | 'KG'
  | 'G'
  | 'L'
  | 'ML'
  | 'CX'
  | 'PCT'
  | 'FD'
  | 'M'
  | 'OTHER';

export type BankConnectionStatusType =
  | 'pending_consent'
  | 'active'
  | 'sync_error'
  | 'expired'
  | 'revoked';

export type GamificationLevelType =
  | 'iniciante'
  | 'consciente'
  | 'disciplinado'
  | 'estrategico';

export type AiConfidenceLevelType = 'low' | 'medium' | 'high';

export type AiRecommendationStatusType =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'postponed'
  | 'completed';

export interface ProfileRow {
  id: string;
  display_name: string;
  email: string;
  primary_objective: FinancialObjectiveType;
  custom_objective_description: string | null;
  monthly_net_income: number | null;
  income_frequency: IncomeFrequencyType;
  approx_fixed_expenses: number | null;
  monthly_debt_installments: number | null;
  current_emergency_fund: number | null;
  tracking_profile: TrackingProfileType;
  tracked_category_slugs: string[];
  currency: 'BRL';
  timezone: string;
  onboarding_completed: boolean;
  privacy_policy_accepted_at: string | null;
  privacy_policy_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  slug: string | null;
  name: string;
  kind: CategoryKindType;
  icon: string;
  color_hex: string;
  monthly_budget: number | null;
  alert_threshold_percent: number;
  is_fixed_expense_default: boolean;
  is_essential: boolean;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  institution_name: string | null;
  kind: AccountKindType;
  initial_balance: number;
  current_balance: number;
  include_in_net_worth: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditCardRow {
  id: string;
  user_id: string;
  default_payment_account_id: string | null;
  name: string;
  brand: string | null;
  last_four_digits: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CardInvoiceRow {
  id: string;
  user_id: string;
  credit_card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatusType;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string | null;
  destination_account_id: string | null;
  credit_card_id: string | null;
  card_invoice_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  kind: TransactionKindType;
  description: string;
  amount: number;
  competence_date: string;
  settlement_date: string | null;
  payment_method: PaymentMethodType;
  status: TransactionStatusType;
  is_fixed: boolean;
  is_recurring: boolean;
  recurrence_frequency: RecurrenceFrequencyType;
  installment_number: number | null;
  total_installments: number | null;
  recurrence_group_id: string | null;
  notes: string | null;
  origin: TransactionOriginType;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoalRow {
  id: string;
  user_id: string;
  linked_account_id: string | null;
  name: string;
  objective_type: FinancialObjectiveType;
  target_amount: number;
  current_amount: number;
  monthly_contribution_target: number | null;
  start_date: string;
  target_date: string | null;
  priority: number;
  status: GoalStatusType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressRow {
  id: string;
  user_id: string;
  goal_id: string;
  transaction_id: string | null;
  contribution_amount: number;
  balance_after: number;
  recorded_at: string;
  notes: string | null;
  created_at: string;
}

export interface ReceiptRow {
  id: string;
  user_id: string;
  transaction_id: string | null;
  access_key: string | null;
  receipt_number: string | null;
  series: string | null;
  issuer_uf: string;
  merchant_name: string;
  merchant_trade_name: string | null;
  merchant_cnpj: string | null;
  issued_at: string;
  total_gross_amount: number;
  total_discount_amount: number;
  total_paid_amount: number;
  source_type: ReceiptSourceType;
  qr_code_raw_url: string | null;
  status: ReceiptStatusType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalogRow {
  id: string;
  user_id: string;
  category_id: string | null;
  equivalent_group_id: string | null;
  original_name: string;
  normalized_name: string;
  brand: string | null;
  ean_barcode: string | null;
  measurement_unit: MeasurementUnitType;
  package_quantity: number;
  last_observed_price: number | null;
  min_observed_price: number | null;
  max_observed_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItemRow {
  id: string;
  user_id: string;
  receipt_id: string;
  product_id: string | null;
  item_sequence: number;
  original_product_name: string;
  normalized_product_name: string;
  brand: string | null;
  ean_barcode: string | null;
  quantity: number;
  measurement_unit: MeasurementUnitType;
  unit_gross_price: number;
  unit_discount_amount: number;
  unit_net_price_paid: number;
  total_net_paid: number;
  normalized_price_per_base_unit: number | null;
  normalized_base_unit: MeasurementUnitType | null;
  is_returned: boolean;
  purchase_date: string;
  merchant_name: string;
  created_at: string;
}

export interface BankConnectionRow {
  id: string;
  user_id: string;
  provider_name: 'pluggy' | 'belvo' | 'open_finance_direct';
  provider_item_id: string;
  institution_name: string;
  institution_ispb: string | null;
  status: BankConnectionStatusType;
  granted_scopes: string[];
  consent_granted_at: string | null;
  consent_expires_at: string | null;
  revoked_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransactionRow {
  id: string;
  user_id: string;
  bank_connection_id: string;
  linked_transaction_id: string | null;
  provider_transaction_id: string;
  provider_account_id: string;
  raw_description: string;
  normalized_description: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  occurred_at: string;
  payment_method_hint: PaymentMethodType | null;
  suggested_category_id: string | null;
  reconciliation_status:
    | 'pending_review'
    | 'imported'
    | 'ignored_duplicate'
    | 'ignored_transfer';
  created_at: string;
}

export interface MonthlySummaryRow {
  id: string;
  user_id: string;
  reference_month: string;
  total_income_received: number;
  total_expenses_paid: number;
  total_competence_expenses: number;
  fixed_expenses_total: number;
  variable_expenses_total: number;
  credit_card_spend_total: number;
  debt_payments_total: number;
  period_cash_balance: number;
  savings_rate_percent: number | null;
  net_worth_snapshot: number;
  calculated_at: string;
}

export interface GamificationEventRow {
  id: string;
  user_id: string;
  rule_code: string;
  reason_description: string;
  points_delta: number;
  reference_month: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface UserLevelRow {
  user_id: string;
  current_level: GamificationLevelType;
  total_points: number;
  active_streak_weeks: number;
  months_within_budget: number;
  last_evaluated_at: string;
  updated_at: string;
}

export interface AiRecommendationRow {
  id: string;
  user_id: string;
  reference_month: string;
  title: string;
  identified_situation: string;
  supporting_data: Record<string, unknown>;
  estimated_financial_impact: number;
  is_impact_estimate: boolean;
  suggested_action: string;
  timeframe_or_frequency: string;
  confidence_level: AiConfidenceLevelType;
  risks_and_limitations: string;
  evaluation_method: string;
  requires_professional_review: boolean;
  status: AiRecommendationStatusType;
  user_feedback_notes: string | null;
  actual_measured_impact: number | null;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
