import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  areUnitsCompatible,
  compareCatalogPricesByMonth,
} from '@/domain/price-comparison/price-analyzer';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL } from '@/utils/currency';

function getPreviousYearMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0] ?? 2026);
  const month = Number(parts[1] ?? 10);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export default function PriceComparisonScreen() {
  const router = useRouter();
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const productCatalog = useFinanceStore((s) => s.productCatalog);
  const filters = useFinanceStore((s) => s.filters);
  const linkEquivalentProducts = useFinanceStore((s) => s.linkEquivalentProducts);

  const [selectedProdIds, setSelectedProdIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const previousYearMonth = useMemo(
    () => getPreviousYearMonth(filters.referenceYearMonth),
    [filters.referenceYearMonth],
  );

  const comparisons = useMemo(
    () =>
      compareCatalogPricesByMonth(
        receiptItems,
        productCatalog,
        filters.referenceYearMonth,
        previousYearMonth,
      ),
    [receiptItems, productCatalog, filters.referenceYearMonth, previousYearMonth],
  );

  const toggleProductSelection = (id: string) => {
    setSelectedProdIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleLinkSelected = async () => {
    setStatusMessage(null);
    if (selectedProdIds.length < 2) {
      setStatusMessage(
        'Selecione pelo menos 2 produtos compatíveis abaixo para vincular como equivalentes.',
      );
      return;
    }

    const selectedProds = productCatalog.filter((p) =>
      selectedProdIds.includes(p.id),
    );
    const firstUnit = selectedProds[0]?.measurement_unit;
    const allCompatible = selectedProds.every(
      (p) => firstUnit && areUnitsCompatible(firstUnit, p.measurement_unit),
    );

    if (!allCompatible) {
      setStatusMessage(
        'Não é permitido associar produtos com unidades de medida incompatíveis (ex.: KG com L).',
      );
      return;
    }

    try {
      await linkEquivalentProducts(selectedProdIds);
      setSelectedProdIds([]);
      setStatusMessage(
        'Produtos associados como equivalentes com sucesso! O comparativo histórico foi recalculado.',
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao associar produtos.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 10 • CATÁLOGO E COMPARAÇÃO DE PREÇOS</Text>
      <Text style={styles.title}>
        Variação de Preços ({previousYearMonth} → {filters.referenceYearMonth})
      </Text>
      <Text style={styles.subtitle}>
        Comparamos apenas unidades compatíveis (normalizando G para KG e ML para L).
        Quando não há compras nos dois meses, exibimos &quot;sem dados
        suficientes&quot;.
      </Text>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Resultados da Comparação Mensal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Produtos Analisados ({comparisons.length})
        </Text>
        {comparisons.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum item de nota fiscal registrado ainda. Importe uma NFC-e para comparar
            preços entre meses e estabelecimentos.
          </Text>
        ) : (
          comparisons.map((comp) => {
            const deltaColor =
              !comp.hasSufficientHistory || comp.absoluteDelta == null
                ? '#94A3B8'
                : comp.absoluteDelta > 0
                  ? '#F87171'
                  : comp.absoluteDelta < 0
                    ? '#34D399'
                    : '#E2E8F0';

            return (
              <View key={comp.comparisonGroupKey} style={styles.compItem}>
                <View style={styles.compHeader}>
                  <Text style={styles.compName}>
                    {comp.productDisplayName} ({comp.baseUnit})
                  </Text>
                  <Text style={[styles.compBadge, { color: deltaColor }]}>
                    {comp.statusLabel}
                  </Text>
                </View>

                <Text style={styles.compMeta}>
                  Mês anterior ({previousYearMonth}):{' '}
                  {comp.previousMonthAvgPrice != null
                    ? formatCurrencyBRL(comp.previousMonthAvgPrice)
                    : 'Sem registro'}{' '}
                  • Mês atual ({filters.referenceYearMonth}):{' '}
                  {comp.currentMonthAvgPrice != null
                    ? formatCurrencyBRL(comp.currentMonthAvgPrice)
                    : 'Sem registro'}
                </Text>

                {comp.hasSufficientHistory && comp.absoluteDelta != null ? (
                  <Text style={styles.compMeta}>
                    Variação em reais:{' '}
                    {comp.absoluteDelta >= 0 ? '+' : ''}
                    {formatCurrencyBRL(comp.absoluteDelta)} por {comp.baseUnit}
                  </Text>
                ) : null}

                <Text style={styles.compExtremes}>
                  Menor preço: {formatCurrencyBRL(comp.minObservedPrice)} (
                  {comp.minPriceMerchant}) • Maior preço:{' '}
                  {formatCurrencyBRL(comp.maxObservedPrice)} ({comp.maxPriceMerchant})
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Associação Manual de Produtos Equivalentes (Seção 7) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Associar Produtos Equivalentes Manualmente
        </Text>
        <Text style={styles.subtitle}>
          Se o mesmo produto veio com descrições abreviadas diferentes em dois
          supermercados, selecione-os abaixo para unificar o histórico:
        </Text>

        <View style={styles.chipsRow}>
          {productCatalog.map((prod) => {
            const selected = selectedProdIds.includes(prod.id);
            return (
              <Pressable
                key={prod.id}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => toggleProductSelection(prod.id)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {prod.normalized_name} ({prod.measurement_unit})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.linkBtn}
          onPress={() => void handleLinkSelected()}
        >
          <Text style={styles.linkBtnText}>
            Vincular Selecionados como Produto Equivalente
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Voltar ao Leitor de Notas</Text>
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
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 21,
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
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  compItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  compBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  compMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  compExtremes: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#082F49',
    fontWeight: '800',
  },
  linkBtn: {
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  linkBtnText: {
    color: '#082F49',
    fontWeight: '800',
    fontSize: 13,
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
