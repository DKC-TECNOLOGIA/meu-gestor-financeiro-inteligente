import {
  areUnitsCompatible,
  compareCatalogPricesByMonth,
  computeNormalizedBaseUnitPrice,
} from '@/domain/price-comparison/price-analyzer';
import {
  calculateAccessKeyCheckDigit,
  parseAndValidateAccessKey,
  parseNfceQrCodeContent,
  parseNfceXmlContent,
} from '@/domain/receipts/nfce-parser';
import { useFinanceStore } from '@/features/finance/use-finance-store';

describe('Fase 3 — Notas Fiscais (NFC-e BA), Catálogo de Produtos e Comparação de Preços', () => {
  const base43Bahia = '2926101234567800019965001000012345112345678';
  const validDv = calculateAccessKeyCheckDigit(base43Bahia);
  const validBahiaKey = `${base43Bahia}${validDv}`;

  describe('1. Validação de Chave de Acesso NFC-e (Bahia UF 29) e QR Code (Seção 6)', () => {
    it('deve validar corretamente o dígito verificador (Módulo 11) e extrair UF=BA, AAMM e CNPJ', () => {
      const info = parseAndValidateAccessKey(validBahiaKey);
      expect(info.ufCode).toBe('29');
      expect(info.ufSigla).toBe('BA');
      expect(info.yearMonth).toBe('2026-10');
      expect(info.merchantCnpj).toBe('12345678000199');
      expect(info.model).toBe('65');
      expect(info.isValidCheckDigit).toBe(true);
    });

    it('deve rejeitar chave de acesso com dígito verificador adulterado', () => {
      const wrongDv = validDv === '9' ? '0' : '9';
      expect(() =>
        parseAndValidateAccessKey(`${base43Bahia}${wrongDv}`),
      ).toThrow(/Dígito verificador da chave de acesso inválido/);
    });

    it('deve interpretar a URL oficial de QR Code da SEFAZ-BA', () => {
      const qrUrl = `http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/nfce_consulta_chave_acesso.aspx?p=${validBahiaKey}|2|1|1|A1B2C3`;
      const draft = parseNfceQrCodeContent(qrUrl);

      expect(draft.accessKey).toBe(validBahiaKey);
      expect(draft.issuerUf).toBe('BA');
      expect(draft.merchantCnpj).toBe('12345678000199');
      expect(draft.sourceType).toBe('qr_code');
      expect(draft.requiresAssistedReview).toBe(true);
    });
  });

  describe('2. Importação de XML Fiscal Legítimo de NFC-e (Seção 6)', () => {
    const sampleNfceXml = `
      <nfeProc versao="4.00">
        <NFe>
          <infNFe Id="NFe${validBahiaKey}">
            <ide>
              <cUF>29</cUF>
              <mod>65</mod>
              <serie>1</serie>
              <nNF>12345</nNF>
              <dhEmi>2026-10-18T14:30:00-03:00</dhEmi>
            </ide>
            <emit>
              <CNPJ>12345678000199</CNPJ>
              <xNome>HIPERIDEAL SUPERMERCADOS LTDA</xNome>
              <xFant>HIPERIDEAL PITUBA</xFant>
              <enderEmit><UF>BA</UF></enderEmit>
            </emit>
            <det nItem="1">
              <prod>
                <cEAN>7891000100103</cEAN>
                <xProd>CAFE TORRADO E MOIDO 500G</xProd>
                <uCom>UN</uCom>
                <qCom>2.0000</qCom>
                <vUnCom>18.5000</vUnCom>
                <vProd>37.00</vProd>
                <vDesc>2.00</vDesc>
              </prod>
            </det>
            <det nItem="2">
              <prod>
                <cEAN>SEM GTIN</cEAN>
                <xProd>BANANA PRATA KG</xProd>
                <uCom>KG</uCom>
                <qCom>1.5000</qCom>
                <vUnCom>8.0000</vUnCom>
                <vProd>12.00</vProd>
              </prod>
            </det>
            <total>
              <ICMSTot>
                <vProd>49.00</vProd>
                <vDesc>2.00</vDesc>
                <vNF>47.00</vNF>
              </ICMSTot>
            </total>
          </infNFe>
        </NFe>
      </nfeProc>
    `;

    it('deve extrair estabelecimento, itens, descontos unitários e totais líquidos do XML', () => {
      const draft = parseNfceXmlContent(sampleNfceXml);

      expect(draft.accessKey).toBe(validBahiaKey);
      expect(draft.merchantName).toBe('HIPERIDEAL SUPERMERCADOS LTDA');
      expect(draft.merchantTradeName).toBe('HIPERIDEAL PITUBA');
      expect(draft.totalGrossAmount).toBe(49.0);
      expect(draft.totalDiscountAmount).toBe(2.0);
      expect(draft.totalPaidAmount).toBe(47.0);
      expect(draft.items).toHaveLength(2);

      // Item 1: 2 unidades a R$ 18,50 com R$ 2,00 de desconto total -> R$ 17,50 líquido por unidade
      const cafe = draft.items[0]!;
      expect(cafe.eanBarcode).toBe('7891000100103');
      expect(cafe.unitGrossPrice).toBe(18.5);
      expect(cafe.unitDiscountAmount).toBe(1.0);
      expect(cafe.unitNetPricePaid).toBe(17.5);
      expect(cafe.totalNetPaid).toBe(35.0);
    });
  });

  describe('3. Persistência da Nota, Prevenção de Duplicidade e Catálogo (Seção 6 e 7)', () => {
    it('deve salvar a nota fiscal, criar o lançamento financeiro, alimentar o catálogo e bloquear duplicidade da mesma chave', async () => {
      const base43Second = '2926091234567800019965001000054321112345678';
      const secondKey = `${base43Second}${calculateAccessKeyCheckDigit(base43Second)}`;

      // 1. Confirmar compra em Setembro/2026 (R$ 24,00/KG de Queijo Prato)
      const sepResult = await useFinanceStore.getState().confirmAndSaveReceipt({
        accessKey: secondKey,
        receiptNumber: '54321',
        series: '1',
        issuerUf: 'BA',
        merchantName: 'ATAKAREJO SALVADOR',
        merchantTradeName: 'ATAKAREJO IGUATEMI',
        merchantCnpj: '12345678000199',
        issuedAt: '2026-09-12T10:00:00.000Z',
        totalGrossAmount: 48.0,
        totalDiscountAmount: 0,
        totalPaidAmount: 48.0,
        sourceType: 'xml_import',
        qrCodeRawUrl: null,
        requiresAssistedReview: false,
        statusMessage: 'OK',
        items: [
          {
            itemSequence: 1,
            originalProductName: 'QUEIJO PRATO FATIADO KG',
            normalizedProductName: 'QUEIJO PRATO FATIADO KG',
            brand: 'Laticínios BA',
            eanBarcode: '7899999900012',
            quantity: 1.0,
            measurementUnit: 'KG',
            unitGrossPrice: 48.0,
            unitDiscountAmount: 0,
            unitNetPricePaid: 48.0,
            totalNetPaid: 48.0,
            isReturned: false,
          },
        ],
      });

      expect(sepResult.receipt.access_key).toBe(secondKey);
      expect(sepResult.transaction.amount).toBe(48.0);
      expect(sepResult.transaction.origin).toBe('receipt');

      // 2. Tentar importar novamente a mesma chave de acesso deve falhar por duplicidade
      await expect(
        useFinanceStore.getState().confirmAndSaveReceipt({
          accessKey: secondKey,
          receiptNumber: '54321',
          series: '1',
          issuerUf: 'BA',
          merchantName: 'ATAKAREJO SALVADOR',
          merchantTradeName: 'ATAKAREJO IGUATEMI',
          merchantCnpj: '12345678000199',
          issuedAt: '2026-09-12T10:00:00.000Z',
          totalGrossAmount: 48.0,
          totalDiscountAmount: 0,
          totalPaidAmount: 48.0,
          sourceType: 'qr_code',
          qrCodeRawUrl: null,
          requiresAssistedReview: false,
          statusMessage: 'Duplicada',
          items: [
            {
              itemSequence: 1,
              originalProductName: 'QUEIJO PRATO FATIADO KG',
              normalizedProductName: 'QUEIJO PRATO FATIADO KG',
              brand: null,
              eanBarcode: '7899999900012',
              quantity: 1.0,
              measurementUnit: 'KG',
              unitGrossPrice: 48.0,
              unitDiscountAmount: 0,
              unitNetPricePaid: 48.0,
              totalNetPaid: 48.0,
              isReturned: false,
            },
          ],
        }),
      ).rejects.toThrow(/Chave de acesso .* duplicada/);

      // 3. Confirmar compra em Outubro/2026 com preço maior (R$ 54,00/KG) + um produto novo sem histórico
      await useFinanceStore.getState().confirmAndSaveReceipt({
        accessKey: validBahiaKey,
        receiptNumber: '12345',
        series: '1',
        issuerUf: 'BA',
        merchantName: 'HIPERIDEAL PITUBA',
        merchantTradeName: 'HIPERIDEAL PITUBA',
        merchantCnpj: '12345678000199',
        issuedAt: '2026-10-15T15:00:00.000Z',
        totalGrossAmount: 66.0,
        totalDiscountAmount: 0,
        totalPaidAmount: 66.0,
        sourceType: 'xml_import',
        qrCodeRawUrl: null,
        requiresAssistedReview: false,
        statusMessage: 'OK',
        items: [
          {
            itemSequence: 1,
            originalProductName: 'QUEIJO PRATO FATIADO KG',
            normalizedProductName: 'QUEIJO PRATO FATIADO KG',
            brand: 'Laticínios BA',
            eanBarcode: '7899999900012',
            quantity: 1.0,
            measurementUnit: 'KG',
            unitGrossPrice: 54.0,
            unitDiscountAmount: 0,
            unitNetPricePaid: 54.0,
            totalNetPaid: 54.0,
            isReturned: false,
          },
          {
            itemSequence: 2,
            originalProductName: 'AZEITE EXTRA VIRGEM 500ML',
            normalizedProductName: 'AZEITE EXTRA VIRGEM 500ML',
            brand: null,
            eanBarcode: '7898888800021',
            quantity: 1.0,
            measurementUnit: 'UN',
            unitGrossPrice: 12.0,
            unitDiscountAmount: 0,
            unitNetPricePaid: 12.0,
            totalNetPaid: 12.0,
            isReturned: false,
          },
        ],
      });

      const state = useFinanceStore.getState();
      const comparisons = compareCatalogPricesByMonth(
        state.receiptItems,
        state.productCatalog,
        '2026-10',
        '2026-09',
      );

      const queijoComp = comparisons.find((c) =>
        c.productDisplayName.includes('QUEIJO PRATO'),
      );
      expect(queijoComp).toBeDefined();
      expect(queijoComp?.hasSufficientHistory).toBe(true);
      expect(queijoComp?.previousMonthAvgPrice).toBe(48.0);
      expect(queijoComp?.currentMonthAvgPrice).toBe(54.0);
      expect(queijoComp?.absoluteDelta).toBe(6.0);
      expect(queijoComp?.percentDelta).toBe(12.5);
      expect(queijoComp?.minObservedPrice).toBe(48.0);
      expect(queijoComp?.maxObservedPrice).toBe(54.0);

      // Produto comprado apenas em Outubro deve retornar "sem dados suficientes" (Seção 7)
      const azeiteComp = comparisons.find((c) =>
        c.productDisplayName.includes('AZEITE EXTRA VIRGEM'),
      );
      expect(azeiteComp).toBeDefined();
      expect(azeiteComp?.hasSufficientHistory).toBe(false);
      expect(azeiteComp?.statusLabel).toBe('sem dados suficientes');
      expect(azeiteComp?.percentDelta).toBeNull();
    });
  });

  describe('4. Normalização de Unidades e Incompatibilidade de Grandezas (Seção 7)', () => {
    it('deve converter gramas para preço por KG e mililitros para preço por Litro, impedindo comparação entre KG e L', () => {
      const priceFromGrams = computeNormalizedBaseUnitPrice(0.045, 'G'); // R$ 0,045 por grama = R$ 45,00/KG
      expect(priceFromGrams.baseUnit).toBe('KG');
      expect(priceFromGrams.pricePerBaseUnit).toBe(45.0);

      const priceFromMl = computeNormalizedBaseUnitPrice(0.012, 'ML'); // R$ 0,012 por ml = R$ 12,00/L
      expect(priceFromMl.baseUnit).toBe('L');
      expect(priceFromMl.pricePerBaseUnit).toBe(12.0);

      expect(areUnitsCompatible('KG', 'G')).toBe(true);
      expect(areUnitsCompatible('L', 'ML')).toBe(true);
      expect(areUnitsCompatible('KG', 'L')).toBe(false);
      expect(areUnitsCompatible('KG', 'UN')).toBe(false);
    });
  });
});
