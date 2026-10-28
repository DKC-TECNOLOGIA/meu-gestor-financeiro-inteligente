# Especificação Técnica: Leitura de NFC-e da Bahia (SEFAZ-BA) e Importação Fiscal

## 1. Diagnóstico Técnico da Consulta Pública de NFC-e na Bahia

De acordo com os requisitos da **Seção 6** (*"Não presumir a existência de uma API pública nacional irrestrita. Investigar e documentar o método tecnicamente viável para a NFC-e da Bahia antes de implementar a integração. Não contornar CAPTCHAs, autenticações ou controles de acesso."*):

1. **Estrutura do QR Code da NFC-e (Versão 2.00 — Padrão ENCAT / SEFAZ-BA)**:
   - O QR Code impresso no DANFE NFC-e na Bahia aponta para os endpoints oficiais da SEFAZ-BA (ex.: `http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/nfce_consulta_chave_acesso.aspx?p=...` ou `https://www.sefaz.ba.gov.br/nfce/consulta?p=...`).
   - O parâmetro `p` (ou a própria string do QR Code) contém campos separados por pipe (`|`):
     - **Campo 1**: Chave de Acesso de 44 dígitos numéricos (`chNFe`).
     - **Campo 2**: Versão do QR Code (`2`).
     - **Campo 3**: Tipo de Ambiente (`1` = Produção, `2` = Homologação).
     - **Campo 4**: Identificador do CSC / CIdToken (ou dia da emissão em contingência offline).
   - **Decomposição Determinística da Chave de Acesso (44 dígitos)**:
     - Posições `01-02` (`cUF`): Código IBGE da UF emissora (`29` = **Bahia**).
     - Posições `03-06` (`AAMM`): Ano e mês da emissão (ex.: `2610` = Outubro de 2026).
     - Posições `07-20` (`CNPJ`): CNPJ de 14 dígitos do estabelecimento emissor.
     - Posições `21-22` (`mod`): Modelo do documento fiscal (`65` = NFC-e, `55` = NF-e).
     - Posições `23-25` (`serie`): Série do documento fiscal.
     - Posições `26-34` (`nNF`): Número da Nota Fiscal.
     - Posições `35-35` (`tpEmis`): Tipo de emissão (`1` = Normal, `9` = Contingência Offline).
     - Posições `36-43` (`cNF`): Código numérico aleatório.
     - Posição `44` (`cDV`): Dígito verificador calculado por **Módulo 11** (pesos de 2 a 9).

2. **Limitações de Consulta Pública Automatizada (CAPTCHA / Sessão SEFAZ-BA)**:
   - O portal de consulta por chave da SEFAZ-BA exige validação de sessão ASP.NET (`__VIEWSTATE`) e controle anti-bot (CAPTCHA) para consultas arbitrárias por chave, embora algumas URLs assinadas com hash (`cHashQRCode`) retornem a visualização simplificada do DANFE quando o portal não solicita desafio adicional.
   - **Política Estrita de Conformidade**: A Edge Function `supabase/functions/nfc-e-parser/index.ts` realiza a tentativa de leitura pública **somente quando a URL oficial do QR Code responde diretamente sem desafio CAPTCHA**. Se a SEFAZ-BA retornar página de bloqueio/CAPTCHA (`status 403`, desafio reCAPTCHA/hCaptcha ou formulário de imagem), o backend **não tenta contornar o controle**; ele retorna imediatamente `status: 'captcha_or_portal_protected'` com todos os metadados já extraídos e validados da chave de 44 dígitos (UF, CNPJ, Série, Número, Mês/Ano) e habilita:
     1. **Alternativa 1 — Importação de XML Fiscal Legítimo (`procNFe` / `NFe`)**: Extração 100% completa e exata de emitente, CNPJ, chave, data de emissão, lista de produtos (`<det>`), código EAN (`<cEAN>`), quantidade (`<qCom>`), unidade (`<uCom>`), valor unitário (`<vUnCom>`), desconto (`<vDesc>`) e total líquido pago.
     2. **Alternativa 2 — Revisão e Lançamento Assistido**: Preenchimento automático dos dados extraídos do QR Code com adição/correção manual dos itens na tela de revisão antes de confirmar.

## 2. Prevenção de Duplicidade

- Toda nota fiscal é validada contra duplicidade pela combinação `(user_id, access_key)` tanto na camada de domínio/store quanto na constraint `UNIQUE (user_id, access_key)` do PostgreSQL (`public.receipts`).
- Ao confirmar a nota na tela de revisão, o sistema gera automaticamente o lançamento correspondente em `transactions` com `origin = 'receipt'` e `external_id = access_key`, atualizando o catálogo de produtos (`product_catalog`) e o histórico de preços (`receipt_items`).
