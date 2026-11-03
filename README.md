# Meu Gestor Financeiro Inteligente (Agente-Financeiro)

Aplicativo mobile (**Android / iOS / Web** via **Expo SDK 58 + React Native 0.88**) para gestão financeira pessoal e familiar brasileira, com separação contábil determinística entre **Regime de Competência** e **Fluxo de Caixa**, leitura de **NFC-e (SEFAZ-BA e nacional)**, comparação histórica de preços por unidade normalizada, **Orientador Financeiro por IA determinístico**, gamificação auditável, **Open Finance Brasil** e exportação completa em **Excel (`.xlsx`)**.

---

## 1. Arquitetura e Princípios Técnicos

1. **Precisão Monetária Determinística**:
   - Banco de dados PostgreSQL com `NUMERIC(15, 2)` para valores monetários e `NUMERIC(15, 4)` para quantidades/preços unitários fiscais.
   - Camada de domínio (`src/domain/finance`) operando em centavos inteiros (`toCents` / `fromCents`) sem erros de ponto flutuante IEEE 754.
2. **Separação Contábil Real**:
   - **Regime de Competência (`competence_date`)**: Compras no cartão de crédito impactam o orçamento da categoria no mês da compra.
   - **Fluxo de Caixa (`settlement_date`)**: O pagamento da fatura (`invoice_payment`) reduz o saldo da conta bancária no mês do pagamento sem duplicar a despesa na categoria.
   - **Transferências Próprias (`transfer`)**: Movimentam saldo entre contas sem inflar receitas ou despesas.
3. **Offline-First + Sincronização Supabase Cloud**:
   - Persistência instantânea via `AsyncStorage` combinada com sincronização autenticada em todas as 17 tabelas do Supabase PostgreSQL.
4. **Segurança por Design e Conformidade LGPD**:
   - Sessão JWT armazenada em `expo-secure-store`.
   - Todas as 17 tabelas do schema `public` possuem `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` vinculados a `auth.uid()`.
   - Credenciais de provedores Open Finance isoladas em `private.bank_connection_secrets`.
   - Zero segredos privados em variáveis `EXPO_PUBLIC_*` (validado em tempo de execução por `src/config/env.ts`).
5. **Design System Próprio (`@/ui`)**:
   - Componentes padronizados (`Screen`, `Card`, `AppText`, `Amount`, `Button`, `TextField`, `Chip`, `SegmentedControl`, `ProgressBar`, `Sparkline`, `ListRow`, `InlineMessage`) com suporte reativo a **Modo Claro** e **Modo Escuro (Vault Forest)** via `useThemeColors()`.

---

## 2. Estrutura do Repositório

```text
├── app/                        # 19 rotas Expo Router (Auth, Onboarding, Tabs e Modais)
│   ├── (auth)/                 # welcome, sign-in, sign-up, onboarding
│   ├── (tabs)/                 # index (Dashboard), transactions, categories, advisor, profile, scanner
│   ├── cards/                  # Gestão de cartões de crédito e pagamento de faturas
│   ├── export/                 # Exportação de relatório Excel (.xlsx com 9 abas)
│   ├── gamification/           # Níveis de responsabilidade e histórico auditável de XP
│   ├── goals/                  # Metas financeiras e registro de aportes
│   ├── open-finance/           # Consentimento OAuth2/FAPI, conciliação e revogação
│   ├── receipts/               # Revisão de NFC-e, detalhes da nota e comparação de preços
│   └── transactions/[id].tsx   # Formulário de criação e edição de lançamentos
├── src/
│   ├── config/                 # Constantes regionais (BRL, America/Bahia) e validação Zod de env
│   ├── domain/                 # Regras de negócio puras e determinísticas
│   ├── features/finance/       # Zustand Store (Offline-First + Supabase Cloud Sync)
│   ├── lib/                    # Cliente Supabase com SecureStore
│   ├── types/                  # Tipagem estrita das 17 tabelas PostgreSQL
│   ├── ui/                     # Design System completo + temas Light / Dark
│   └── utils/                  # Formatação BRL, datas pt-BR e aritmética exata em centavos
├── supabase/
│   ├── migrations/             # Schema PostgreSQL, Políticas RLS e Funções Auditáveis
│   ├── functions/              # Edge Functions: nfc-e-parser, ai-advisor, open-finance-sync
│   ├── tests/                  # Teste SQL de isolamento multi-tenant (RLS)
│   └── full_setup_supabase_sql_editor.sql
├── __tests__/                  # 6 suítes de testes automatizados (Fase 1 a Fase 6)
└── docs/                       # Documentação arquitetural, fiscal, segurança e build Android
```

---

## 3. Como Executar e Validar

### Instalação e Desenvolvimento
```bash
npm install
npx expo start
```

### Pipeline Completo de Validação (Obrigatório antes de Commits/Builds)
```bash
npm run validate
```
Executa em sequência:
1. `npm run typecheck` — `tsc --noEmit` com `strict: true` e `noUncheckedIndexedAccess: true`.
2. `npm run lint` — `eslint . --max-warnings 0`.
3. `npm test` — Suíte completa do Jest (`--runInBand`) validando cálculos financeiros, parser de NFC-e, comparação de preços, gamificação, orientador IA, Open Finance, Excel `.xlsx` e isolamento de segurança entre usuários.

---

## 4. Documentação Complementar (`docs/`)

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Arquitetura em camadas e separação contábil.
- [`docs/PRIVACY_AND_SECURITY.md`](docs/PRIVACY_AND_SECURITY.md) — Controles RLS, proteção de segredos e LGPD.
- [`docs/NFCE_BAHIA_INTEGRATION.md`](docs/NFCE_BAHIA_INTEGRATION.md) — Leitura de QR Code NFC-e SEFAZ-BA, validação Módulo 11 e importação XML.
- [`docs/OPEN_FINANCE_EVALUATION.md`](docs/OPEN_FINANCE_EVALUATION.md) — Abstração de provedores Open Finance Brasil e ciclo de consentimento.
- [`docs/ANDROID_BUILD.md`](docs/ANDROID_BUILD.md) — Geração de APK e AAB com EAS Build.
- [`docs/RELEASE_AND_PUBLICATION.md`](docs/RELEASE_AND_PUBLICATION.md) — Mapeamento das 17 telas obrigatórias e checklist de publicação.
