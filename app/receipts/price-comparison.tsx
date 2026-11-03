import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart3, Link2 } from 'lucide-react-native';
import {
  areUnitsCompatible,
  compareCatalogPricesByMonth,
} from '@/domain/price-comparison/price-analyzer';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  InlineMessage,
  MonthSwitcher,
  Screen,
  Section,
  SectionHeader,
  spacing,
} from '@/ui';

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
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const productCatalog = useFinanceStore((s) => s.productCatalog);
  const filters = useFinanceStore((s) => s.filters);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const linkEquivalentProducts = useFinanceStore((s) => s.linkEquivalentProducts);

  const [selectedProdIds, setSelectedProdIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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
    setIsError(false);
    if (selectedProdIds.length < 2) {
      setIsError(true);
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
      setIsError(true);
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
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao associar produtos.',
      );
    }
  };

  return (
    <Screen
      header={{
        title: 'Comparação de Preços',
        subtitle: `Variação entre ${previousYearMonth} e ${filters.referenceYearMonth} apenas entre unidades compatíveis (KG↔G, L↔ML, UN).`,
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

      {/* Resultados da Comparação Mensal */}
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {comparisons.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nenhum item de nota fiscal registrado ainda"
            description="Importe uma NFC-e para comparar preços entre meses e estabelecimentos."
          />
        ) : (
          comparisons.map((comp, idx) => {
            const badgeTone =
              !comp.hasSufficientHistory || comp.absoluteDelta == null
                ? 'neutral'
                : comp.absoluteDelta > 0
                  ? 'negative'
                  : comp.absoluteDelta < 0
                    ? 'positive'
                    : 'brand';

            return (
              <View key={comp.comparisonGroupKey}>
                {idx > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: spacing.md, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>
                      {comp.productDisplayName} ({comp.baseUnit})
                    </AppText>
                    <Badge tone={badgeTone} label={comp.statusLabel} />
                  </View>

                  <AppText variant="caption" tone="secondary">
                    Mês anterior ({previousYearMonth}):{' '}
                    {comp.previousMonthAvgPrice != null
                      ? formatCurrencyBRL(comp.previousMonthAvgPrice)
                      : 'Sem registro'}{' '}
                    · Mês atual ({filters.referenceYearMonth}):{' '}
                    {comp.currentMonthAvgPrice != null
                      ? formatCurrencyBRL(comp.currentMonthAvgPrice)
                      : 'Sem registro'}
                  </AppText>

                  {comp.hasSufficientHistory && comp.absoluteDelta != null ? (
                    <AppText
                      variant="caption"
                      tone={comp.absoluteDelta > 0 ? 'negative' : comp.absoluteDelta < 0 ? 'positive' : 'secondary'}
                    >
                      Variação em reais: {comp.absoluteDelta >= 0 ? '+' : ''}
                      {formatCurrencyBRL(comp.absoluteDelta)} por {comp.baseUnit}
                    </AppText>
                  ) : null}

                  <AppText variant="caption" tone="tertiary">
                    Menor preço: {formatCurrencyBRL(comp.minObservedPrice)} ({comp.minPriceMerchant}) · Maior preço:{' '}
                    {formatCurrencyBRL(comp.maxObservedPrice)} ({comp.maxPriceMerchant})
                  </AppText>
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* Associação Manual de Produtos Equivalentes */}
      <Section>
        <SectionHeader
          title="Associar Produtos Equivalentes"
          description="Se o mesmo produto veio com descrições abreviadas diferentes em dois mercados, selecione-os abaixo para unificar o histórico."
        />
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {productCatalog.map((prod) => (
              <Chip
                key={prod.id}
                label={`${prod.normalized_name} (${prod.measurement_unit})`}
                selected={selectedProdIds.includes(prod.id)}
                onPress={() => toggleProductSelection(prod.id)}
              />
            ))}
          </View>

          <Button
            label="Vincular Selecionados como Equivalentes"
            icon={Link2}
            variant="secondary"
            fullWidth
            onPress={() => void handleLinkSelected()}
          />
        </Card>
      </Section>
    </Screen>
  );
}
