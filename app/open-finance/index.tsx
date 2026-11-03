import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Check, Landmark, ShieldCheck } from 'lucide-react-native';
import {
  OpenFinanceScope,
  SUPPORTED_OPEN_FINANCE_INSTITUTIONS,
} from '@/domain/open-finance/open-finance-provider';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  InlineMessage,
  ListRow,
  Screen,
  Section,
  SectionHeader,
  spacing,
  useThemeColors,
} from '@/ui';

export default function OpenFinanceScreen() {
  const c = useThemeColors();
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
  const [isError, setIsError] = useState(false);

  const handleAuthorizeConsent = async () => {
    setStatusMessage(null);
    setIsError(false);
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
      setIsError(true);
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
    <Screen
      header={{
        title: 'Open Finance Brasil',
        subtitle:
          'Consentimento explícito por escopo, conciliação assistida e revogação imediata.',
        showBack: true,
      }}
    >
      <InlineMessage
        tone="info"
        title="Segurança e Privacidade Bancária"
        message="Nunca solicitamos nem armazenamos senhas bancárias. O consentimento segue o padrão oficial do Open Finance Brasil, com escopos explícitos e revogação a qualquer momento."
        style={{ marginBottom: spacing.lg }}
      />

      {statusMessage ? (
        <InlineMessage
          tone={isError ? 'danger' : 'success'}
          message={statusMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* Passo 1, 2 e 3: Escolher Instituição e Consentir Escopos */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="heading">1. Conectar Instituição Participante</AppText>
          <Badge tone="brand" label="OAUTH2 / FAPI" />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SUPPORTED_OPEN_FINANCE_INSTITUTIONS.map((inst) => (
            <Chip
              key={inst.ispb}
              label={inst.name}
              selected={selectedIspb === inst.ispb}
              onPress={() => setSelectedIspb(inst.ispb)}
            />
          ))}
        </View>

        <Divider />

        <AppText variant="label" tone="secondary">
          Escopos de dados autorizados explicitamente:
        </AppText>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="body">Saldos e Contas (accounts)</AppText>
          <Switch
            value={scopeAccounts}
            onValueChange={setScopeAccounts}
            trackColor={{ false: c.borderStrong, true: c.brand }}
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="body">Extrato e Pix/Débito (transactions)</AppText>
          <Switch
            value={scopeTransactions}
            onValueChange={setScopeTransactions}
            trackColor={{ false: c.borderStrong, true: c.brand }}
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="body">Faturas de Cartão (credit_cards)</AppText>
          <Switch
            value={scopeCards}
            onValueChange={setScopeCards}
            trackColor={{ false: c.borderStrong, true: c.brand }}
          />
        </View>

        <Button
          label="Iniciar Fluxo Seguro de Consentimento"
          icon={ShieldCheck}
          fullWidth
          onPress={() => void handleAuthorizeConsent()}
        />
      </Card>

      {/* Passo 8: Consultar e Revogar Conexões */}
      <Section>
        <SectionHeader
          title={`2. Conexões e Consentimentos (${bankConnections.length})`}
          description="Gerencie ou revogue seus consentimentos ativos."
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {bankConnections.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Nenhuma conexão bancária ativa"
              description="Selecione uma instituição acima para registrar o consentimento Open Finance."
            />
          ) : (
            bankConnections.map((conn, idx) => (
              <View key={conn.id}>
                {idx > 0 ? <Divider /> : null}
                <ListRow
                  title={conn.institution_name}
                  subtitle={`${conn.provider_name} · Status: ${conn.status} · Escopos: ${conn.granted_scopes.join(', ')}${conn.consent_expires_at ? ` · Até ${formatDateBR(conn.consent_expires_at.slice(0, 10))}` : ''}`}
                  trailing={
                    conn.status === 'active' ? (
                      <Button
                        label="Revogar"
                        variant="danger"
                        size="sm"
                        onPress={() =>
                          handleConfirmRevoke(conn.id, conn.institution_name)
                        }
                      />
                    ) : (
                      <Badge tone="neutral" label="REVOGADO" />
                    )
                  }
                />
              </View>
            ))
          )}
        </Card>
      </Section>

      {/* Passo 5, 6 e 7: Revisão e Conciliação de Transações Sincronizadas */}
      <Section>
        <SectionHeader
          title={`3. Revisão e Conciliação (${bankTransactions.length})`}
          description="Confirme os lançamentos sincronizados para evitar duplicidade."
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {bankTransactions.length === 0 ? (
            <EmptyState
              icon={Check}
              title="Nenhuma transação pendente de conciliação"
              description="Novas transações sincronizadas via Open Finance aparecerão aqui para revisão."
            />
          ) : (
            bankTransactions.map((btx, idx) => {
              const suggestedCat = categories.find(
                (cat) => cat.id === btx.suggested_category_id,
              );
              return (
                <View key={btx.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ListRow
                    title={btx.normalized_description}
                    subtitle={`${formatDateBR(btx.occurred_at.slice(0, 10))} · ${formatCurrencyBRL(btx.amount)} (${btx.direction}) · Sugestão: ${suggestedCat?.name ?? 'Geral'}`}
                    trailing={
                      btx.reconciliation_status === 'pending_review' ? (
                        <Button
                          label="Confirmar"
                          size="sm"
                          onPress={() => void reconcileTx(btx.id)}
                        />
                      ) : (
                        <Badge tone="positive" label={btx.reconciliation_status.toUpperCase()} />
                      )
                    }
                  />
                </View>
              );
            })
          )}
        </Card>
      </Section>
    </Screen>
  );
}
