import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { APP_CURRENCY, APP_TIMEZONE, INITIAL_SYSTEM_CATEGORIES } from '@/config/constants';
import {
  CategoryInput,
  categoryInputSchema,
  OnboardingInput,
  onboardingInputSchema,
  TransactionInput,
  transactionInputSchema,
} from '@/domain/finance/validators';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  AccountRow,
  CardInvoiceRow,
  CategoryRow,
  CreditCardRow,
  ProfileRow,
  TransactionRow,
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

        // Se o usuário informou reserva financeira atual no onboarding, ajustar saldo inicial da conta reserva
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

        // Prevenção de duplicidade por externalId e origem (Seção 5 e Seção 14)
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
  };
});
