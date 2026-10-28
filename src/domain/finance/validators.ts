import { z } from 'zod';

const financialObjectives = [
  'exit_debt',
  'stop_overdraft',
  'emergency_fund',
  'monthly_savings',
  'start_investing',
  'buy_house',
  'buy_vehicle',
  'family_budget',
  'reduce_unnecessary_expenses',
  'custom',
] as const;

const incomeFrequencies = ['monthly', 'biweekly', 'weekly', 'variable'] as const;
const trackingProfiles = ['essential', 'balanced', 'detailed'] as const;
const categoryKinds = ['income', 'expense', 'transfer'] as const;
const transactionKinds = ['income', 'expense', 'transfer', 'invoice_payment'] as const;
const paymentMethods = [
  'pix',
  'debit_card',
  'credit_card',
  'cash',
  'bank_transfer',
  'boleto',
  'automatic_debit',
  'other',
] as const;
const transactionStatuses = [
  'planned',
  'pending',
  'paid',
  'received',
  'canceled',
] as const;
const recurrenceFrequencies = [
  'none',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
] as const;
const transactionOrigins = [
  'manual',
  'receipt',
  'bank_integration',
  'file_import',
] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schema de Cadastro e Onboarding (Seção 4).
 * Campos financeiros sensíveis (renda, despesas fixas, dívidas, reserva) são opcionais.
 */
export const onboardingInputSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Informe um nome de exibição com pelo menos 2 caracteres.')
      .max(80, 'Nome muito longo.'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    primaryObjective: z.enum(financialObjectives),
    customObjectiveDescription: z.string().trim().max(160).nullable().optional(),
    monthlyNetIncome: z
      .number()
      .nonnegative('A renda líquida não pode ser negativa.')
      .nullable()
      .optional(),
    incomeFrequency: z.enum(incomeFrequencies).default('monthly'),
    approxFixedExpenses: z
      .number()
      .nonnegative('As despesas fixas não podem ser negativas.')
      .nullable()
      .optional(),
    monthlyDebtInstallments: z
      .number()
      .nonnegative('O valor de parcelas/dívidas não pode ser negativo.')
      .nullable()
      .optional(),
    currentEmergencyFund: z
      .number()
      .nonnegative('A reserva financeira não pode ser negativa.')
      .nullable()
      .optional(),
    trackingProfile: z.enum(trackingProfiles).default('balanced'),
    trackedCategorySlugs: z
      .array(z.string().min(1))
      .min(1, 'Selecione pelo menos uma categoria para acompanhar.'),
    privacyPolicyAccepted: z
      .boolean()
      .refine((val) => val === true, 'É necessário aceitar a política de privacidade.'),
  })
  .superRefine((data, ctx) => {
    if (
      data.primaryObjective === 'custom' &&
      (!data.customObjectiveDescription ||
        data.customObjectiveDescription.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customObjectiveDescription'],
        message: 'Descreva seu objetivo personalizado (mínimo de 3 caracteres).',
      });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

/**
 * Schema de Categoria / Subcategoria e Orçamento Mensal (Seção 5).
 */
export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da categoria deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome da categoria deve ter no máximo 60 caracteres.'),
  parentId: z.string().uuid().nullable().optional(),
  kind: z.enum(categoryKinds),
  icon: z.string().trim().min(1).default('folder'),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Informe uma cor hexadecimal válida (ex.: #2563EB).')
    .default('#2563EB'),
  monthlyBudget: z
    .number()
    .nonnegative('O orçamento mensal não pode ser negativo.')
    .nullable()
    .optional(),
  alertThresholdPercent: z
    .number()
    .min(1, 'O alerta deve ser entre 1% e 100%.')
    .max(100, 'O alerta deve ser entre 1% e 100%.')
    .default(80),
  isFixedExpenseDefault: z.boolean().default(false),
  isEssential: z.boolean().default(false),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/**
 * Schema de Receita, Despesa, Transferência e Pagamento de Fatura (Seção 5).
 */
export const transactionInputSchema = z
  .object({
    kind: z.enum(transactionKinds),
    description: z
      .string()
      .trim()
      .min(2, 'Informe uma descrição com pelo menos 2 caracteres.')
      .max(140, 'Descrição muito longa.'),
    amount: z.number().positive('O valor do lançamento deve ser maior que zero.'),
    competenceDate: z
      .string()
      .regex(isoDateRegex, 'A data de competência deve estar no formato AAAA-MM-DD.'),
    settlementDate: z
      .string()
      .regex(isoDateRegex, 'A data de pagamento/recebimento deve ser AAAA-MM-DD.')
      .nullable()
      .optional(),
    categoryId: z.string().min(1).nullable().optional(),
    subcategoryId: z.string().min(1).nullable().optional(),
    accountId: z.string().min(1).nullable().optional(),
    destinationAccountId: z.string().min(1).nullable().optional(),
    creditCardId: z.string().min(1).nullable().optional(),
    cardInvoiceId: z.string().min(1).nullable().optional(),
    paymentMethod: z.enum(paymentMethods).default('pix'),
    status: z.enum(transactionStatuses).default('paid'),
    isFixed: z.boolean().default(false),
    isRecurring: z.boolean().default(false),
    recurrenceFrequency: z.enum(recurrenceFrequencies).default('none'),
    installmentNumber: z.number().int().min(1).nullable().optional(),
    totalInstallments: z.number().int().min(1).max(120).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    origin: z.enum(transactionOrigins).default('manual'),
    externalId: z.string().trim().max(120).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'transfer') {
      if (!data.accountId || !data.destinationAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAccountId'],
          message:
            'Transferências entre contas exigem conta de origem e conta de destino.',
        });
      } else if (data.accountId === data.destinationAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAccountId'],
          message: 'A conta de destino deve ser diferente da conta de origem.',
        });
      }
    }

    if (
      data.kind === 'expense' &&
      data.paymentMethod === 'credit_card' &&
      !data.creditCardId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creditCardId'],
        message: 'Selecione o cartão de crédito utilizado na compra.',
      });
    }

    if (data.kind === 'invoice_payment' && !data.cardInvoiceId && !data.creditCardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cardInvoiceId'],
        message: 'Informe a fatura ou o cartão referente ao pagamento.',
      });
    }

    if (
      (data.installmentNumber != null && data.totalInstallments == null) ||
      (data.installmentNumber == null && data.totalInstallments != null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalInstallments'],
        message: 'Informe tanto o número da parcela quanto o total de parcelas.',
      });
    } else if (
      data.installmentNumber != null &&
      data.totalInstallments != null &&
      data.installmentNumber > data.totalInstallments
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installmentNumber'],
        message: 'O número da parcela não pode ser maior que o total de parcelas.',
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;
