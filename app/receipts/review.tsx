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
import {
  normalizeProductName,
  ParsedReceiptItemDraft,
} from '@/domain/receipts/nfce-parser';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { MeasurementUnitType } from '@/types/database.types';
import { formatCurrencyBRL, fromCents, toCents } from '@/utils/currency';

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>PASSO 7 E 8 • TELA DE REVISÃO DA NOTA</Text>
      <Text style={styles.title}>Revisar e Confirmar Nota Fiscal</Text>
      {pendingDraft?.statusMessage ? (
        <Text style={styles.infoBanner}>{pendingDraft.statusMessage}</Text>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dados do Estabelecimento e Emissão</Text>
        {pendingDraft?.accessKey ? (
          <Text style={styles.keyText}>Chave NFC-e: {pendingDraft.accessKey}</Text>
        ) : null}

        <Text style={styles.label}>Nome do Supermercado / Estabelecimento *</Text>
        <TextInput
          style={styles.input}
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="Ex.: Atakarejo Salvador, Hiperideal, Assaí"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Data da Compra (AAAA-MM-DD) *</Text>
        <TextInput
          style={styles.input}
          value={issuedDate}
          onChangeText={setIssuedDate}
          placeholder="2026-10-15"
          placeholderTextColor="#64748B"
        />
      </View>

      {/* Adicionar / Corrigir Item */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adicionar Produto à Nota</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome do produto (ex.: ARROZ TIPO 1 1KG)"
          placeholderTextColor="#64748B"
          value={itemName}
          onChangeText={setItemName}
        />
        <TextInput
          style={styles.input}
          placeholder="Código de barras EAN opcional (ex.: 7891000100103)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={itemEan}
          onChangeText={setItemEan}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Qtd</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={itemQtyText}
              onChangeText={setItemQtyText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Preço Unit. (R$)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor="#64748B"
              value={itemPriceText}
              onChangeText={setItemPriceText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Desc. Unit. (R$)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={itemDiscountText}
              onChangeText={setItemDiscountText}
            />
          </View>
        </View>

        <Text style={styles.label}>Unidade de Medida</Text>
        <View style={styles.chipsRow}>
          {(['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX'] as const).map((u) => {
            const active = itemUnit === u;
            return (
              <Pressable
                key={u}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setItemUnit(u)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {u}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.addBtn} onPress={handleAddItem}>
          <Text style={styles.addBtnText}>+ Incluir Item na Revisão</Text>
        </Pressable>
      </View>

      {/* Itens Revisados */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Itens da Nota ({items.length}) • Total Líquido:{' '}
          {formatCurrencyBRL(totalNetComputed)}
        </Text>
        {items.map((it) => (
          <View key={it.itemSequence} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.originalProductName}</Text>
              <Text style={styles.itemMeta}>
                {it.quantity} {it.measurementUnit} ×{' '}
                {formatCurrencyBRL(it.unitNetPricePaid)}
                {it.eanBarcode ? ` • EAN ${it.eanBarcode}` : ''}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatCurrencyBRL(it.totalNetPaid)}</Text>
            <Pressable
              style={styles.removeBtn}
              onPress={() => handleRemoveItem(it.itemSequence)}
            >
              <Text style={styles.removeBtnText}>Remover</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.confirmBtn}
        onPress={() => void handleConfirmReceipt()}
      >
        <Text style={styles.confirmBtnText}>
          Confirmar Nota e Atualizar Histórico de Preços
        </Text>
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
    marginBottom: 10,
  },
  infoBanner: {
    backgroundColor: '#0C4A6E',
    color: '#E0F2FE',
    padding: 12,
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
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
  keyText: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
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
    gap: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  addBtn: {
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#082F49',
    fontWeight: '800',
    fontSize: 13,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  itemTotal: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
  },
  removeBtn: {
    backgroundColor: '#450A0A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  removeBtnText: {
    color: '#FCA5A5',
    fontSize: 11,
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 15,
  },
});
