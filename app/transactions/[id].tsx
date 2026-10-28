import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import {
  PaymentMethodType,
  RecurrenceFrequencyType,
  TransactionKindType,
  TransactionStatusType,
} from '@/types/database.types';

export default function TransactionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'new';

  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const filters = useFinanceStore((s) => s.filters);
  const createTransaction = useFinanceStore((s) => s.createTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);

  const existingTx = !isNew
    ? transactions.find((t) => t.id === params.id)
    : undefined;

  const defaultDate = `${filters.referenceYearMonth}-10`;

  const [kind, setKind] = useState<TransactionKindType>(
    existingTx?.kind ?? 'expense',
  );
  const [description, setDescription] = useState(existingTx?.description ?? '');
  const [amountText, setAmountText] = useState(
    existingTx ? String(existingTx.amount) : '',
  );
  const [competenceDate, setCompetenceDate] = useState(
    existingTx?.competence_date ?? defaultDate,
  );
  const [settlementDate, setSettlementDate] = useState(
    existingTx?.settlement_date ?? defaultDate,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    existingTx?.category_id ?? categories.find((c) => c.slug === 'supermercado')?.id ?? null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    existingTx?.account_id ?? accounts[0]?.id ?? null,
  );
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(
    existingTx?.destination_account_id ?? accounts[1]?.id ?? null,
  );
  const [creditCardId, setCreditCardId] = useState<string | null>(
    existingTx?.credit_card_id ?? creditCards[0]?.id ?? null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(
    existingTx?.payment_method ?? 'pix',
  );
  const [status, setStatus] = useState<TransactionStatusType>(
    existingTx?.status ?? 'paid',
  );
  const [isFixed, setIsFixed] = useState<boolean>(existingTx?.is_fixed ?? false);
  const [isRecurring, setIsRecurring] = useState<boolean>(
    existingTx?.is_recurring ?? false,
  );
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequencyType>(existingTx?.recurrence_frequency ?? 'none');
  const [notes, setNotes] = useState(existingTx?.notes ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => {
    if (kind === 'income') return c.kind === 'income';
    if (kind === 'expense') return c.kind === 'expense';
    return true;
  });

  const handleSave = async () => {
    setErrorMessage(null);
    const parsedAmount = Number(amountText.trim().replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Informe um valor válido maior que zero.');
      return;
    }

    const payload = {
      kind,
      description,
      amount: parsedAmount,
      competenceDate,
      settlementDate:
        paymentMethod === 'credit_card' && kind === 'expense'
          ? null
          : settlementDate.trim() || null,
      categoryId: kind === 'transfer' || kind === 'invoice_payment' ? null : categoryId,
      subcategoryId: null,
      accountId,
      destinationAccountId: kind === 'transfer' ? destinationAccountId : null,
      creditCardId:
        paymentMethod === 'credit_card' || kind === 'invoice_payment'
          ? creditCardId
          : null,
      cardInvoiceId: null,
      paymentMethod,
      status: kind === 'income' && status === 'paid' ? 'received' : status,
      isFixed,
      isRecurring,
      recurrenceFrequency: isRecurring ? 'monthly' : recurrenceFrequency,
      installmentNumber: null,
      totalInstallments: null,
      notes: notes.trim() || null,
      origin: existingTx?.origin ?? ('manual' as const),
      externalId: existingTx?.external_id ?? null,
    };

    try {
      if (isNew) {
        await createTransaction(payload);
      } else if (params.id) {
        await updateTransaction(params.id, payload);
      }
      router.back();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao salvar lançamento.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {isNew ? 'Novo Lançamento Financeiro' : 'Editar Lançamento'}
      </Text>
      <Text style={styles.subtitle}>
        Compras no cartão de crédito entram no orçamento pela Data de Competência e não
        são contadas em dobro quando a fatura é paga.
      </Text>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Tipo de Lançamento */}
      <Text style={styles.label}>Tipo de operação *</Text>
      <View style={styles.chipsRow}>
        {(
          [
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
            { value: 'invoice_payment', label: 'Pagamento de Fatura' },
            { value: 'transfer', label: 'Transferência Própria' },
          ] as const
        ).map((item) => {
          const active = kind === item.value;
          return (
            <Pressable
              key={item.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setKind(item.value);
                if (item.value === 'income') {
                  setStatus('received');
                } else {
                  setStatus('paid');
                }
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Descrição e Valor */}
      <Text style={styles.label}>Descrição *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: Supermercado Mensal, Salário, Aluguel"
        placeholderTextColor="#64748B"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Valor (R$) *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: 250,90"
        placeholderTextColor="#64748B"
        keyboardType="numeric"
        value={amountText}
        onChangeText={setAmountText}
      />

      {/* Datas */}
      <Text style={styles.label}>Data de Competência (AAAA-MM-DD) *</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-10-15"
        placeholderTextColor="#64748B"
        value={competenceDate}
        onChangeText={setCompetenceDate}
      />

      {!(kind === 'expense' && paymentMethod === 'credit_card') ? (
        <>
          <Text style={styles.label}>Data de Pagamento / Recebimento (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-10-15"
            placeholderTextColor="#64748B"
            value={settlementDate}
            onChangeText={setSettlementDate}
          />
        </>
      ) : null}

      {/* Forma de Pagamento */}
      <Text style={styles.label}>Forma de pagamento</Text>
      <View style={styles.chipsRow}>
        {(
          [
            { value: 'pix', label: 'Pix' },
            { value: 'credit_card', label: 'Cartão de Crédito' },
            { value: 'debit_card', label: 'Cartão de Débito' },
            { value: 'boleto', label: 'Boleto' },
            { value: 'cash', label: 'Dinheiro' },
            { value: 'bank_transfer', label: 'Transferência' },
          ] as const
        ).map((pm) => {
          const active = paymentMethod === pm.value;
          return (
            <Pressable
              key={pm.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPaymentMethod(pm.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {pm.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Seleção de Cartão de Crédito quando aplicável */}
      {paymentMethod === 'credit_card' || kind === 'invoice_payment' ? (
        <>
          <Text style={styles.label}>Cartão de Crédito *</Text>
          <View style={styles.chipsRow}>
            {creditCards.map((card) => {
              const active = creditCardId === card.id;
              return (
                <Pressable
                  key={card.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCreditCardId(card.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {card.name} (final {card.last_four_digits})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Seleção de Conta */}
      <Text style={styles.label}>Conta / Carteira</Text>
      <View style={styles.chipsRow}>
        {accounts.map((acc) => {
          const active = accountId === acc.id;
          return (
            <Pressable
              key={acc.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setAccountId(acc.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {acc.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === 'transfer' ? (
        <>
          <Text style={styles.label}>Conta de Destino *</Text>
          <View style={styles.chipsRow}>
            {accounts.map((acc) => {
              const active = destinationAccountId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDestinationAccountId(acc.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {acc.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Categoria */}
      {kind !== 'transfer' && kind !== 'invoice_payment' ? (
        <>
          <Text style={styles.label}>Categoria *</Text>
          <View style={styles.chipsRow}>
            {filteredCategories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setCategoryId(cat.id);
                    setIsFixed(cat.is_fixed_expense_default);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Status */}
      <Text style={styles.label}>Status</Text>
      <View style={styles.chipsRow}>
        {(
          [
            { value: 'paid', label: 'Pago' },
            { value: 'received', label: 'Recebido' },
            { value: 'pending', label: 'Pendente' },
            { value: 'planned', label: 'Previsto' },
          ] as const
        ).map((st) => {
          const active = status === st.value;
          return (
            <Pressable
              key={st.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatus(st.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {st.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Switches de Despesa Fixa e Recorrente */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Despesa/Receita Fixa Mensal</Text>
        <Switch value={isFixed} onValueChange={setIsFixed} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Lançamento Recorrente</Text>
        <Switch
          value={isRecurring}
          onValueChange={(val) => {
            setIsRecurring(val);
            setRecurrenceFrequency(val ? 'monthly' : 'none');
          }}
        />
      </View>

      {/* Observações */}
      <Text style={styles.label}>Observações (Opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Detalhes adicionais..."
        placeholderTextColor="#64748B"
        value={notes}
        onChangeText={setNotes}
      />

      <View style={styles.actionsRow}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={() => void handleSave()}>
          <Text style={styles.saveBtnText}>Salvar Lançamento</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    padding: 20,
    paddingTop: 44,
    paddingBottom: 60,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#052E16',
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 15,
  },
});
