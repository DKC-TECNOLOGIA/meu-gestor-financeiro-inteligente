# Documentação de Publicação, Retenção de Dados e Validação Final — Financeiro Inteligente

## 1. Mapeamento Integral das 17 Telas Exigidas (Seção 15)

| # | Tela Exigida | Arquivo de Rota (Expo Router) | Status |
| :--- | :--- | :--- | :--- |
| 1 | Boas-vindas | `app/(auth)/welcome.tsx` | Implementada e Verificada |
| 2 | Cadastro e autenticação | `app/(auth)/sign-up.tsx` e `app/(auth)/sign-in.tsx` | Implementada e Verificada |
| 3 | Definição de objetivos | `app/(auth)/onboarding.tsx` | Implementada e Verificada |
| 4 | Dashboard | `app/(tabs)/index.tsx` | Implementada e Verificada |
| 5 | Receitas e despesas | `app/(tabs)/transactions.tsx` | Implementada e Verificada |
| 6 | Cadastro de lançamento | `app/transactions/[id].tsx` | Implementada e Verificada |
| 7 | Categorias e orçamentos | `app/(tabs)/categories.tsx` | Implementada e Verificada |
| 8 | Scanner de notas fiscais | `app/(tabs)/scanner.tsx` | Implementada e Verificada |
| 9 | Detalhes da nota | `app/receipts/[id].tsx` e `app/receipts/review.tsx` | Implementada e Verificada |
| 10 | Comparação de preços | `app/receipts/price-comparison.tsx` | Implementada e Verificada |
| 11 | Cartões e faturas | `app/cards/index.tsx` | Implementada e Verificada |
| 12 | Metas | `app/goals/index.tsx` | Implementada e Verificada |
| 13 | Orientador Financeiro | `app/(tabs)/advisor.tsx` | Implementada e Verificada |
| 14 | Gamificação e níveis | `app/gamification/index.tsx` | Implementada e Verificada |
| 15 | Exportação | `app/export/index.tsx` | Implementada e Verificada |
| 16 | Integração bancária | `app/open-finance/index.tsx` | Implementada e Verificada |
| 17 | Perfil, privacidade e configurações | `app/(tabs)/profile.tsx` | Implementada e Verificada |

## 2. Política de Retenção e Direitos do Titular (Seção 14)

- **Retenção Ativa**: Enquanto a conta do usuário permanecer ativa, os lançamentos financeiros, notas fiscais (`receipts` / `receipt_items`), metas e recomendações ficam disponíveis para consulta histórica e comparação interanual.
- **Revogação de Consentimento Open Finance**: A revogação na tela `app/open-finance/index.tsx` encerra imediatamente novas sincronizações e marca `revoked_at` em `bank_connections`.
- **Portabilidade e Exclusão (LGPD)**: O titular pode exportar 100% dos seus dados em formato `.xlsx` na tela `app/export/index.tsx` e solicitar a exclusão integral da conta (`ON DELETE CASCADE` no PostgreSQL + limpeza imediata do armazenamento local seguro).

## 3. Processo Documentado de Publicação Android (AAB na Google Play)

1. **Executar Pipeline de Validação Local e CI**:
   ```bash
   npm run validate
   ```
2. **Aplicar Migrations SQL no Projeto Supabase de Produção**:
   ```bash
   npx supabase link --project-ref <SEU_PROJECT_REF>
   npx supabase db push
   npx supabase functions deploy nfc-e-parser
   npx supabase functions deploy ai-advisor
   npx supabase functions deploy open-finance-sync
   ```
3. **Gerar e Validar o Android App Bundle (`.aab`)**:
   ```bash
   npx eas-cli build --platform android --profile production
   ```
4. **Checklist de Homologação em Dispositivo Android**:
   - Verificar permissão de câmera ao abrir o leitor de QR Code de NFC-e.
   - Testar compartilhamento nativo do arquivo `.xlsx` gerado na aba de Exportação.
   - Confirmar isolamento de sessão com `expo-secure-store`.
