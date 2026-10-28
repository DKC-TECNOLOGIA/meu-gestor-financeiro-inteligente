import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';

export default function ReceiptDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);

  const receipt = useMemo(
    () => receipts.find((r) => r.id === id),
    [receipts, id],
  );

  const items = useMemo(
    () => receiptItems.filter((it) => it.receipt_id === id),
    [receiptItems, id],
  );

  if (!receipt) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.title}>Nota Fiscal não localizada</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 9 • DETALHES DA NOTA FISCAL</Text>
      <Text style={styles.title}>
        {receipt.merchant_trade_name || receipt.merchant_name}
      </Text>
      <Text style={styles.subtitle}>
        Emitida em {formatDateBR(receipt.issued_at.slice(0, 10))} • UF:{' '}
        {receipt.issuer_uf} • Status: {receipt.status}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Identificação Fiscal</Text>
        <Text style={styles.metaText}>
          CNPJ: {receipt.merchant_cnpj ?? 'Não informado'}
        </Text>
        <Text style={styles.metaText}>
          Chave de Acesso: {receipt.access_key ?? 'Lançamento assistido sem chave'}
        </Text>
        <Text style={styles.metaText}>
          Número / Série: {receipt.receipt_number ?? '-'} / {receipt.series ?? '-'}
        </Text>
        <Text style={styles.metaText}>
          Desconto Total: {formatCurrencyBRL(receipt.total_discount_amount)}
        </Text>
        <Text style={styles.totalPaid}>
          Valor Líquido Pago: {formatCurrencyBRL(receipt.total_paid_amount)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Itens da Nota ({items.length})</Text>
        {items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.original_product_name}</Text>
              <Text style={styles.itemSub}>
                Normalizado: {it.normalized_product_name}
              </Text>
              <Text style={styles.itemSub}>
                {it.quantity} {it.measurement_unit} ×{' '}
                {formatCurrencyBRL(it.unit_net_price_paid)} (Preço base/{it.normalized_base_unit}:{' '}
                {formatCurrencyBRL(it.normalized_price_per_base_unit ?? it.unit_net_price_paid)})
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatCurrencyBRL(it.total_net_paid)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
        <Pressable
          style={styles.compareBtn}
          onPress={() => router.push('/receipts/price-comparison')}
        >
          <Text style={styles.compareBtnText}>Abrir Comparação de Preços</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
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
    marginBottom: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
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
  metaText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 4,
  },
  totalPaid: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  itemTotal: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    flex: 1,
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
  compareBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  compareBtnText: {
    color: '#052E16',
    fontWeight: '800',
  },
});
