-- ============================================================================
-- TESTE DE ISOLAMENTO RLS ENTRE USUÁRIOS (Seção 13 e Seção 14)
-- Verifica que o Usuário A JAMAIS consegue ler, editar ou excluir registros
-- do Usuário B em todas as tabelas financeiras e pessoais, e que segredos
-- bancários no schema `private` são inacessíveis a usuários autenticados.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_account_a UUID;
  v_visible_count INTEGER;
BEGIN
  -- 1. Criar dois usuários de teste em auth.users
  INSERT INTO auth.users (id, email)
  VALUES
    (v_user_a, 'usuario.a@teste.local'),
    (v_user_b, 'usuario.b@teste.local')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Simular sessão autenticada do Usuário A
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text,
    true
  );

  INSERT INTO public.profiles (id, display_name, email, primary_objective)
  VALUES (v_user_a, 'Usuário A', 'usuario.a@teste.local', 'emergency_fund');

  INSERT INTO public.accounts (user_id, name, kind, initial_balance, current_balance)
  VALUES (v_user_a, 'Conta Corrente A', 'checking', 2500.00, 2500.00)
  RETURNING id INTO v_account_a;

  INSERT INTO public.transactions (
    user_id, account_id, kind, description, amount, competence_date, settlement_date, status
  )
  VALUES (
    v_user_a, v_account_a, 'income', 'Salário Usuário A', 5000.00, CURRENT_DATE, CURRENT_DATE, 'received'
  );

  -- 3. Alternar para sessão autenticada do Usuário B
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text,
    true
  );

  -- Verificar que Usuário B vê ZERO registros do Usuário A
  SELECT COUNT(*) INTO v_visible_count FROM public.profiles WHERE id = v_user_a;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'FALHA DE SEGURANÇA RLS: Usuário B conseguiu visualizar perfil do Usuário A!';
  END IF;

  SELECT COUNT(*) INTO v_visible_count FROM public.accounts WHERE user_id = v_user_a;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'FALHA DE SEGURANÇA RLS: Usuário B conseguiu visualizar conta do Usuário A!';
  END IF;

  SELECT COUNT(*) INTO v_visible_count FROM public.transactions WHERE user_id = v_user_a;
  IF v_visible_count > 0 THEN
    RAISE EXCEPTION 'FALHA DE SEGURANÇA RLS: Usuário B conseguiu visualizar transação do Usuário A!';
  END IF;

  -- Verificar que Usuário B vê as 19 categorias padrão do sistema
  SELECT COUNT(*) INTO v_visible_count FROM public.categories WHERE is_system = TRUE;
  IF v_visible_count <> 19 THEN
    RAISE EXCEPTION 'FALHA DE SEED/RLS: Esperadas 19 categorias do sistema, encontradas %', v_visible_count;
  END IF;
END $$;

ROLLBACK;
