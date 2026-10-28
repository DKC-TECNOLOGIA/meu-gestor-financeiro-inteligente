import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { APP_CURRENCY, APP_TIMEZONE, INITIAL_SYSTEM_CATEGORIES } from '@/config/constants';
import {
  generateDeterministicAdvisorRecommendations,
  validateAdvisorSafetyConstraints,
} from '@/domain/advisor/financial-advisor';
import {
  CategoryInput,
  categoryInputSchema,
  OnboardingInput,
  onboardingInputSchema,
  TransactionInput,
  transactionInputSchema,
} from '@/domain/finance/validators';
import {
  evaluateMonthlyGamificationEvents,
  resolveGamificationLevel,
} from '@/domain/gamification/gamification-engine';
import { computeNormalizedBaseUnitPrice } from '@/domain/price-comparison/price-analyzer';
import {
  normalizeProductName,
  ParsedReceiptDraft,
} from '@/domain/receipts/nfce-parser';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  AccountRow,
  AiRecommendationRow,
  AiRecommendationStatusType,
  CardInvoiceRow,
  CategoryRow,
  CreditCardRow,
  FinancialGoalRow,
  FinancialObjectiveType,
  GamificationEventRow,
  GoalProgressRow,
  ProductCatalogRow,
  ProfileRow,
  ReceiptItemRow,
  ReceiptRow,
  TransactionRow,
  UserLevelRow,
} from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';

const LOCAL_STORAGE_KEY = '@financeiro_inteligente:mvp_state_v1';

function buildDefaultSystemCategories(): CategoryRow[] {
  const now = new Date().toISOString();
  return INITIAL_SYSTEM_CATEGORIES.map((cat, idx) => ({
    id: `sys-cat-${idx + 1}-${cat.slug}`,
    user_id: null,
    parent_id: null,
    slug: cat.slug,
    name: cat.name,
    kind: cat.kind,
    icon: cat.icon,
    color_hex: cat.colorHex,
    monthly_budget: null,
    alert_threshold_percent: 80,
    is_fixed_expense_default: cat.isFixedExpenseDefault,
    is_essential: cat.isEssential,
    is_system: true,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
}

function buildDefaultAccounts(userId: string): AccountRow[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'acc-principal',
      user_id: userId,
      name: 'Conta Corrente Principal',
      institution_name: 'Banco Principal',
      kind: 'checking',
      initial_balance: 0,
      current_balance: 0,
      include_in_net_worth: true,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'acc-reserva',
      user_id: userId,
      name: 'Reserva de Emergência',
      institution_name: 'Conta Rendimento',
      kind: 'savings',
      initial_balance: 0,
      current_balance: 0,
      include_in_net_worth: true,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
  ];
}

function buildDefaultCreditCards(userId: string): CreditCardRow[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'card-principal',
      user_id: userId,
      default_payment_account_id: 'acc-principal',
      name: 'Cartão Principal',
      brand: 'Mastercard',
      last_four_digits: '4321',
      credit_limit: 5000,
      closing_day: 5,
      due_day: 12,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
  ];
}

function buildDefaultUserLevel(userId: string): UserLevelRow {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    current_level: 'iniciante',
    total_points: 0,
    active_streak_weeks: 0,
    months_within_budget: 0,
    last_evaluated_at: now,
    updated_at: now,
  };
}

export interface CreateFinancialGoalInput {
  name: string;
  objectiveType: FinancialObjectiveType;
  targetAmount: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
  priority?: number;
  notes?: string | null;
}

export interface FinanceFilterState {
  referenceYearMonth: string; // 'YYYY-MM'
  selectedAccountId: string | null;
  selectedCategoryId: string | null;
}

export interface FinanceStoreState {
  isHydrated: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  currentUserId: string;
  profile: ProfileRow | null;
  categories: CategoryRow[];
  accounts: AccountRow[];
  creditCards: CreditCardRow[];
  cardInvoices: CardInvoiceRow[];
  transactions: TransactionRow[];
  receipts: ReceiptRow[];
  receiptItems: ReceiptItemRow[];
  productCatalog: ProductCatalogRow[];
  financialGoals: FinancialGoalRow[];
  goalsProgress: GoalProgressRow[];
  gamificationEvents: GamificationEventRow[];
  userLevel: UserLevelRow;
  aiRecommendations: AiRecommendationRow[];
  pendingReceiptDraft: ParsedReceiptDraft | null;
  filters: FinanceFilterState;

  // Actions
  hydrate: () => Promise<void>;
  clearError: () => void;
  setReferenceYearMonth: (yearMonth: string) => void;
  setSelectedAccountFilter: (accountId: string | null) => void;
  setSelectedCategoryFilter: (categoryId: string | null) => void;

  // Auth & Onboarding (Seção 4)
  completeOnboardingAndSaveProfile: (input: OnboardingInput) => Promise<ProfileRow>;

  // Categorias e Orçamentos (Seção 5)
  createCustomCategory: (input: CategoryInput) => Promise<CategoryRow>;
  updateCategoryBudget: (
    categoryId: string,
    monthlyBudget: number | null,
    alertThresholdPercent?: number,
  ) => Promise<CategoryRow>;

  // Receitas, Despesas, Cartões e Transferências (Seção 5)
  createTransaction: (input: TransactionInput) => Promise<TransactionRow>;
  updateTransaction: (
    transactionId: string,
    input: TransactionInput,
  ) => Promise<TransactionRow>;
  deleteTransaction: (transactionId: string) => Promise<void>;

  // Notas Fiscais e Catálogo de Preços (Seção 6 e Seção 7)
  setPendingReceiptDraft: (draft: ParsedReceiptDraft | null) => void;
  confirmAndSaveReceipt: (draft: ParsedReceiptDraft) => Promise<{
    receipt: ReceiptRow;
    items: ReceiptItemRow[];
    transaction: TransactionRow;
  }>;
  linkEquivalentProducts: (
    productIds: readonly string[],
    groupId?: string,
  ) => Promise<string>;

  // Metas Financeiras (Seção 2 e Seção 12)
  createFinancialGoal: (input: CreateFinancialGoalInput) => Promise<FinancialGoalRow>;
  recordGoalContribution: (
    goalId: string,
    contributionAmount: number,
    notes?: string,
  ) => Promise<{ goal: FinancialGoalRow; progress: GoalProgressRow }>;

  // Gamificação Auditável (Seção 12)
  recordAuditGamificationEvent: (params: {
    ruleCode: string;
    reasonDescription: string;
    pointsDelta: number;
    idempotencyKey: string;
    referenceMonth?: string | null;
    metadata?: Record<string, unknown>;
  }) => Promise<UserLevelRow>;
  evaluateCurrentMonthGamification: () => Promise<UserLevelRow>;

  // Orientador Financeiro por IA (Seção 11)
  generateAdvisorRecommendationsForMonth: (
    referenceYearMonth?: string,
  ) => Promise<AiRecommendationRow[]>;
  updateAdvisorRecommendationStatus: (
    recommendationId: string,
    status: AiRecommendationStatusType,
    actualMeasuredImpact?: number | null,
    userFeedbackNotes?: string | null,
  ) => Promise<AiRecommendationRow>;
}

function getCurrentYearMonthBahia(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '10';
  return `${year}-${month}`;
}

function getPreviousYearMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0] ?? 2026);
  const month = Number(parts[1] ?? 10);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export const useFinanceStore = create<FinanceStoreState>((set, get) => {
  const persistLocalSnapshot = async () => {
    const state = get();
    try {
      await AsyncStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          currentUserId: state.currentUserId,
          profile: state.profile,
          categories: state.categories,
          accounts: state.accounts,
          creditCards: state.creditCards,
          cardInvoices: state.cardInvoices,
          transactions: state.transactions,
          receipts: state.receipts,
          receiptItems: state.receiptItems,
          productCatalog: state.productCatalog,
          financialGoals: state.financialGoals,
          goalsProgress: state.goalsProgress,
          gamificationEvents: state.gamificationEvents,
          userLevel: state.userLevel,
          aiRecommendations: state.aiRecommendations,
        }),
      );
    } catch {
      // Silencioso em ambientes de teste sem storage nativo
    }
  };

  const recalculateAccountBalances = (
    accounts: AccountRow[],
    transactions: TransactionRow[],
  ): AccountRow[] => {
    return accounts.map((acc) => {
      let balanceCents = toCents(acc.initial_balance);
      for (const tx of transactions) {
        if (tx.status === 'canceled') continue;
        const amtCents = toCents(tx.amount);
        if (tx.kind === 'income' && tx.status === 'received' && tx.account_id === acc.id) {
          balanceCents += amtCents;
        } else if (
          tx.kind === 'expense' &&
          tx.payment_method !== 'credit_card' &&
          tx.status === 'paid' &&
          tx.account_id === acc.id
        ) {
          balanceCents -= amtCents;
        } else if (
          tx.kind === 'invoice_payment' &&
          tx.status === 'paid' &&
          tx.account_id === acc.id
        ) {
          balanceCents -= amtCents;
        } else if (tx.kind === 'transfer' && tx.status === 'paid') {
          if (tx.account_id === acc.id) {
            balanceCents -= amtCents;
          }
          if (tx.destination_account_id === acc.id) {
            balanceCents += amtCents;
          }
        }
      }
      return {
        ...acc,
        current_balance: fromCents(balanceCents),
      };
    });
  };

  const defaultUserId = 'local-authenticated-user';

  return {
    isHydrated: false,
    isLoading: false,
    errorMessage: null,
    currentUserId: defaultUserId,
    profile: null,
    categories: buildDefaultSystemCategories(),
    accounts: buildDefaultAccounts(defaultUserId),
    creditCards: buildDefaultCreditCards(defaultUserId),
    cardInvoices: [],
    transactions: [],
    receipts: [],
    receiptItems: [],
    productCatalog: [],
    financialGoals: [],
    goalsProgress: [],
    gamificationEvents: [],
    userLevel: buildDefaultUserLevel(defaultUserId),
    aiRecommendations: [],
    pendingReceiptDraft: null,
    filters: {
      referenceYearMonth: getCurrentYearMonthBahia(),
      selectedAccountId: null,
      selectedCategoryId: null,
    },

    clearError: () => set({ errorMessage: null }),

    setReferenceYearMonth: (yearMonth: string) =>
      set((s) => ({
        filters: { ...s.filters, referenceYearMonth: yearMonth },
      })),

    setSelectedAccountFilter: (accountId: string | null) =>
      set((s) => ({
        filters: { ...s.filters, selectedAccountId: accountId },
      })),

    setSelectedCategoryFilter: (categoryId: string | null) =>
      set((s) => ({
        filters: { ...s.filters, selectedCategoryId: categoryId },
      })),

    setPendingReceiptDraft: (draft: ParsedReceiptDraft | null) =>
      set({ pendingReceiptDraft: draft }),

    hydrate: async () => {
      set({ isLoading: true, errorMessage: null });
      try {
        const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<FinanceStoreState>;
          set({
            currentUserId: parsed.currentUserId ?? defaultUserId,
            profile: parsed.profile ?? null,
            categories:
              parsed.categories && parsed.categories.length > 0
                ? parsed.categories
                : buildDefaultSystemCategories(),
            accounts:
              parsed.accounts && parsed.accounts.length > 0
                ? parsed.accounts
                : buildDefaultAccounts(defaultUserId),
            creditCards:
              parsed.creditCards && parsed.creditCards.length > 0
                ? parsed.creditCards
                : buildDefaultCreditCards(defaultUserId),
            cardInvoices: parsed.cardInvoices ?? [],
            transactions: parsed.transactions ?? [],
            receipts: parsed.receipts ?? [],
            receiptItems: parsed.receiptItems ?? [],
            productCatalog: parsed.productCatalog ?? [],
            financialGoals: parsed.financialGoals ?? [],
            goalsProgress: parsed.goalsProgress ?? [],
            gamificationEvents: parsed.gamificationEvents ?? [],
            userLevel: parsed.userLevel ?? buildDefaultUserLevel(defaultUserId),
            aiRecommendations: parsed.aiRecommendations ?? [],
            isHydrated: true,
            isLoading: false,
          });
          return;
        }

        if (isSupabaseConfigured) {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (uid) {
            const [{ data: profileData }, { data: catsData }, { data: txData }] =
              await Promise.all([
                supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
                supabase.from('categories').select('*').eq('is_active', true),
                supabase
                  .from('transactions')
                  .select('*')
                  .eq('user_id', uid)
                  .order('competence_date', { ascending: false }),
              ]);

            set({
              currentUserId: uid,
              profile: (profileData as ProfileRow | null) ?? null,
              categories:
                catsData && catsData.length > 0
                  ? (catsData as CategoryRow[])
                  : buildDefaultSystemCategories(),
              transactions: (txData as TransactionRow[]) ?? [],
              isHydrated: true,
              isLoading: false,
            });
            return;
          }
        }

        set({ isHydrated: true, isLoading: false });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Falha ao carregar dados locais do aplicativo.';
        set({ errorMessage: msg, isHydrated: true, isLoading: false });
      }
    },

    completeOnboardingAndSaveProfile: async (rawInput: OnboardingInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const validated = onboardingInputSchema.parse(rawInput);
        const now = new Date().toISOString();
        const userId = get().currentUserId;

        const profileRow: ProfileRow = {
          id: userId,
          display_name: validated.displayName,
          email: validated.email,
          primary_objective: validated.primaryObjective,
          custom_objective_description: validated.customObjectiveDescription ?? null,
          monthly_net_income: validated.monthlyNetIncome ?? null,
          income_frequency: validated.incomeFrequency,
          approx_fixed_expenses: validated.approxFixedExpenses ?? null,
          monthly_debt_installments: validated.monthlyDebtInstallments ?? null,
          current_emergency_fund: validated.currentEmergencyFund ?? null,
          tracking_profile: validated.trackingProfile,
          tracked_category_slugs: validated.trackedCategorySlugs,
          currency: APP_CURRENCY,
          timezone: APP_TIMEZONE,
          onboarding_completed: true,
          privacy_policy_accepted_at: now,
          privacy_policy_version: '1.0.0',
          created_at: get().profile?.created_at ?? now,
          updated_at: now,
        };

        const updatedAccounts = get().accounts.map((acc) => {
          if (acc.kind === 'savings' && validated.currentEmergencyFund != null) {
            return {
              ...acc,
              initial_balance: validated.currentEmergencyFund,
              current_balance: validated.currentEmergencyFund,
              updated_at: now,
            };
          }
          return acc;
        });

        if (isSupabaseConfigured) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user?.id) {
            await supabase.from('profiles').upsert(profileRow);
          }
        }

        set({
          profile: profileRow,
          accounts: recalculateAccountBalances(updatedAccounts, get().transactions),
          isLoading: false,
        });
        await persistLocalSnapshot();
        return profileRow;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao salvar perfil e objetivos.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    createCustomCategory: async (rawInput: CategoryInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const validated = categoryInputSchema.parse(rawInput);
        const state = get();
        const duplicate = state.categories.find(
          (c) =>
            c.kind === validated.kind &&
            c.name.toLowerCase() === validated.name.toLowerCase() &&
            c.parent_id === (validated.parentId ?? null),
        );
        if (duplicate) {
          throw new Error(`Já existe uma categoria "${validated.name}" deste tipo.`);
        }

        const now = new Date().toISOString();
        const newCat: CategoryRow = {
          id: `custom-cat-${Date.now()}`,
          user_id: state.currentUserId,
          parent_id: validated.parentId ?? null,
          slug: validated.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-'),
          name: validated.name,
          kind: validated.kind,
          icon: validated.icon,
          color_hex: validated.colorHex,
          monthly_budget: validated.monthlyBudget ?? null,
          alert_threshold_percent: validated.alertThresholdPercent,
          is_fixed_expense_default: validated.isFixedExpenseDefault,
          is_essential: validated.isEssential,
          is_system: false,
          is_active: true,
          created_at: now,
          updated_at: now,
        };

        set({
          categories: [...state.categories, newCat],
          isLoading: false,
        });
        await persistLocalSnapshot();
        return newCat;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao criar categoria personalizada.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    updateCategoryBudget: async (
      categoryId: string,
      monthlyBudget: number | null,
      alertThresholdPercent = 80,
    ) => {
      set({ isLoading: true, errorMessage: null });
      try {
        if (monthlyBudget != null && monthlyBudget < 0) {
          throw new Error('O orçamento mensal não pode ser negativo.');
        }
        if (alertThresholdPercent <= 0 || alertThresholdPercent > 100) {
          throw new Error('O percentual de alerta deve estar entre 1% e 100%.');
        }

        const state = get();
        const target = state.categories.find((c) => c.id === categoryId);
        if (!target) {
          throw new Error('Categoria não encontrada.');
        }

        const now = new Date().toISOString();
        const updatedCat: CategoryRow = {
          ...target,
          monthly_budget: monthlyBudget,
          alert_threshold_percent: alertThresholdPercent,
          updated_at: now,
        };

        set({
          categories: state.categories.map((c) => (c.id === categoryId ? updatedCat : c)),
          isLoading: false,
        });
        await persistLocalSnapshot();
        return updatedCat;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao atualizar orçamento da categoria.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    createTransaction: async (rawInput: TransactionInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const validated = transactionInputSchema.parse(rawInput);
        const state = get();

        if (validated.externalId) {
          const duplicate = state.transactions.find(
            (tx) =>
              tx.origin === validated.origin && tx.external_id === validated.externalId,
          );
          if (duplicate) {
            throw new Error(
              'Este lançamento externo já foi registrado anteriormente (duplicidade bloqueada).',
            );
          }
        }

        const now = new Date().toISOString();
        const newTx: TransactionRow = {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: state.currentUserId,
          account_id: validated.accountId ?? state.accounts[0]?.id ?? null,
          destination_account_id: validated.destinationAccountId ?? null,
          credit_card_id: validated.creditCardId ?? null,
          card_invoice_id: validated.cardInvoiceId ?? null,
          category_id: validated.categoryId ?? null,
          subcategory_id: validated.subcategoryId ?? null,
          kind: validated.kind,
          description: validated.description,
          amount: fromCents(toCents(validated.amount)),
          competence_date: validated.competenceDate,
          settlement_date:
            validated.settlementDate !== undefined
              ? validated.settlementDate
              : validated.paymentMethod === 'credit_card'
                ? null
                : validated.competenceDate,
          payment_method: validated.paymentMethod,
          status: validated.status,
          is_fixed: validated.isFixed,
          is_recurring: validated.isRecurring,
          recurrence_frequency: validated.recurrenceFrequency,
          installment_number: validated.installmentNumber ?? null,
          total_installments: validated.totalInstallments ?? null,
          recurrence_group_id: null,
          notes: validated.notes ?? null,
          origin: validated.origin,
          external_id: validated.externalId ?? null,
          created_at: now,
          updated_at: now,
        };

        const nextTransactions = [newTx, ...state.transactions];
        const nextAccounts = recalculateAccountBalances(state.accounts, nextTransactions);

        set({
          transactions: nextTransactions,
          accounts: nextAccounts,
          isLoading: false,
        });
        await persistLocalSnapshot();
        return newTx;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao registrar lançamento.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    updateTransaction: async (transactionId: string, rawInput: TransactionInput) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const validated = transactionInputSchema.parse(rawInput);
        const state = get();
        const existing = state.transactions.find((t) => t.id === transactionId);
        if (!existing) {
          throw new Error('Lançamento não encontrado.');
        }
        if (existing.user_id !== state.currentUserId) {
          throw new Error('Acesso negado: você não tem permissão para editar este item.');
        }

        const now = new Date().toISOString();
        const updatedTx: TransactionRow = {
          ...existing,
          account_id: validated.accountId ?? existing.account_id,
          destination_account_id: validated.destinationAccountId ?? null,
          credit_card_id: validated.creditCardId ?? null,
          card_invoice_id: validated.cardInvoiceId ?? null,
          category_id: validated.categoryId ?? null,
          subcategory_id: validated.subcategoryId ?? null,
          kind: validated.kind,
          description: validated.description,
          amount: fromCents(toCents(validated.amount)),
          competence_date: validated.competenceDate,
          settlement_date:
            validated.settlementDate !== undefined
              ? validated.settlementDate
              : existing.settlement_date,
          payment_method: validated.paymentMethod,
          status: validated.status,
          is_fixed: validated.isFixed,
          is_recurring: validated.isRecurring,
          recurrence_frequency: validated.recurrenceFrequency,
          installment_number: validated.installmentNumber ?? null,
          total_installments: validated.totalInstallments ?? null,
          notes: validated.notes ?? null,
          origin: validated.origin,
          external_id: validated.externalId ?? null,
          updated_at: now,
        };

        const nextTransactions = state.transactions.map((t) =>
          t.id === transactionId ? updatedTx : t,
        );
        const nextAccounts = recalculateAccountBalances(state.accounts, nextTransactions);

        set({
          transactions: nextTransactions,
          accounts: nextAccounts,
          isLoading: false,
        });
        await persistLocalSnapshot();
        return updatedTx;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao atualizar lançamento.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    deleteTransaction: async (transactionId: string) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const state = get();
        const existing = state.transactions.find((t) => t.id === transactionId);
        if (!existing) {
          throw new Error('Lançamento não encontrado.');
        }
        if (existing.user_id !== state.currentUserId) {
          throw new Error('Acesso negado: exclusão não autorizada.');
        }

        const nextTransactions = state.transactions.filter((t) => t.id !== transactionId);
        const nextAccounts = recalculateAccountBalances(state.accounts, nextTransactions);

        set({
          transactions: nextTransactions,
          accounts: nextAccounts,
          isLoading: false,
        });
        await persistLocalSnapshot();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao excluir lançamento.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    confirmAndSaveReceipt: async (draft: ParsedReceiptDraft) => {
      set({ isLoading: true, errorMessage: null });
      try {
        const state = get();

        if (draft.accessKey) {
          const duplicateReceipt = state.receipts.find(
            (r) => r.access_key === draft.accessKey,
          );
          if (duplicateReceipt) {
            throw new Error(
              `Nota fiscal já importada anteriormente (Chave de acesso ${draft.accessKey} duplicada).`,
            );
          }
        }

        if (draft.items.length === 0) {
          throw new Error(
            'Adicione pelo menos 1 item na nota fiscal antes de confirmar a importação.',
          );
        }

        const now = new Date().toISOString();
        const purchaseDate = draft.issuedAt.slice(0, 10);
        const supermercadoCategory =
          state.categories.find((c) => c.slug === 'supermercado') ??
          state.categories.find((c) => c.kind === 'expense') ??
          null;

        const computedNetTotal = fromCents(
          draft.items
            .filter((it) => !it.isReturned)
            .reduce((acc, it) => acc + toCents(it.totalNetPaid), 0),
        );
        const finalPaidAmount =
          draft.totalPaidAmount > 0 ? draft.totalPaidAmount : computedNetTotal;

        const linkedTransaction = await get().createTransaction({
          kind: 'expense',
          description: `NFC-e: ${draft.merchantTradeName || draft.merchantName}`,
          amount: finalPaidAmount,
          competenceDate: purchaseDate,
          settlementDate: purchaseDate,
          categoryId: supermercadoCategory?.id ?? null,
          subcategoryId: null,
          accountId: state.accounts[0]?.id ?? null,
          destinationAccountId: null,
          creditCardId: null,
          cardInvoiceId: null,
          paymentMethod: 'pix',
          status: 'paid',
          isFixed: false,
          isRecurring: false,
          recurrenceFrequency: 'none',
          installmentNumber: null,
          totalInstallments: null,
          notes: draft.accessKey ? `Chave NFC-e: ${draft.accessKey}` : null,
          origin: 'receipt',
          externalId: draft.accessKey ?? `receipt-${Date.now()}`,
        });

        const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newReceipt: ReceiptRow = {
          id: receiptId,
          user_id: state.currentUserId,
          transaction_id: linkedTransaction.id,
          access_key: draft.accessKey,
          receipt_number: draft.receiptNumber,
          series: draft.series,
          issuer_uf: draft.issuerUf,
          merchant_name: draft.merchantName,
          merchant_trade_name: draft.merchantTradeName,
          merchant_cnpj: draft.merchantCnpj,
          issued_at: draft.issuedAt,
          total_gross_amount:
            draft.totalGrossAmount > 0 ? draft.totalGrossAmount : finalPaidAmount,
          total_discount_amount: draft.totalDiscountAmount,
          total_paid_amount: finalPaidAmount,
          source_type: draft.sourceType,
          qr_code_raw_url: draft.qrCodeRawUrl,
          status: 'confirmed',
          notes: null,
          created_at: now,
          updated_at: now,
        };

        const updatedCatalog = [...get().productCatalog];
        const createdItems: ReceiptItemRow[] = [];

        for (const itemDraft of draft.items) {
          const normName = normalizeProductName(
            itemDraft.normalizedProductName || itemDraft.originalProductName,
          );
          const normUnitInfo = computeNormalizedBaseUnitPrice(
            itemDraft.unitNetPricePaid,
            itemDraft.measurementUnit,
            1,
          );

          let catalogProduct = updatedCatalog.find(
            (p) =>
              (itemDraft.eanBarcode &&
                p.ean_barcode === itemDraft.eanBarcode &&
                p.measurement_unit === itemDraft.measurementUnit) ||
              (p.normalized_name === normName &&
                p.measurement_unit === itemDraft.measurementUnit),
          );

          if (!catalogProduct) {
            catalogProduct = {
              id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              user_id: state.currentUserId,
              category_id: supermercadoCategory?.id ?? null,
              equivalent_group_id: null,
              original_name: itemDraft.originalProductName,
              normalized_name: normName,
              brand: itemDraft.brand,
              ean_barcode: itemDraft.eanBarcode,
              measurement_unit: itemDraft.measurementUnit,
              package_quantity: 1,
              last_observed_price: normUnitInfo.pricePerBaseUnit,
              min_observed_price: normUnitInfo.pricePerBaseUnit,
              max_observed_price: normUnitInfo.pricePerBaseUnit,
              created_at: now,
              updated_at: now,
            };
            updatedCatalog.push(catalogProduct);
          } else {
            const minPrice =
              catalogProduct.min_observed_price != null
                ? Math.min(
                    catalogProduct.min_observed_price,
                    normUnitInfo.pricePerBaseUnit,
                  )
                : normUnitInfo.pricePerBaseUnit;
            const maxPrice =
              catalogProduct.max_observed_price != null
                ? Math.max(
                    catalogProduct.max_observed_price,
                    normUnitInfo.pricePerBaseUnit,
                  )
                : normUnitInfo.pricePerBaseUnit;

            catalogProduct = {
              ...catalogProduct,
              last_observed_price: normUnitInfo.pricePerBaseUnit,
              min_observed_price: minPrice,
              max_observed_price: maxPrice,
              updated_at: now,
            };
            const idx = updatedCatalog.findIndex((p) => p.id === catalogProduct!.id);
            if (idx >= 0) {
              updatedCatalog[idx] = catalogProduct;
            }
          }

          const receiptItem: ReceiptItemRow = {
            id: `ritem-${Date.now()}-${itemDraft.itemSequence}-${Math.random().toString(36).slice(2, 5)}`,
            user_id: state.currentUserId,
            receipt_id: receiptId,
            product_id: catalogProduct.id,
            item_sequence: itemDraft.itemSequence,
            original_product_name: itemDraft.originalProductName,
            normalized_product_name: normName,
            brand: itemDraft.brand,
            ean_barcode: itemDraft.eanBarcode,
            quantity: itemDraft.quantity,
            measurement_unit: itemDraft.measurementUnit,
            unit_gross_price: itemDraft.unitGrossPrice,
            unit_discount_amount: itemDraft.unitDiscountAmount,
            unit_net_price_paid: itemDraft.unitNetPricePaid,
            total_net_paid: itemDraft.totalNetPaid,
            normalized_price_per_base_unit: normUnitInfo.pricePerBaseUnit,
            normalized_base_unit: normUnitInfo.baseUnit,
            is_returned: itemDraft.isReturned,
            purchase_date: purchaseDate,
            merchant_name: draft.merchantTradeName || draft.merchantName,
            created_at: now,
          };

          createdItems.push(receiptItem);
        }

        set((curr) => ({
          receipts: [newReceipt, ...curr.receipts],
          receiptItems: [...createdItems, ...curr.receiptItems],
          productCatalog: updatedCatalog,
          pendingReceiptDraft: null,
          isLoading: false,
        }));
        await persistLocalSnapshot();

        return {
          receipt: newReceipt,
          items: createdItems,
          transaction: linkedTransaction,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao confirmar e salvar nota fiscal.';
        set({ errorMessage: message, isLoading: false });
        throw err;
      }
    },

    linkEquivalentProducts: async (
      productIds: readonly string[],
      customGroupId?: string,
    ) => {
      if (productIds.length < 2) {
        throw new Error(
          'Selecione pelo menos 2 produtos para associar como equivalentes.',
        );
      }
      const groupId = customGroupId ?? `equiv-grp-${Date.now()}`;
      const now = new Date().toISOString();

      set((curr) => ({
        productCatalog: curr.productCatalog.map((prod) =>
          productIds.includes(prod.id)
            ? { ...prod, equivalent_group_id: groupId, updated_at: now }
            : prod,
        ),
      }));
      await persistLocalSnapshot();
      return groupId;
    },

    createFinancialGoal: async (input: CreateFinancialGoalInput) => {
      if (input.name.trim().length < 2) {
        throw new Error('O nome da meta deve ter pelo menos 2 caracteres.');
      }
      if (input.targetAmount <= 0) {
        throw new Error('O valor alvo da meta deve ser maior que zero.');
      }

      const state = get();
      const now = new Date().toISOString();
      const initialAmount =
        input.currentAmount != null && input.currentAmount >= 0
          ? fromCents(toCents(input.currentAmount))
          : 0;

      const newGoal: FinancialGoalRow = {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: state.currentUserId,
        linked_account_id: state.accounts[1]?.id ?? state.accounts[0]?.id ?? null,
        name: input.name.trim(),
        objective_type: input.objectiveType,
        target_amount: fromCents(toCents(input.targetAmount)),
        current_amount: initialAmount,
        monthly_contribution_target:
          input.monthlyContributionTarget != null
            ? fromCents(toCents(input.monthlyContributionTarget))
            : null,
        start_date: now.slice(0, 10),
        target_date: input.targetDate ?? null,
        priority: input.priority ?? 1,
        status:
          initialAmount >= input.targetAmount ? 'completed' : 'active',
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      set((curr) => ({
        financialGoals: [newGoal, ...curr.financialGoals],
      }));
      await persistLocalSnapshot();
      return newGoal;
    },

    recordGoalContribution: async (
      goalId: string,
      contributionAmount: number,
      notes?: string,
    ) => {
      if (contributionAmount === 0 || !Number.isFinite(contributionAmount)) {
        throw new Error('Informe um valor de aporte válido diferente de zero.');
      }

      const state = get();
      const targetGoal = state.financialGoals.find((g) => g.id === goalId);
      if (!targetGoal) {
        throw new Error('Meta financeira não encontrada.');
      }

      const newBalanceCents = Math.max(
        0,
        toCents(targetGoal.current_amount) + toCents(contributionAmount),
      );
      const newBalance = fromCents(newBalanceCents);
      const now = new Date().toISOString();

      const updatedGoal: FinancialGoalRow = {
        ...targetGoal,
        current_amount: newBalance,
        status: newBalance >= targetGoal.target_amount ? 'completed' : 'active',
        updated_at: now,
      };

      const progressEntry: GoalProgressRow = {
        id: `gprog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: state.currentUserId,
        goal_id: goalId,
        transaction_id: null,
        contribution_amount: fromCents(toCents(contributionAmount)),
        balance_after: newBalance,
        recorded_at: now.slice(0, 10),
        notes: notes ?? null,
        created_at: now,
      };

      set((curr) => ({
        financialGoals: curr.financialGoals.map((g) =>
          g.id === goalId ? updatedGoal : g,
        ),
        goalsProgress: [progressEntry, ...curr.goalsProgress],
      }));
      await persistLocalSnapshot();
      return { goal: updatedGoal, progress: progressEntry };
    },

    recordAuditGamificationEvent: async (params) => {
      if (params.pointsDelta === 0) {
        throw new Error('A variação de pontos não pode ser zero.');
      }
      if (!params.idempotencyKey || params.idempotencyKey.trim().length < 4) {
        throw new Error('Chave de idempotência obrigatória para auditoria de pontos.');
      }

      const state = get();
      // Impedir duplicação pela chave de idempotência (Seção 12)
      const alreadyExists = state.gamificationEvents.some(
        (e) => e.idempotency_key === params.idempotencyKey,
      );
      if (alreadyExists) {
        return state.userLevel;
      }

      const now = new Date().toISOString();
      const newEvent: GamificationEventRow = {
        id: `gamevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: state.currentUserId,
        rule_code: params.ruleCode,
        reason_description: params.reasonDescription,
        points_delta: params.pointsDelta,
        reference_month: params.referenceMonth ?? null,
        idempotency_key: params.idempotencyKey,
        metadata: params.metadata ?? {},
        occurred_at: now,
      };

      const nextEvents = [newEvent, ...state.gamificationEvents];
      const totalPoints = Math.max(
        0,
        nextEvents.reduce((acc, ev) => acc + ev.points_delta, 0),
      );
      const levelDesc = resolveGamificationLevel(totalPoints);

      const updatedLevel: UserLevelRow = {
        ...state.userLevel,
        current_level: levelDesc.level,
        total_points: totalPoints,
        last_evaluated_at: now,
        updated_at: now,
      };

      set({
        gamificationEvents: nextEvents,
        userLevel: updatedLevel,
      });
      await persistLocalSnapshot();
      return updatedLevel;
    },

    evaluateCurrentMonthGamification: async () => {
      const state = get();
      const refMonth = state.filters.referenceYearMonth;
      const monthReceiptsCount = state.receipts.filter((r) =>
        r.issued_at.startsWith(refMonth),
      ).length;

      const candidateEvents = evaluateMonthlyGamificationEvents({
        userId: state.currentUserId,
        referenceYearMonth: refMonth,
        categories: state.categories,
        transactions: state.transactions,
        goals: state.financialGoals,
        existingEvents: state.gamificationEvents,
        receiptsCountInMonth: monthReceiptsCount,
      });

      let latestLevel = state.userLevel;
      for (const candidate of candidateEvents) {
        latestLevel = await get().recordAuditGamificationEvent({
          ruleCode: candidate.ruleCode,
          reasonDescription: candidate.reasonDescription,
          pointsDelta: candidate.pointsDelta,
          idempotencyKey: candidate.idempotencyKey,
          referenceMonth: candidate.referenceMonth,
          metadata: candidate.metadata,
        });
      }

      return latestLevel;
    },

    generateAdvisorRecommendationsForMonth: async (customYearMonth?: string) => {
      const state = get();
      const refYm = customYearMonth ?? state.filters.referenceYearMonth;
      const prevYm = getPreviousYearMonth(refYm);

      const drafts = generateDeterministicAdvisorRecommendations({
        referenceYearMonth: refYm,
        previousYearMonth: prevYm,
        profile: state.profile,
        categories: state.categories,
        transactions: state.transactions,
        goals: state.financialGoals,
        receiptItems: state.receiptItems,
        productCatalog: state.productCatalog,
      });

      const now = new Date().toISOString();
      const createdRows: AiRecommendationRow[] = [];

      for (const d of drafts) {
        validateAdvisorSafetyConstraints(d);
        const alreadyGenerated = state.aiRecommendations.find(
          (r) => r.reference_month === `${refYm}-01` && r.title === d.title,
        );
        if (alreadyGenerated) {
          createdRows.push(alreadyGenerated);
          continue;
        }

        const row: AiRecommendationRow = {
          id: `airec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user_id: state.currentUserId,
          reference_month: `${refYm}-01`,
          title: d.title,
          identified_situation: d.identifiedSituation,
          supporting_data: d.supportingData,
          estimated_financial_impact: d.estimatedFinancialImpact,
          is_impact_estimate: d.isImpactEstimate,
          suggested_action: d.suggestedAction,
          timeframe_or_frequency: d.timeframeOrFrequency,
          confidence_level: d.confidenceLevel,
          risks_and_limitations: d.risksAndLimitations,
          evaluation_method: d.evaluationMethod,
          requires_professional_review: d.requiresProfessionalReview,
          status: 'pending',
          user_feedback_notes: null,
          actual_measured_impact: null,
          responded_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        };
        createdRows.push(row);
      }

      const merged = [
        ...createdRows.filter(
          (cr) => !state.aiRecommendations.some((existing) => existing.id === cr.id),
        ),
        ...state.aiRecommendations,
      ];

      set({ aiRecommendations: merged });
      await persistLocalSnapshot();
      return merged;
    },

    updateAdvisorRecommendationStatus: async (
      recommendationId: string,
      status: AiRecommendationStatusType,
      actualMeasuredImpact = null,
      userFeedbackNotes = null,
    ) => {
      const state = get();
      const existing = state.aiRecommendations.find((r) => r.id === recommendationId);
      if (!existing) {
        throw new Error('Recomendação não encontrada.');
      }

      const now = new Date().toISOString();
      const updated: AiRecommendationRow = {
        ...existing,
        status,
        actual_measured_impact:
          actualMeasuredImpact !== undefined
            ? actualMeasuredImpact
            : existing.actual_measured_impact,
        user_feedback_notes:
          userFeedbackNotes !== undefined
            ? userFeedbackNotes
            : existing.user_feedback_notes,
        responded_at: existing.responded_at ?? now,
        completed_at: status === 'completed' ? now : existing.completed_at,
        updated_at: now,
      };

      set({
        aiRecommendations: state.aiRecommendations.map((r) =>
          r.id === recommendationId ? updated : r,
        ),
      });
      await persistLocalSnapshot();
      return updated;
    },
  };
});
