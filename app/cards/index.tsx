import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, sumCurrencyExact } from '@/utils/currency';

export default function CreditCardsAndInvoicesScreen() {
  const router = useRouter();
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardInvoices = useFinanceStore((s) => s.cardInvoices);
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const filters = useFinanceStore((s) => s.filters);
  const createCreditCard = useFinanceStore((s) => s.createCreditCard);
  const payCreditCardInvoice = useFinanceStore((s) => s.payCreditCardInvoice);

  const [cardName, setCardName] = useState('');
  const [limitText, setLimitText] = useState('');
  const [closingDayText, setClosingDayText] = useState('5');
  const [dueDayText, setDueDayText] = useState('12');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCreateCard = async () => {
    setStatusMessage(null);
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
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao criar cartão.',
      );
    }
  };

  const handlePayInvoice = async (cardId: string) => {
    setStatusMessage(null);
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
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao pagar fatura.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 11 • CARTÕES E FATURAS</Text>
      <Text style={styles.title}>
        Gestão de Cartões e Faturas ({filters.referenceYearMonth})
      </Text>
      <Text style={styles.subtitle}>
        Compras no cartão são contabilizadas por competência na categoria correspondente.
        Ao pagar a fatura, o valor sai do saldo da sua conta bancária no Fluxo de Caixa,
        sem duplicar os gastos do mês.
      </Text>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Cartões Ativos e Fatura do Mês */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Seus Cartões ({creditCards.length})
        </Text>
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
          const existingInv = cardInvoices.find(
            (i) =>
              i.credit_card_id === card.id &&
              i.reference_month === `${filters.referenceYearMonth}-01`,
          );

          return (
            <View key={card.id} style={styles.cardItem}>
              <Text style={styles.cardName}>
                {card.name} • Limite Total: {formatCurrencyBRL(card.credit_limit)}
              </Text>
              <Text style={styles.cardMeta}>
                Fechamento dia {card.closing_day} • Vencimento dia {card.due_day}
              </Text>
              <Text style={styles.cardMeta}>
                Gastos em {filters.referenceYearMonth}:{' '}
                {formatCurrencyBRL(currentSpend)} • Disponível:{' '}
                {formatCurrencyBRL(availableLimit)}
              </Text>
              <Text style={styles.cardMeta}>
                Status da Fatura: {existingInv?.status ?? 'open'}
              </Text>

              {existingInv?.status !== 'paid' && currentSpend > 0 ? (
                <Pressable
                  style={styles.payBtn}
                  onPress={() => void handlePayInvoice(card.id)}
                >
                  <Text style={styles.payBtnText}>
                    Registrar Pagamento da Fatura ({formatCurrencyBRL(currentSpend)})
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Novo Cartão */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadastrar Novo Cartão</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome do cartão (ex.: Nubank, Itaú Click)"
          placeholderTextColor="#64748B"
          value={cardName}
          onChangeText={setCardName}
        />
        <TextInput
          style={styles.input}
          placeholder="Limite de crédito em R$ (ex.: 4000)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={limitText}
          onChangeText={setLimitText}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Dia fechamento"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            value={closingDayText}
            onChangeText={setClosingDayText}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Dia vencimento"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            value={dueDayText}
            onChangeText={setDueDayText}
          />
        </View>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => void handleCreateCard()}
        >
          <Text style={styles.primaryBtnText}>Salvar Cartão</Text>
        </Pressable>
      </View>

      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    padding: 18,
    paddingTop: 44,
    paddingBottom: 60,
  },
  badge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
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
    marginBottom: 14,
  },
  statusBox: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cardName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  payBtn: {
    backgroundColor: '#38BDF8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  payBtnText: {
    color: '#082F49',
    fontWeight: '800',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 14,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
});
