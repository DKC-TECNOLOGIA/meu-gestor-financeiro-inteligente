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
import { formatCurrencyBRL } from '@/utils/currency';

export default function ProfileAndExportScreen() {
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

  const [periodStart, setPeriodStart] = useState(`${filters.referenceYearMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${filters.referenceYearMonth}-31`);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportStatus(null);
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
        setExportStatus(
          `Arquivo ${result.fileName} gerado com sucesso (${result.sheetNames.length} abas)!`,
        );
      } else {
        setExportStatus(
          `Planilha ${result.fileName} gerada com ${result.sheetNames.length} abas (${result.sheetNames.join(', ')}).`,
        );
      }
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Erro ao gerar planilha Excel.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Perfil, Privacidade e Exportação XLSX</Text>
      <Text style={styles.subtitle}>
        Gerencie suas informações de cadastro, objetivos e exporte seus dados
        financeiros completos para Excel (.xlsx).
      </Text>

      {/* Resumo do Perfil */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dados do Titular</Text>
        <Text style={styles.infoRow}>
          Nome: <Text style={styles.infoValue}>{profile?.display_name ?? '-'}</Text>
        </Text>
        <Text style={styles.infoRow}>
          E-mail: <Text style={styles.infoValue}>{profile?.email ?? '-'}</Text>
        </Text>
        <Text style={styles.infoRow}>
          Objetivo principal:{' '}
          <Text style={styles.infoValue}>{profile?.primary_objective ?? '-'}</Text>
        </Text>
        <Text style={styles.infoRow}>
          Renda mensal informada:{' '}
          <Text style={styles.infoValue}>
            {profile?.monthly_net_income != null
              ? formatCurrencyBRL(profile.monthly_net_income)
              : 'Não informada (opcional)'}
          </Text>
        </Text>
        <Text style={styles.infoRow}>
          Reserva atual:{' '}
          <Text style={styles.infoValue}>
            {profile?.current_emergency_fund != null
              ? formatCurrencyBRL(profile.current_emergency_fund)
              : 'Não informada (opcional)'}
          </Text>
        </Text>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/onboarding')}
        >
          <Text style={styles.secondaryBtnText}>
            Editar Objetivos e Dados do Onboarding
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/cards')}
        >
          <Text style={styles.secondaryBtnText}>
            Gerenciar Cartões de Crédito e Faturas
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/open-finance')}
        >
          <Text style={styles.secondaryBtnText}>
            Integração Bancária (Open Finance Brasil)
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/export')}
        >
          <Text style={styles.secondaryBtnText}>
            Abrir Tela Dedicada de Exportação (.XLSX)
          </Text>
        </Pressable>
      </View>

      {/* Exportação Real para Excel (Seção 10) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exportação para Excel (.XLSX)</Text>
        <Text style={styles.cardDesc}>
          Gera um arquivo XLSX real contendo as 9 abas padronizadas: Resumo financeiro,
          Receitas, Despesas, Categorias, Compras e notas fiscais, Itens e histórico de
          preços, Cartões e faturas, Metas financeiras e Evolução mensal.
        </Text>

        <Text style={styles.label}>Data inicial do período (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={periodStart}
          onChangeText={setPeriodStart}
          placeholder="2026-10-01"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Data final do período (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={periodEnd}
          onChangeText={setPeriodEnd}
          placeholder="2026-10-31"
          placeholderTextColor="#64748B"
        />

        {exportStatus ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{exportStatus}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={styles.primaryBtn}
          onPress={() => void handleExportExcel()}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#052E16" />
          ) : (
            <Text style={styles.primaryBtnText}>Gerar e Compartilhar Excel (.XLSX)</Text>
          )}
        </Pressable>
      </View>
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
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  infoRow: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 6,
  },
  infoValue: {
    color: '#F8FAFC',
    fontWeight: '700',
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
  statusBox: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  statusText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
});
