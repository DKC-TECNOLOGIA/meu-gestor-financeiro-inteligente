# Arquitetura do Sistema — Financeiro Inteligente (Android)

## 1. Visão Geral e Princípios Arquiteturais

O aplicativo **Financeiro Inteligente** foi projetado com arquitetura modular orientada a domínio (*Clean Domain + Feature Modules*), garantindo:

1. **Precisão Financeira Determinística**:
   - Nenhuma operação monetária utiliza aritmética de ponto flutuante inexata para persistência.
   - No PostgreSQL, todos os saldos, transações, faturas e metas utilizam `NUMERIC(15, 2)`. Quantidades e preços unitários de itens de notas fiscais utilizam `NUMERIC(15, 4)`.
   - No cliente TypeScript, a camada `src/domain/finance` opera com conversão segura em centavos (`integer cents`) e arredondamento bancário explícito.
2. **Separação Contábil: Fluxo de Caixa vs. Regime de Competência vs. Patrimônio**:
   - **Regime de Competência (`competence_date`)**: Registra o fato gerador do gasto (ex.: compra no cartão de crédito no supermercado em 15/10 entra no orçamento de Supermercado de outubro).
   - **Fluxo de Caixa (`settlement_date`)**: Registra a entrada ou saída efetiva de dinheiro da conta bancária/carteira (ex.: pagamento da fatura do cartão em 10/11 reduz o caixa em novembro, sem duplicar a despesa na categoria de Supermercado).
   - **Transferências entre Contas Próprias (`kind = 'transfer'`)**: Movimentam saldo entre duas carteiras/contas do próprio usuário, sem inflar receitas ou despesas do mês.
3. **Segurança por Design (Zero Segredos no Cliente)**:
   - O aplicativo Android comunica-se apenas com o Supabase usando a chave pública `ANON_KEY` + token JWT de sessão armazenado criptografado no `expo-secure-store`.
   - Todas as 17 tabelas possuem `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY` vinculados a `auth.uid()`.
   - Operações que exigem segredos (consulta externa de NFC-e, Orientador Financeiro por IA e sincronização Open Finance Brasil) rodam exclusivamente em **Supabase Edge Functions**.
   - Credenciais de provedores Open Finance são isoladas no schema privado `private.bank_connection_secrets`, revogado para `anon` e `authenticated`.

## 2. Organização de Camadas

- `app/`: Rotas do **Expo Router** (telas de autenticação, onboarding, navegação inferior em abas e fluxos modais/detalhes).
- `src/config/`: Configurações regionais (`America/Bahia`, `BRL`, `pt-BR`), validação de variáveis de ambiente com `zod` e catálogo das 19 categorias padrão.
- `src/domain/`: Regras de negócio puras, determinísticas e 100% testadas por testes unitários:
  - `finance/`: Cálculos de fluxo de caixa, competência, faturas de cartão, alertas de orçamento e taxa de poupança.
  - `price-comparison/`: Normalização de unidades (`KG`/`G`, `L`/`ML`, `UN`) e comparação histórica mês a mês sem comparar grandezas incompatíveis.
  - `gamification/`: Regras auditáveis de pontuação e progressão nos 4 níveis (`Iniciante`, `Consciente`, `Disciplinado`, `Estratégico`).
  - `xlsx/`: Construção de arquivos Excel (`.xlsx`) reais com múltiplas abas, cabeçalhos e totalizadores.
- `src/lib/`: Cliente Supabase configurado com `SecureStore` e utilitários de rede/idempotência.
- `src/types/`: Tipagem estrita (`strict: true`) espelhando o schema PostgreSQL (`database.types.ts`).
- `supabase/`:
  - `migrations/`: Evolução versionada do banco de dados.
  - `functions/`: Edge Functions (`nfc-e-parser`, `ai-advisor`, `open-finance-sync`).
  - `tests/`: Scripts de verificação de isolamento RLS entre usuários.
