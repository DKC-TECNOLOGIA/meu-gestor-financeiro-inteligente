import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Check, Plus, ReceiptText, Trash2 } from 'lucide-react-native';
import {
  normalizeProductName,
  ParsedReceiptItemDraft,
} from '@/domain/receipts/nfce-parser';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { MeasurementUnitType } from '@/types/database.types';
import { formatCurrencyBRL, fromCents, toCents } from '@/utils/currency';
import {
  Amount,
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  InlineMessage,
  ListRow,
  Screen,
  Section,
  SectionHeader,
  spacing,
  TextField,
} from '@/ui';

export default function ReceiptReviewScreen() {
  const router = useRouter();
  const pendingDraft = useFinanceStore((s) => s.pendingReceiptDraft);
  const confirmAndSaveReceipt = useFinanceStore((s) => s.confirmAndSaveReceipt);

  const [merchantName, setMerchantName] = useState(
    pendingDraft?.merchantTradeName || pendingDraft?.merchantName || '',
  );
  const [issuedDate, setIssuedDate] = useState(
    pendingDraft?.issuedAt.slice(0, 10) ?? '2026-10-15',
  );
  const [items, setItems] = useState<ParsedReceiptItemDraft[]>(
    pendingDraft?.items ?? [],
  );

  // Novo item manual/correção
  const [itemName, setItemName] = useState('');
  const [itemEan, setItemEan] = useState('');
  const [itemQtyText, setItemQtyText] = useState('1');
  const [itemUnit, setItemUnit] = useState<MeasurementUnitType>('UN');
  const [itemPriceText, setItemPriceText] = useState('');
  const [itemDiscountText, setItemDiscountText] = useState('0');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddItem = () => {
    setErrorMessage(null);
    if (itemName.trim().length < 2) {
      setErrorMessage('Informe o nome do produto.');
      return;
    }
    const qty = Number(itemQtyText.replace(',', '.'));
    const grossUnit = Number(itemPriceText.replace(',', '.'));
    const discountUnit = Number(itemDiscountText.replace(',', '.')) || 0;

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(grossUnit) || grossUnit <= 0) {
      setErrorMessage('Informe quantidade e preço unitário maiores que zero.');
      return;
    }

    const netUnit = Math.max(0, Number((grossUnit - discountUnit).toFixed(4)));
    const totalNet = fromCents(toCents(netUnit * qty));

    const newItem: ParsedReceiptItemDraft = {
      itemSequence: items.length + 1,
      originalProductName: itemName.trim(),
      normalizedProductName: normalizeProductName(itemName),
      brand: null,
      eanBarcode: itemEan.trim() || null,
      quantity: qty,
      measurementUnit: itemUnit,
      unitGrossPrice: grossUnit,
      unitDiscountAmount: discountUnit,
      unitNetPricePaid: netUnit,
      totalNetPaid: totalNet,
      isReturned: false,
    };

    setItems((prev) => [...prev, newItem]);
    setItemName('');
    setItemEan('');
    setItemQtyText('1');
    setItemPriceText('');
    setItemDiscountText('0');
  };

  const handleRemoveItem = (seq: number) => {
    setItems((prev) =>
      prev
        .filter((it) => it.itemSequence !== seq)
        .map((it, idx) => ({ ...it, itemSequence: idx + 1 })),
    );
  };

  const totalNetComputed = fromCents(
    items.reduce((acc, it) => acc + toCents(it.totalNetPaid), 0),
  );

  const handleConfirmReceipt = async () => {
    setErrorMessage(null);
    if (merchantName.trim().length < 2) {
      setErrorMessage('Informe o nome do estabelecimento antes de confirmar.');
      return;
    }
    try {
      const saved = await confirmAndSaveReceipt({
        accessKey: pendingDraft?.accessKey ?? null,
        receiptNumber: pendingDraft?.receiptNumber ?? null,
        series: pendingDraft?.series ?? '1',
        issuerUf: pendingDraft?.issuerUf ?? 'BA',
        merchantName: merchantName.trim(),
        merchantTradeName: merchantName.trim(),
        merchantCnpj: pendingDraft?.merchantCnpj ?? null,
        issuedAt: `${issuedDate}T12:00:00.000Z`,
        totalGrossAmount: totalNetComputed,
        totalDiscountAmount: 0,
        totalPaidAmount: totalNetComputed,
        sourceType: pendingDraft?.sourceType ?? 'assisted_manual',
        qrCodeRawUrl: pendingDraft?.qrCodeRawUrl ?? null,
        requiresAssistedReview: false,
        statusMessage: 'Confirmada pelo usuário',
        items,
      });

      router.replace(`/receipts/${saved.receipt.id}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao salvar a nota fiscal.',
      );
    }
  };

  return (
    <Screen
      header={{
        title: 'Revisar e Confirmar Nota Fiscal',
        subtitle: 'Confira o estabelecimento e os itens antes de atualizar o histórico de preços.',
        showBack: true,
      }}
      footer={
        <Button
          label={`Confirmar Nota (${formatCurrencyBRL(totalNetComputed)})`}
          icon={Check}
          fullWidth
          onPress={() => void handleConfirmReceipt()}
        />
      }
    >
      {pendingDraft?.statusMessage ? (
        <InlineMessage
          tone="info"
          message={pendingDraft.statusMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="heading">Estabelecimento e Emissão</AppText>
          {pendingDraft?.issuerUf ? (
            <Badge tone="brand" label={`UF ${pendingDraft.issuerUf}`} />
          ) : null}
        </View>
        {pendingDraft?.accessKey ? (
          <AppText variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
            Chave NFC-e: {pendingDraft.accessKey}
          </AppText>
        ) : null}

        <TextField
          label="Nome do Supermercado / Estabelecimento *"
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="Ex.: Atakarejo Salvador, Hiperideal, Assaí"
        />

        <TextField
          label="Data da Compra (AAAA-MM-DD) *"
          value={issuedDate}
          onChangeText={setIssuedDate}
          placeholder="2026-10-15"
        />
      </Card>

      {/* Adicionar / Corrigir Item */}
      <Section>
        <SectionHeader
          title="Adicionar Produto à Nota"
          description="Informe descrição, unidade e preço unitário."
        />
        <Card style={{ gap: spacing.md }}>
          <TextField
            label="Nome do produto *"
            placeholder="Ex.: ARROZ TIPO 1 1KG"
            value={itemName}
            onChangeText={setItemName}
          />
          <TextField
            label="Código de barras EAN (opcional)"
            placeholder="Ex.: 7891000100103"
            keyboardType="numeric"
            value={itemEan}
            onChangeText={setItemEan}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Qtd"
                keyboardType="numeric"
                value={itemQtyText}
                onChangeText={setItemQtyText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Preço Unit."
                prefix="R$"
                keyboardType="numeric"
                placeholder="0,00"
                value={itemPriceText}
                onChangeText={setItemPriceText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Desc. Unit."
                prefix="R$"
                keyboardType="numeric"
                value={itemDiscountText}
                onChangeText={setItemDiscountText}
              />
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="label" tone="secondary">
              Unidade de medida
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX'] as const).map((u) => (
                <Chip
                  key={u}
                  label={u}
                  selected={itemUnit === u}
                  onPress={() => setItemUnit(u)}
                />
              ))}
            </View>
          </View>

          <Button
            label="Incluir Item na Revisão"
            icon={Plus}
            variant="secondary"
            fullWidth
            onPress={handleAddItem}
          />
        </Card>
      </Section>

      {/* Itens Revisados */}
      <Section>
        <SectionHeader
          title={`Itens da Nota (${items.length})`}
          description={`Total líquido: ${formatCurrencyBRL(totalNetComputed)}`}
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {items.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Nenhum item na nota ainda"
              description="Adicione pelo menos 1 produto acima antes de confirmar a nota."
            />
          ) : (
            items.map((it, idx) => (
              <View key={it.itemSequence}>
                {idx > 0 ? <Divider /> : null}
                <ListRow
                  title={it.originalProductName}
                  subtitle={`${it.quantity} ${it.measurementUnit} × ${formatCurrencyBRL(it.unitNetPricePaid)}${it.eanBarcode ? ` · EAN ${it.eanBarcode}` : ''}`}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Amount value={it.totalNetPaid} />
                      <IconButton
                        icon={Trash2}
                        size={32}
                        variant="danger"
                        accessibilityLabel={`Remover ${it.originalProductName}`}
                        onPress={() => handleRemoveItem(it.itemSequence)}
                      />
                    </View>
                  }
                />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}
