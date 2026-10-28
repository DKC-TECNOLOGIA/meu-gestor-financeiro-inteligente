import {
  BankConnectionRow,
  BankTransactionRow,
  CategoryRow,
  PaymentMethodType,
  TransactionKindType,
  TransactionRow,
} from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';

export type OpenFinanceScope =
  | 'accounts'
  | 'transactions'
  | 'credit_cards'
  | 'investments';

export interface SupportedBrazilianInstitution {
  ispb: string;
  name: string;
  supportsAccounts: boolean;
  supportsCreditCards: boolean;
  supportsPixHistory: boolean;
  notes: string;
}

/**
 * Catálogo realista de instituições participantes do Open Finance Brasil,
 * documentando cobertura efetiva sem prometer suporte irrestrito a 100% dos bancos.
 */
export const SUPPORTED_OPEN_FINANCE_INSTITUTIONS: readonly SupportedBrazilianInstitution[] =
  [
    {
      ispb: '00000000',
      name: 'Banco do Brasil S.A.',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Consentimento via redirecionamento OAuth2 oficial do app BB.',
    },
    {
      ispb: '60701190',
      name: 'Itaú Unibanco S.A.',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Suporte a conta corrente, poupança, Pix e faturas Ourocard/Itaucard.',
    },
    {
      ispb: '60746948',
      name: 'Banco Bradesco S.A.',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Sincronização sujeita às janelas regulatórias do Open Finance Brasil.',
    },
    {
      ispb: '00360305',
      name: 'Caixa Econômica Federal',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Requer autorização explícita no aplicativo Caixa.',
    },
    {
      ispb: '18236120',
      name: 'Nu Pagamentos S.A. (Nubank)',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Compartilhamento de NuConta e cartão de crédito roxo/Ultravioleta.',
    },
    {
      ispb: '00416968',
      name: 'Banco Inter S.A.',
      supportsAccounts: true,
      supportsCreditCards: true,
      supportsPixHistory: true,
      notes: 'Consentimento de até 12 meses revogável a qualquer instante.',
    },
  ] as const;

export interface RawProviderBankTransaction {
  providerTransactionId: string;
  providerAccountId: string;
  rawDescription: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  occurredAt: string; // ISO
  accountType?: 'CHECKING' | 'CREDIT_CARD';
}

export interface NormalizedBankTransactionDraft {
  providerTransactionId: string;
  providerAccountId: string;
  rawDescription: string;
  normalizedDescription: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  occurredAt: string;
  paymentMethodHint: PaymentMethodType;
  suggestedCategoryId: string | null;
  suggestedKind: TransactionKindType;
  isDuplicateOfExisting: boolean;
}

/**
 * Guardrail de Segurança (Seção 9):
 * Garante que jamais solicitaremos ou aceitaremos campos de senha bancária, PIN ou token de dispositivo.
 */
export function assertNoBankPasswordProvided(
  payload: Record<string, unknown>,
): void {
  const forbiddenKeys = [
    'password',
    'senha',
    'bankPassword',
    'pin',
    'cvv',
    'cardPassword',
    'electronicPassword',
  ];

  for (const key of Object.keys(payload)) {
    if (
      forbiddenKeys.some((fk) => key.toLowerCase().includes(fk.toLowerCase()))
    ) {
      throw new Error(
        'Violação crítica de segurança (Seção 9): O aplicativo jamais solicita, processa ou armazena senhas bancárias.',
      );
    }
  }
}

/**
 * Normaliza a descrição bruta de extrato bancário (Pix, TED, compra no débito/crédito, pagamento de fatura)
 * e sugere automaticamente a forma de pagamento, tipo de lançamento e categoria (Passos 5 e 6 da Seção 9).
 */
export function normalizeAndClassifyBankTransaction(
  rawTx: RawProviderBankTransaction,
  categories: readonly CategoryRow[],
  existingTransactions: readonly Pick<
    TransactionRow,
    'external_id' | 'origin'
  >[],
  existingBankTransactions: readonly Pick<
    BankTransactionRow,
    'provider_transaction_id'
  >[],
): NormalizedBankTransactionDraft {
  const cleanDesc = rawTx.rawDescription
    .replace(/\s+/g, ' ')
    .trim();
  const upperDesc = cleanDesc.toUpperCase();

  // 1. Detectar forma de pagamento a partir dos marcadores do extrato
  let paymentMethodHint: PaymentMethodType = 'bank_transfer';
  if (rawTx.accountType === 'CREDIT_CARD') {
    paymentMethodHint = 'credit_card';
  } else if (/PIX\b|TRANSF\s+PIX|PIX\s+ENVIADO|PIX\s+RECEBIDO/.test(upperDesc)) {
    paymentMethodHint = 'pix';
  } else if (/COMPRA\s+DEBITO|CARTAO\s+DEBITO|DEB\s+MASTERCARD|DEB\s+VISA/.test(upperDesc)) {
    paymentMethodHint = 'debit_card';
  } else if (/PAGTO\s+BOLETO|LIQUIDACAO\s+BOLETO|TITULO/.test(upperDesc)) {
    paymentMethodHint = 'boleto';
  } else if (/DEB\s+AUT|DEBITO\s+AUTOMATICO/.test(upperDesc)) {
    paymentMethodHint = 'automatic_debit';
  }

  // 2. Detectar se é pagamento de fatura de cartão ou transferência própria
  let suggestedKind: TransactionKindType =
    rawTx.direction === 'CREDIT' ? 'income' : 'expense';

  if (
    rawTx.direction === 'DEBIT' &&
    /PAGAMENTO\s+FATURA|PAGTO\s+CARTAO|FATURA\s+CARTAO/.test(upperDesc)
  ) {
    suggestedKind = 'invoice_payment';
  } else if (/TRANSF\s+MESMA\s+TITULARIDADE|CONTA\s+PROPRIA/.test(upperDesc)) {
    suggestedKind = 'transfer';
  }

  // 3. Sugerir categoria com base em palavras-chave determinísticas
  const findCatIdBySlug = (slug: string): string | null =>
    categories.find((c) => c.slug === slug)?.id ?? null;

  let suggestedCategoryId: string | null = null;
  if (suggestedKind === 'income') {
    if (/SALARIO|FOLHA|PROVENTOS|REMUNERACAO/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('receitas-salariais');
    } else {
      suggestedCategoryId = findCatIdBySlug('outras-receitas');
    }
  } else if (suggestedKind === 'expense') {
    if (/ATACADAO|ATAKAREJO|HIPERIDEAL|ASSAI|SUPERMERCADO|MERCADO|CARREFOUR/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('supermercado');
    } else if (/IFOOD|RESTAURANTE|PADARIA|LANCHONETE/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('almoco-refeicoes-fora');
    } else if (/UBER|99APP|METRO|PEDAGIO/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('transporte');
    } else if (/POSTO|COMBUSTIVEL|SHELL|IPIRANGA|PETROBRAS/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('combustivel');
    } else if (/FARMACIA|DROGASIL|PAGUE\s+MENOS|HOSPITAL|CLINICA/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('saude');
    } else if (/NETFLIX|SPOTIFY|AMAZON\s+PRIME|DISNEY|YOUTUBE/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('assinaturas');
    } else if (/COELBA|EMBASA|ALUGUEL|CONDOMINIO|VIVO|CLARO/.test(upperDesc)) {
      suggestedCategoryId = findCatIdBySlug('moradia');
    } else {
      suggestedCategoryId = findCatIdBySlug('outras-despesas');
    }
  }

  // 4. Verificar duplicidade (Passo 7 da Seção 9: "O aplicativo evita importar a mesma transação mais de uma vez")
  const alreadyInBankTx = existingBankTransactions.some(
    (btx) => btx.provider_transaction_id === rawTx.providerTransactionId,
  );
  const alreadyInLedger = existingTransactions.some(
    (tx) =>
      tx.origin === 'bank_integration' &&
      tx.external_id === rawTx.providerTransactionId,
  );

  return {
    providerTransactionId: rawTx.providerTransactionId,
    providerAccountId: rawTx.providerAccountId,
    rawDescription: rawTx.rawDescription,
    normalizedDescription: cleanDesc,
    amount: fromCents(Math.abs(toCents(rawTx.amount))),
    direction: rawTx.direction,
    occurredAt: rawTx.occurredAt,
    paymentMethodHint,
    suggestedCategoryId,
    suggestedKind,
    isDuplicateOfExisting: alreadyInBankTx || alreadyInLedger,
  };
}

/**
 * Verifica se o consentimento da conexão bancária está ativo e dentro do prazo de validade.
 */
export function isBankConsentActive(connection: BankConnectionRow): boolean {
  if (connection.status !== 'active' || connection.revoked_at != null) {
    return false;
  }
  if (!connection.consent_expires_at) {
    return true;
  }
  return new Date(connection.consent_expires_at).getTime() > Date.now();
}
