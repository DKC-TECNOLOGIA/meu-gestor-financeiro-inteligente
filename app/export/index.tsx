import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, View } from 'react-native';
import { Check, FileSpreadsheet } from 'lucide-react-native';
import { buildFinancialExcelWorkbook } from '@/domain/xlsx/excel-exporter';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  InlineMessage,
  Screen,
  Section,
  SectionHeader,
  spacing,
  TextField,
  useThemeColors,
} from '@/ui';

const OFFICIAL_SHEETS = [
  '1. Resumo financeiro',
  '2. Receitas',
  '3. Despesas',
  '4. Categorias',
  '5. Compras e notas fiscais',
  '6. Itens e histórico de preços',
  '7. Cartões e faturas',
  '8. Metas financeiras',
  '9. Evolução mensal',
];

export default function ExportScreen() {
  const c = useThemeColors();
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
  const [isError, setIsError] = useState(false);

  const handleGenerateXlsx = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    setIsError(false);
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
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao exportar arquivo Excel.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Screen
      header={{
        title: 'Exportar para Excel (.XLSX)',
        subtitle:
          'Planilha real com cabeçalhos, datas brasileiras, valores monetários (R$) e totais nas 9 abas padronizadas.',
        showBack: true,
      }}
      footer={
        <Button
          label="Exportar e Baixar Planilha XLSX"
          icon={FileSpreadsheet}
          loading={isExporting}
          fullWidth
          onPress={() => void handleGenerateXlsx()}
        />
      }
    >
      {statusMessage ? (
        <InlineMessage
          tone={isError ? 'danger' : 'success'}
          message={statusMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="heading">Seleção de Período</AppText>
          <Badge tone="brand" label="PORTABILIDADE LGPD" />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Data Inicial (AAAA-MM-DD)"
              value={periodStart}
              onChangeText={setPeriodStart}
              placeholder="2026-10-01"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Data Final (AAAA-MM-DD)"
              value={periodEnd}
              onChangeText={setPeriodEnd}
              placeholder="2026-10-31"
            />
          </View>
        </View>
      </Card>

      <Section>
        <SectionHeader
          title="Abas Incluídas no Arquivo .XLSX"
          description="Contém exclusivamente os seus dados autorizados, sem expor credenciais."
        />
        <Card style={{ gap: spacing.sm }}>
          {OFFICIAL_SHEETS.map((sheet, idx) => (
            <View key={sheet}>
              {idx > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                <Check color={c.brand} size={16} />
                <AppText variant="body">{sheet}</AppText>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
