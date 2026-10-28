import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  OpenFinanceScope,
  SUPPORTED_OPEN_FINANCE_INSTITUTIONS,
} from '@/domain/open-finance/open-finance-provider';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';

export default function OpenFinanceScreen() {
  const router = useRouter();
  const bankConnections = useFinanceStore((s) => s.bankConnections);
  const bankTransactions = useFinanceStore((s) => s.bankTransactions);
  const categories = useFinanceStore((s) => s.categories);
  const authorizeConsent = useFinanceStore(
    (s) => s.authorizeBankConnectionConsent,
  );
  const reconcileTx = useFinanceStore(
    (s) => s.reconcileAndImportBankTransaction,
  );
  const revokeConsent = useFinanceStore((s) => s.revokeBankConnectionConsent);

  const [selectedIspb, setSelectedIspb] = useState(
    SUPPORTED_OPEN_FINANCE_INSTITUTIONS[0]?.ispb ?? '00000000',
  );
  const [scopeAccounts, setScopeAccounts] = useState(true);
  const [scopeTransactions, setScopeTransactions] = useState(true);
  const [scopeCards, setScopeCards] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAuthorizeConsent = async () => {
    setStatusMessage(null);
    const inst = SUPPORTED_OPEN_FINANCE_INSTITUTIONS.find(
      (i) => i.ispb === selectedIspb,
    );
    if (!inst) return;

    const scopes: OpenFinanceScope[] = [];
    if (scopeAccounts) scopes.push('accounts');
    if (scopeTransactions) scopes.push('transactions');
    if (scopeCards) scopes.push('credit_cards');

    try {
      await authorizeConsent({
        providerName: 'pluggy',
        institutionName: inst.name,
        institutionIspb: inst.ispb,
        grantedScopes: scopes,
      });
      setStatusMessage(
        `Consentimento registrado para ${inst.name}. Para sincronizar dados bancários reais em produção, configure as credenciais do provedor na Edge Function open-finance-sync.`,
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao autorizar consentimento Open Finance.',
      );
    }
  };

  const handleConfirmRevoke = (connId: string, instName: string) => {
    Alert.alert(
      'Revogar Consentimento Open Finance',
      `Deseja encerrar e revogar imediatamente o compartilhamento de dados com ${instName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar Agora',
          style: 'destructive',
          onPress: () => {
            void revokeConsent(connId);
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 16 • OPEN FINANCE BRASIL</Text>
      <Text style={styles.title}>Integração Bancária Autorizada</Text>
      <Text style={styles.securityBanner}>
        Segurança e Privacidade: Nunca solicitamos nem armazenamos senhas bancárias. O
        consentimento segue o padrão oficial do Open Finance Brasil, com escopos
        explícitos e revogação a qualquer momento. A cobertura de Pix e cartões depende
        da disponibilidade oficial de cada instituição participante.
      </Text>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Passo 1, 2 e 3: Escolher Instituição e Consentir Escopos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          1. Conectar Instituição Participante
        </Text>
        <View style={styles.chipsRow}>
          {SUPPORTED_OPEN_FINANCE_INSTITUTIONS.map((inst) => {
            const active = selectedIspb === inst.ispb;
            return (
              <Pressable
                key={inst.ispb}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedIspb(inst.ispb)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {inst.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.subLabel}>
          Escopos de dados autorizados explicitamente:
        </Text>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeText}>Saldos e Contas (`accounts`)</Text>
          <Switch value={scopeAccounts} onValueChange={setScopeAccounts} />
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeText}>
            Extrato e Transações Pix/Débito (`transactions`)
          </Text>
          <Switch
            value={scopeTransactions}
            onValueChange={setScopeTransactions}
          />
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeText}>
            Faturas de Cartão de Crédito (`credit_cards`)
          </Text>
          <Switch value={scopeCards} onValueChange={setScopeCards} />
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => void handleAuthorizeConsent()}
        >
          <Text style={styles.primaryBtnText}>
            Iniciar Fluxo Seguro de Consentimento
          </Text>
        </Pressable>
      </View>

      {/* Passo 8: Consultar e Revogar Conexões */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          2. Conexões e Consentimentos ({bankConnections.length})
        </Text>
        {bankConnections.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma conexão bancária ativa no momento.
          </Text>
        ) : (
          bankConnections.map((conn) => (
            <View key={conn.id} style={styles.connRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.connName}>{conn.institution_name}</Text>
                <Text style={styles.connMeta}>
                  Provedor: {conn.provider_name} • Status: {conn.status}
                </Text>
                <Text style={styles.connMeta}>
                  Escopos: {conn.granted_scopes.join(', ')}
                </Text>
                {conn.consent_expires_at ? (
                  <Text style={styles.connMeta}>
                    Válido até: {formatDateBR(conn.consent_expires_at.slice(0, 10))}
                  </Text>
                ) : null}
              </View>
              {conn.status === 'active' ? (
                <Pressable
                  style={styles.revokeBtn}
                  onPress={() =>
                    handleConfirmRevoke(conn.id, conn.institution_name)
                  }
                >
                  <Text style={styles.revokeBtnText}>Revogar</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Passo 5, 6 e 7: Revisão e Conciliação de Transações Sincronizadas */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          3. Revisão e Conciliação de Transações ({bankTransactions.length})
        </Text>
        {bankTransactions.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma transação pendente de conciliação.
          </Text>
        ) : (
          bankTransactions.map((btx) => {
            const suggestedCat = categories.find(
              (c) => c.id === btx.suggested_category_id,
            );
            return (
              <View key={btx.id} style={styles.connRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connName}>
                    {btx.normalized_description}
                  </Text>
                  <Text style={styles.connMeta}>
                    {formatDateBR(btx.occurred_at.slice(0, 10))} •{' '}
                    {formatCurrencyBRL(btx.amount)} ({btx.direction}) • Categoria
                    sugerida: {suggestedCat?.name ?? 'Geral'}
                  </Text>
                  <Text style={styles.connMeta}>
                    Status: {btx.reconciliation_status}
                  </Text>
                </View>
                {btx.reconciliation_status === 'pending_review' ? (
                  <Pressable
                    style={styles.importBtn}
                    onPress={() => void reconcileTx(btx.id)}
                  >
                    <Text style={styles.importBtnText}>Confirmar</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
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
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  securityBanner: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    marginBottom: 16,
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
    marginBottom: 12,
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
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#052E16',
    fontWeight: '800',
  },
  subLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  scopeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scopeText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  connRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  connName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  connMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  revokeBtn: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  revokeBtnText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  importBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  importBtnText: {
    color: '#082F49',
    fontSize: 12,
    fontWeight: '800',
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
