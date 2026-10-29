import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Switch, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import {
  PaymentMethodType,
  RecurrenceFrequencyType,
  TransactionKindType,
  TransactionStatusType,
} from '@/types/database.types';
import {
  AppText,
  Button,
  Card,
  Chip,
  colors,
  InlineMessage,
  Screen,
  SegmentedControl,
  spacing,
  TextField,
} from '@/ui';

export default function TransactionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; kind?: TransactionKindType }>();
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
    existingTx?.kind ?? params.kind ?? 'expense',
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
  const [status] = useState<TransactionStatusType>(existingTx?.status ?? 'paid');
  const [isFixed, setIsFixed] = useState<boolean>(existingTx?.is_fixed ?? false);
  const [isRecurring, setIsRecurring] = useState<boolean>(
    existingTx?.is_recurring ?? false,
  );
  const [recurrenceFrequency] = useState<RecurrenceFrequencyType>(
    existingTx?.recurrence_frequency ?? 'none',
  );
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
    <Screen
      header={{
        title: isNew ? 'Novo Lançamento' : 'Editar Lançamento',
        subtitle:
          'Compras no cartão entram pela competência e não duplicam ao pagar a fatura.',
        showBack: true,
      }}
      footer={
        <Button
          label={isNew ? 'Salvar lançamento' : 'Atualizar lançamento'}
          icon={Check}
          fullWidth
          onPress={() => void handleSave()}
        />
      }
    >
      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      <View style={{ gap: spacing.lg }}>
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
            { value: 'invoice_payment', label: 'Fatura' },
            { value: 'transfer', label: 'Transferência' },
          ]}
        />

        <Card style={{ gap: spacing.md }}>
          <TextField
            label="Valor"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={amountText}
            onChangeText={setAmountText}
          />
          <TextField
            label="Descrição"
            placeholder="Ex.: Supermercado mensal, Salário, Aluguel"
            value={description}
            onChangeText={setDescription}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Competência"
                placeholder="AAAA-MM-DD"
                value={competenceDate}
                onChangeText={setCompetenceDate}
              />
            </View>
            {!(kind === 'expense' && paymentMethod === 'credit_card') ? (
              <View style={{ flex: 1 }}>
                <TextField
                  label="Liquidação (Caixa)"
                  placeholder="AAAA-MM-DD"
                  value={settlementDate}
                  onChangeText={setSettlementDate}
                />
              </View>
            ) : null}
          </View>
        </Card>

        {/* Forma de pagamento */}
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="secondary">
            Forma de pagamento
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(
              [
                { value: 'pix', label: 'Pix' },
                { value: 'debit_card', label: 'Débito' },
                { value: 'credit_card', label: 'Cartão de Crédito' },
                { value: 'bank_transfer', label: 'TED / DOC' },
                { value: 'boleto', label: 'Boleto' },
                { value: 'cash', label: 'Dinheiro' },
              ] as const
            ).map((pm) => (
              <Chip
                key={pm.value}
                label={pm.label}
                selected={paymentMethod === pm.value}
                onPress={() => setPaymentMethod(pm.value)}
              />
            ))}
          </View>
        </Card>

        {/* Categoria */}
        {kind !== 'transfer' && kind !== 'invoice_payment' ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="secondary">
              Categoria
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {filteredCategories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>
          </Card>
        ) : null}

        {/* Conta / Cartão */}
        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="secondary">
              {kind === 'transfer' ? 'Conta de origem' : 'Conta financeira'}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {accounts.map((acc) => (
                <Chip
                  key={acc.id}
                  label={acc.name}
                  selected={accountId === acc.id}
                  onPress={() => setAccountId(acc.id)}
                />
              ))}
            </View>
          </View>

          {kind === 'transfer' ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" tone="secondary">
                Conta de destino
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {accounts.map((acc) => (
                  <Chip
                    key={`dest-${acc.id}`}
                    label={acc.name}
                    selected={destinationAccountId === acc.id}
                    onPress={() => setDestinationAccountId(acc.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {paymentMethod === 'credit_card' || kind === 'invoice_payment' ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" tone="secondary">
                Cartão de crédito
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {creditCards.map((cc) => (
                  <Chip
                    key={cc.id}
                    label={cc.name}
                    selected={creditCardId === cc.id}
                    onPress={() => setCreditCardId(cc.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="body">Despesa / Receita fixa mensal</AppText>
            <Switch
              value={isFixed}
              onValueChange={setIsFixed}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="body">Repetir mensalmente (recorrente)</AppText>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          <TextField
            label="Observações opcionais"
            placeholder="Anotações ou detalhes do comprovante"
            value={notes}
            onChangeText={setNotes}
          />
        </Card>
      </View>
    </Screen>
  );
}
