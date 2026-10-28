# Segurança, Privacidade e Conformidade (LGPD) — Financeiro Inteligente

## 1. Controles de Segurança Implementados

1. **Segredos Restritos ao Backend**:
   - Chaves de provedores de IA, credenciais de Open Finance e `SUPABASE_SERVICE_ROLE_KEY` residem exclusivamente nos segredos de ambiente das Supabase Edge Functions.
   - O arquivo `.env.example` documenta claramente a separação entre variáveis públicas (`EXPO_PUBLIC_*`) e segredos de backend.
2. **Isolamento Multi-Tenant via Row Level Security (RLS)**:
   - Todas as 17 tabelas do schema `public` possuem `FORCE ROW LEVEL SECURITY`.
   - Políticas restritivas exigem `auth.uid() = user_id` (ou `auth.uid() = id` em `profiles`) para `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
   - As tabelas `gamification_events` e `user_levels` bloqueiam escrita direta do cliente, permitindo mutações apenas por funções auditadas (`SECURITY DEFINER`) com chave de idempotência (`idempotency_key`).
3. **Proteção de Credenciais Bancárias**:
   - Nunca solicitamos ou armazenamos senhas bancárias do usuário.
   - Tokens OAuth/Open Finance são guardados em `private.bank_connection_secrets`, inacessível via API PostgREST pelo cliente.
4. **Prevenção contra Duplicidade e Replay**:
   - Notas fiscais possuem restrição `UNIQUE (user_id, access_key)`.
   - Lançamentos importados possuem restrição `UNIQUE (user_id, origin, external_id)`.
   - Eventos de gamificação possuem restrição `UNIQUE (user_id, idempotency_key)`.

## 2. Privacidade, Minimização de Dados e Direitos do Titular (LGPD)

- **Minimização no Onboarding**: Renda líquida, despesas fixas aproximadas, dívidas e reserva financeira são **opcionais**. O aplicativo explica a finalidade de cada dado antes da coleta e permite edição ou limpeza a qualquer momento.
- **Uso de IA Ético e Determinístico**:
  - Os dados financeiros pessoais **não** são utilizados para treinamento de modelos de IA.
  - O backend envia ao modelo apenas agregados anonimizados do período necessário para gerar a orientação solicitada.
- **Portabilidade e Exclusão Integral**:
  - O usuário pode exportar todos os seus dados em formato aberto/estruturado (`.xlsx`) a qualquer momento.
  - A exclusão da conta aciona `ON DELETE CASCADE` em todas as 17 tabelas vinculadas a `auth.users(id)`, removendo imediatamente históricos, notas fiscais, conexões bancárias e recomendações.
