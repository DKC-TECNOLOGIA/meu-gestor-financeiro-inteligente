import fs from 'node:fs';
import path from 'node:path';
import { useFinanceStore } from '@/features/finance/use-finance-store';

describe('Fase 6 — Testes de Isolamento entre Usuários, Acesso Não Autorizado, Completude das 17 Telas e Build Android', () => {
  describe('1. Testes de Isolamento entre Usuários e Bloqueio de Acesso Não Autorizado (Seção 13, 14 e 16)', () => {
    it('deve impedir que o Usuário B edite ou exclua lançamentos pertencentes ao Usuário A', async () => {
      const store = useFinanceStore.getState();

      // 1. Autenticar como Usuário A e criar lançamento
      store.switchAuthenticatedUserContext('user-alpha-001');
      const txUserA = await useFinanceStore.getState().createTransaction({
        kind: 'expense',
        description: 'Despesa Privada do Usuário A',
        amount: 420.75,
        competenceDate: '2026-10-10',
        settlementDate: '2026-10-10',
        paymentMethod: 'pix',
        status: 'paid',
        isFixed: false,
        isRecurring: false,
        recurrenceFrequency: 'none',
        origin: 'manual',
      });

      expect(txUserA.user_id).toBe('user-alpha-001');

      // 2. Alternar contexto para Usuário B ('user-beta-002')
      useFinanceStore.getState().switchAuthenticatedUserContext('user-beta-002');

      // 3. Tentativa do Usuário B de editar o lançamento do Usuário A deve ser bloqueada
      await expect(
        useFinanceStore.getState().updateTransaction(txUserA.id, {
          kind: 'expense',
          description: 'Tentativa de Adulteração pelo Usuário B',
          amount: 1.0,
          competenceDate: '2026-10-10',
          settlementDate: '2026-10-10',
          paymentMethod: 'pix',
          status: 'paid',
          isFixed: false,
          isRecurring: false,
          recurrenceFrequency: 'none',
          origin: 'manual',
        }),
      ).rejects.toThrow(/Acesso negado/);

      // 4. Tentativa do Usuário B de excluir o lançamento do Usuário A deve ser bloqueada
      await expect(
        useFinanceStore.getState().deleteTransaction(txUserA.id),
      ).rejects.toThrow(/Acesso negado: exclusão não autorizada/);

      // Restaurar Usuário A e limpar dados conforme direito de exclusão LGPD
      useFinanceStore.getState().switchAuthenticatedUserContext('user-alpha-001');
      await useFinanceStore.getState().deleteAllUserDataAndAccount();
      expect(useFinanceStore.getState().transactions).toHaveLength(0);
    });
  });

  describe('2. Verificação das 17 Telas Obrigatórias da Experiência Visual (Seção 15)', () => {
    const projectRoot = path.resolve(__dirname, '..');

    const requiredScreenFiles = [
      'app/(auth)/welcome.tsx', // 1. Boas-vindas
      'app/(auth)/sign-in.tsx', // 2a. Autenticação
      'app/(auth)/sign-up.tsx', // 2b. Cadastro
      'app/(auth)/onboarding.tsx', // 3. Definição de objetivos
      'app/(tabs)/index.tsx', // 4. Dashboard
      'app/(tabs)/transactions.tsx', // 5. Receitas e despesas
      'app/transactions/[id].tsx', // 6. Cadastro de lançamento
      'app/(tabs)/categories.tsx', // 7. Categorias e orçamentos
      'app/(tabs)/scanner.tsx', // 8. Scanner de notas fiscais
      'app/receipts/[id].tsx', // 9. Detalhes da nota (+ review.tsx)
      'app/receipts/price-comparison.tsx', // 10. Comparação de preços
      'app/cards/index.tsx', // 11. Cartões e faturas
      'app/goals/index.tsx', // 12. Metas
      'app/(tabs)/advisor.tsx', // 13. Orientador Financeiro
      'app/gamification/index.tsx', // 14. Gamificação e níveis
      'app/export/index.tsx', // 15. Exportação
      'app/open-finance/index.tsx', // 16. Integração bancária
      'app/(tabs)/profile.tsx', // 17. Perfil, privacidade e configurações
    ];

    it.each(requiredScreenFiles)(
      'deve possuir o arquivo da tela %s implementado e não vazio',
      (relativePath) => {
        const fullPath = path.join(projectRoot, relativePath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content.length).toBeGreaterThan(200);
      },
    );
  });

  describe('3. Verificação das Supabase Edge Functions e Configuração de Build AAB/APK (Seção 3 e 16)', () => {
    const projectRoot = path.resolve(__dirname, '..');

    it('deve possuir as 3 Edge Functions de backend implementadas (nfc-e-parser, ai-advisor, open-finance-sync)', () => {
      const fnNames = ['nfc-e-parser', 'ai-advisor', 'open-finance-sync'];
      for (const fn of fnNames) {
        const fnPath = path.join(projectRoot, 'supabase', 'functions', fn, 'index.ts');
        expect(fs.existsSync(fnPath)).toBe(true);
      }
    });

    it('deve configurar geração de APK (development/preview) e AAB (production app-bundle) no eas.json', () => {
      const easJson = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8'),
      ) as {
        build: {
          development: { android: { buildType: string } };
          preview: { android: { buildType: string } };
          production: { android: { buildType: string } };
        };
      };

      expect(easJson.build.development.android.buildType).toBe('apk');
      expect(easJson.build.preview.android.buildType).toBe('apk');
      expect(easJson.build.production.android.buildType).toBe('app-bundle');
    });
  });
});
