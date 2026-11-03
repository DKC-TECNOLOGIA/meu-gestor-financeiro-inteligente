import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BarChart3, ReceiptText } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';
import {
  Amount,
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ListRow,
  Screen,
  Section,
  SectionHeader,
  spacing,
} from '@/ui';

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
      <Screen header={{ title: 'Detalhes da Nota Fiscal', showBack: true }}>
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="Nota Fiscal não localizada"
            description="Verifique se a nota foi confirmada no histórico."
            actionLabel="Voltar"
            onAction={() => router.back()}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={{
        title: receipt.merchant_trade_name || receipt.merchant_name,
        subtitle: `Emitida em ${formatDateBR(receipt.issued_at.slice(0, 10))} · UF: ${receipt.issuer_uf}`,
        showBack: true,
      }}
      footer={
        <Button
          label="Abrir Comparação de Preços"
          icon={BarChart3}
          fullWidth
          onPress={() => router.push('/receipts/price-comparison')}
        />
      }
    >
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="heading">Identificação Fiscal</AppText>
          <Badge tone="positive" label={receipt.status.toUpperCase()} />
        </View>
        <AppText variant="caption" tone="secondary">
          CNPJ: {receipt.merchant_cnpj ?? 'Não informado'}
        </AppText>
        <AppText variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          Chave de Acesso: {receipt.access_key ?? 'Lançamento assistido sem chave'}
        </AppText>
        <AppText variant="caption" tone="secondary">
          Número / Série: {receipt.receipt_number ?? '-'} / {receipt.series ?? '-'}
        </AppText>
        <AppText variant="caption" tone="secondary">
          Desconto Total: {formatCurrencyBRL(receipt.total_discount_amount)}
        </AppText>
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xs }}>
          <AppText variant="bodyStrong">Valor Líquido Pago</AppText>
          <Amount value={receipt.total_paid_amount} variant="amountLarge" tone="positive" />
        </View>
      </Card>

      <Section>
        <SectionHeader
          title={`Itens da Nota (${items.length})`}
          description="Preços normalizados por unidade base compatível."
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {items.map((it, idx) => (
            <View key={it.id}>
              {idx > 0 ? <Divider /> : null}
              <ListRow
                title={it.original_product_name}
                subtitle={`${it.quantity} ${it.measurement_unit} × ${formatCurrencyBRL(it.unit_net_price_paid)} · Base/${it.normalized_base_unit}: ${formatCurrencyBRL(it.normalized_price_per_base_unit ?? it.unit_net_price_paid)}`}
                trailing={<Amount value={it.total_net_paid} />}
              />
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
