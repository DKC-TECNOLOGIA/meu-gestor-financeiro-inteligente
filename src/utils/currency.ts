import { APP_CURRENCY, APP_LOCALE, APP_TIMEZONE } from '@/config/constants';

/**
 * Converte valor em reais (decimal) para centavos inteiros de forma segura.
 */
export function toCents(amountInReais: number): number {
  if (!Number.isFinite(amountInReais)) {
    throw new Error('Valor monetário inválido.');
  }
  return Math.round(amountInReais * 100);
}

/**
 * Converte centavos inteiros de volta para valor decimal com 2 casas exatas.
 */
export function fromCents(amountInCents: number): number {
  if (!Number.isFinite(amountInCents)) {
    throw new Error('Valor em centavos inválido.');
  }
  return Number((Math.round(amountInCents) / 100).toFixed(2));
}

/**
 * Soma um array de valores monetários sem erro de ponto flutuante IEEE 754.
 */
export function sumCurrencyExact(values: readonly number[]): number {
  const totalCents = values.reduce((acc, value) => acc + toCents(value), 0);
  return fromCents(totalCents);
}

/**
 * Formata número monetário para BRL (R$ 1.234,56).
 */
export function formatCurrencyBRL(amount: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: APP_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formata uma data ISO (YYYY-MM-DD ou timestamp) no fuso America/Bahia (DD/MM/AAAA).
 */
export function formatDateBR(dateInput: string | Date): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-');
    return `${day}/${month}/${year}`;
  }
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);
}
