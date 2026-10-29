import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { buildFinancialExcelWorkbook } from '@/domain/xlsx/excel-exporter';
import { useFinanceStore } from '@/features/finance/use-finance-store';

export default function ExportScreen() {
  const router = useRouter();
  const profile = useFinanceStore((s) => s.profile);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardInvoices = useFinanceStore((s) => s.cardInvoices);
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const financialGoals = useFinanceStore((s) => s.financialGoals);
  const filters = useFinanceStore((s) => s.filters);

  const [periodStart, setPeriodStart] = useState(
    `${filters.referenceYearMonth}-01`,
  );
  const [periodEnd, setPeriodEnd] = useState(
    `${filters.referenceYearMonth}-31`,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerateXlsx = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const result = buildFinancialExcelWorkbook({
        periodStart,
        periodEnd,
        referenceYearMonth: filters.referenceYearMonth,
        userDisplayName: profile?.display_name ?? 'Titular',
        categories,
        transactions,
        creditCards,
        cardInvoices,
        receipts,
        receiptItems,
        financialGoals,
      });

      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${result.fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, result.base64Content, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Relatório Financeiro (XLSX)',
          });
        }
      }

      setStatusMessage(
        `Relatório ${result.fileName} gerado com sucesso contendo as ${result.sheetNames.length} abas oficiais!`,
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao exportar arquivo Excel.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 15 • EXPORTAÇÃO PARA EXCEL</Text>
      <Text style={styles.title}>Exportar Relatório Completo (.XLSX)</Text>
      <Text style={styles.subtitle}>
        Gera uma planilha Excel real com cabeçalhos, datas brasileiras, valores
        monetários (R$) e totais nas 9 abas padronizadas, contendo exclusivamente seus
        dados autorizados e sem expor credenciais.
      </Text>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seleção de Período</Text>

        <Text style={styles.label}>Data Inicial (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={periodStart}
          onChangeText={setPeriodStart}
          placeholder="2026-10-01"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Data Final (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={periodEnd}
          onChangeText={setPeriodEnd}
          placeholder="2026-10-31"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.sheetsTitle}>Abas incluídas no arquivo .XLSX:</Text>
        <Text style={styles.sheetItem}>1. Resumo financeiro</Text>
        <Text style={styles.sheetItem}>2. Receitas</Text>
        <Text style={styles.sheetItem}>3. Despesas</Text>
        <Text style={styles.sheetItem}>4. Categorias</Text>
        <Text style={styles.sheetItem}>5. Compras e notas fiscais</Text>
        <Text style={styles.sheetItem}>6. Itens e histórico de preços</Text>
        <Text style={styles.sheetItem}>7. Cartões e faturas</Text>
        <Text style={styles.sheetItem}>8. Metas financeiras</Text>
        <Text style={styles.sheetItem}>9. Evolução mensal</Text>

        <Pressable
          accessibilityRole="button"
          style={styles.primaryBtn}
          onPress={() => void handleGenerateXlsx()}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#052E16" />
          ) : (
            <Text style={styles.primaryBtnText}>
              Exportar e Baixar Planilha XLSX
            </Text>
          )}
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
  label: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
  },
  sheetsTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6,
  },
  sheetItem: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 3,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
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
