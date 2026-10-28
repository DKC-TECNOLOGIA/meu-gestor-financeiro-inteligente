# Avaliação Técnica e Comercial: Integração Bancária (Open Finance Brasil)

Em conformidade com a **Seção 9** (*"Antes de escolher o provedor: avaliar cobertura de instituições brasileiras, verificar suporte a contas, cartões, transações e investimentos, confirmar condições comerciais, limites e requisitos de contratação, avaliar segurança, suporte, sincronização e processo de consentimento, e documentar as funcionalidades efetivamente disponíveis"*):

## 1. Comparativo de Provedores Autorizados / Agregadores B2B no Brasil

| Critério | Pluggy (Open Finance Brasil) | Belvo (ITP Autorizado BCB) | Conexão Direta BCB (Participante Direto) |
| :--- | :--- | :--- | :--- |
| **Cobertura no Brasil** | +95% dos bancos de varejo e digitais (Banco do Brasil, Itaú, Bradesco, Caixa, Santander, Nubank, Inter, C6, Sicredi, Sicoob). | Forte cobertura nas principais instituições participantes do diretório do Banco Central. | Todas as instituições obrigatórias do ecossistema Open Finance Brasil. |
| **Escopos Suportados** | Contas correntes/poupança (`ACCOUNTS`), transações (`TRANSACTIONS`), faturas e compras de cartão de crédito (`CREDIT_CARDS`), investimentos (`INVESTMENTS`). | Contas, transações, cartões de crédito e investimentos via API padronizada. | Fase 2 (Compartilhamento de Dados) e Fase 3 (Iniciação de Transação de Pagamento - ITP). |
| **Condições Comerciais e Contratação** | Contrato B2B SaaS cobrado por conexão ativa/mês; disponibiliza chave de Sandbox/Desenvolvimento para testes de integração (`CLIENT_ID` e `CLIENT_SECRET`). | Contrato comercial B2B com franquia mínima mensal; ambiente Sandbox disponível. | Exige homologação regulatória própria junto ao Banco Central do Brasil, certificados ICP-Brasil (e-CNPJ / SSL mTLS) e auditoria de segurança dedicada. |
| **Segurança e Consentimento** | Redirecionamento OAuth2 / FAPI 1.0 Advanced para o aplicativo/site oficial do banco detentor da conta. **Nunca solicita senha bancária ao usuário dentro do app terceiro.** | Fluxo OAuth2 / FAPI regulamentado pelo Banco Central com expiração de até 12 meses e revogação a qualquer momento. | Padrão FAPI mTLS oficial do Banco Central. |

## 2. Decisão Arquitetural e Limitações Reais Documentadas

1. **Camada de Abstração (`IBankIntegrationProvider`)**:
   - O aplicativo implementa a interface agnóstica de provedor (`pluggy` como adaptador primário recomendado para produção B2B e `belvo` como secundário), operando exclusivamente por meio da Edge Function `supabase/functions/open-finance-sync/index.ts`.
   - **Intervenção Humana / Credenciais Reais**: Para sincronizar contas bancárias reais em produção, é necessário contratar o provedor escolhido e configurar `OPEN_FINANCE_CLIENT_ID` e `OPEN_FINANCE_CLIENT_SECRET` no cofre de segredos do Supabase (`supabase secrets set`). Enquanto as chaves comerciais não estiverem configuradas no backend, o aplicativo informa explicitamente que está sem credenciais de produção e jamais simula saldos fictícios como se fossem contas bancárias reais (Requisito da Seção 17).
2. **Cobertura Real de Pix, Cartões e Bancos**:
   - Nem todas as cooperativas menores ou contas de pagamento pré-pagas participam integralmente de todos os endpoints do Open Finance Brasil.
   - Transações Pix aparecem no extrato da conta (`CREDIT` / `DEBIT`) após liquidação pela instituição detentora; o horário de atualização depende da janela de sincronização da API Open Finance da instituição (normalmente de 1 a 4 vezes ao dia ou sob demanda com limite de *rate limit* regulatório).
   - Compras no cartão de crédito compartilhadas via Open Finance vêm agrupadas no demonstrativo da fatura (`CREDIT_CARDS`) e são conciliadas pelo nosso motor sem duplicar o débito de pagamento da fatura na conta corrente.
3. **Escopo da Fase 5**:
   - Implementamos exclusivamente **importação e conciliação de dados mediante consentimento explícito** (`accounts`, `transactions`, `credit_cards`) e **revogação imediata**. Iniciação de pagamentos (ITP) permanece desabilitada e separada para evolução futura.
