# Guia de Geração de APK e AAB (Android) — Financeiro Inteligente

## 1. Pré-requisitos

- Conta no [Expo (EAS)](https://expo.dev) ou Android Studio SDK local.
- Variáveis públicas configuradas (`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## 2. Validação Pré-Build (Obrigatória)

Antes de gerar qualquer binário Android, execute a suíte completa de validação:

```bash
npm run validate
```

Esse comando executa sequencialmente:
1. `npm run typecheck` (`tsc --noEmit` em modo estrito)
2. `npm run lint` (`eslint` com zero avisos/erros permitidos)
3. `npm test` (`jest` — testes unitários e de integração da camada de domínio e segurança)

## 3. Perfis de Build (`eas.json`)

- **Development Build (com suporte nativo à câmera para scanner QR Code)**:
  ```bash
  npx eas-cli build --platform android --profile development
  ```
- **Preview APK (para instalação direta em dispositivo Android de testes)**:
  ```bash
  npx eas-cli build --platform android --profile preview
  ```
- **Production AAB (Android App Bundle assinado para Google Play Console)**:
  ```bash
  npx eas-cli build --platform android --profile production
  ```
