import { useState } from 'react';
import { View } from 'react-native';
import { Check, CreditCard, Plus } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, sumCurrencyExact } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  InlineMessage,
  MonthSwitcher,
  ProgressBar,
  Screen,
  Section,
  SectionHeader,
  spacing,
  TextField,
} from '@/ui';

export default function CreditCardsAndInvoicesScreen() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardInvoices = useFinanceStore((s) => s.cardInvoices);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const filters = useFinanceStore((s) => s.filters);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const createCreditCard = useFinanceStore((s) => s.createCreditCard);
  const payCreditCardInvoice = useFinanceStore((s) => s.payCreditCardInvoice);

  const [cardName, setCardName] = useState('');
  const [limitText, setLimitText] = useState('');
  const [closingDayText, setClosingDayText] = useState('5');
  const [dueDayText, setDueDayText] = useState('12');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleCreateCard = async () => {
    setStatusMessage(null);
    setIsError(false);
    const limit = Number(limitText.replace(',', '.'));
    const closingDay = Number(closingDayText);
    const dueDay = Number(dueDayText);

    try {
      await createCreditCard({
        name: cardName,
        creditLimit: limit,
        closingDay,
        dueDay,
      });
      setCardName('');
      setLimitText('');
      setStatusMessage('Cartão de crédito cadastrado com sucesso!');
    } catch (err) {
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao criar cartão.',
      );
    }
  };

  const handlePayInvoice = async (cardId: string) => {
    setStatusMessage(null);
    setIsError(false);
    try {
      const res = await payCreditCardInvoice({
        creditCardId: cardId,
        referenceYearMonth: filters.referenceYearMonth,
        paymentAccountId: accounts[0]?.id ?? 'acc-principal',
        paymentDate: `${filters.referenceYearMonth}-12`,
      });
      setStatusMessage(
        `Fatura quitada (${formatCurrencyBRL(res.invoice.paid_amount)})! O caixa foi atualizado sem duplicar suas despesas de categoria.`,
      );
    } catch (err) {
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao pagar fatura.',
      );
    }
  };

  return (
    <Screen
      header={{
        title: 'Cartões e Faturas',
        subtitle:
          'Compras no cartão entram pela competência. Ao pagar a fatura, o caixa é baixado sem duplicar despesas.',
        showBack: true,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
        <MonthSwitcher
          value={filters.referenceYearMonth}
          onChange={setReferenceYearMonth}
        />
      </View>

      {statusMessage ? (
        <InlineMessage
          tone={isError ? 'danger' : 'success'}
          message={statusMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* Cartões Ativos e Fatura do Mês */}
      <View style={{ gap: spacing.md }}>
        {creditCards.map((card) => {
          const monthPurchases = transactions.filter(
            (tx) =>
              tx.kind === 'expense' &&
              tx.payment_method === 'credit_card' &&
              tx.credit_card_id === card.id &&
              tx.status !== 'canceled' &&
              tx.competence_date.startsWith(filters.referenceYearMonth),
          );
          const currentSpend = sumCurrencyExact(
            monthPurchases.map((t) => t.amount),
          );
          const availableLimit = Math.max(0, card.credit_limit - currentSpend);
          const usageRatio =
            card.credit_limit > 0 ? Math.min(1, currentSpend / card.credit_limit) : 0;
          const existingInv = cardInvoices.find(
            (i) =>
              i.credit_card_id === card.id &&
              i.reference_month === `${filters.referenceYearMonth}-01`,
          );
          const isPaid = existingInv?.status === 'paid';

          return (
            <Card key={card.id} style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                  <CreditCard color="#166534" size={20} />
                  <AppText variant="heading" numberOfLines={1}>
                    {card.name}
                  </AppText>
                </View>
                <Badge
                  tone={isPaid ? 'positive' : currentSpend > 0 ? 'warning' : 'neutral'}
                  label={isPaid ? 'FATURA PAGA' : 'EM ABERTO'}
                />
              </View>

              <AppText variant="caption" tone="secondary">
                Fechamento dia {card.closing_day} · Vencimento dia {card.due_day} · Limite Total:{' '}
                {formatCurrencyBRL(card.credit_limit)}
              </AppText>

              <ProgressBar
                value={usageRatio}
                tone={usageRatio >= 0.85 ? 'negative' : usageRatio >= 0.65 ? 'warning' : 'brand'}
                height={8}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <AppText variant="caption" tone="secondary">
                    Fatura em {filters.referenceYearMonth}
                  </AppText>
                  <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrencyBRL(currentSpend)}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="caption" tone="secondary">
                    Limite disponível
                  </AppText>
                  <AppText
                    variant="bodyStrong"
                    tone="positive"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatCurrencyBRL(availableLimit)}
                  </AppText>
                </View>
              </View>

              {!isPaid && currentSpend > 0 ? (
                <>
                  <Divider />
                  <Button
                    label={`Registrar Pagamento da Fatura (${formatCurrencyBRL(currentSpend)})`}
                    icon={Check}
                    fullWidth
                    onPress={() => void handlePayInvoice(card.id)}
                  />
                </>
              ) : null}
            </Card>
          );
        })}
      </View>

      {/* Novo Cartão */}
      <Section>
        <SectionHeader
          title="Cadastrar Novo Cartão"
          description="Informe limite e datas de fechamento e vencimento."
        />
        <Card style={{ gap: spacing.md }}>
          <TextField
            label="Nome do cartão *"
            placeholder="Ex.: Nubank, Itaú Click, Inter"
            value={cardName}
            onChangeText={setCardName}
          />
          <TextField
            label="Limite de crédito *"
            prefix="R$"
            placeholder="Ex.: 4000"
            keyboardType="numeric"
            value={limitText}
            onChangeText={setLimitText}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Dia fechamento"
                keyboardType="numeric"
                value={closingDayText}
                onChangeText={setClosingDayText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Dia vencimento"
                keyboardType="numeric"
                value={dueDayText}
                onChangeText={setDueDayText}
              />
            </View>
          </View>
          <Button
            label="Salvar Cartão"
            icon={Plus}
            fullWidth
            onPress={() => void handleCreateCard()}
          />
        </Card>
      </Section>
    </Screen>
  );
}
