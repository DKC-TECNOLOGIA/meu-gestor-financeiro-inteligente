import { MeasurementUnitType, ReceiptSourceType } from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';

const UF_IBGE_MAP: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

export interface ParsedAccessKeyInfo {
  accessKey: string;
  ufCode: string;
  ufSigla: string;
  yearMonth: string; // 'YYYY-MM'
  merchantCnpj: string;
  model: string;
  series: string;
  receiptNumber: string;
  emissionType: string;
  checkDigit: string;
  isValidCheckDigit: boolean;
}

export interface ParsedReceiptItemDraft {
  itemSequence: number;
  originalProductName: string;
  normalizedProductName: string;
  brand: string | null;
  eanBarcode: string | null;
  quantity: number;
  measurementUnit: MeasurementUnitType;
  unitGrossPrice: number;
  unitDiscountAmount: number;
  unitNetPricePaid: number;
  totalNetPaid: number;
  isReturned: boolean;
}

export interface ParsedReceiptDraft {
  accessKey: string | null;
  receiptNumber: string | null;
  series: string | null;
  issuerUf: string;
  merchantName: string;
  merchantTradeName: string | null;
  merchantCnpj: string | null;
  issuedAt: string; // ISO
  totalGrossAmount: number;
  totalDiscountAmount: number;
  totalPaidAmount: number;
  sourceType: ReceiptSourceType;
  qrCodeRawUrl: string | null;
  requiresAssistedReview: boolean;
  statusMessage: string;
  items: ParsedReceiptItemDraft[];
}

/**
 * Calcula o dígito verificador (Módulo 11) dos primeiros 43 dígitos da chave de acesso NFe/NFC-e.
 */
export function calculateAccessKeyCheckDigit(first43Digits: string): string {
  if (!/^\d{43}$/.test(first43Digits)) {
    throw new Error('São necessários 43 dígitos numéricos para calcular o DV.');
  }
  let weight = 2;
  let sum = 0;
  for (let i = 42; i >= 0; i--) {
    const digit = Number(first43Digits[i]);
    sum += digit * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return String(dv);
}

/**
 * Valida e decompõe uma chave de acesso de 44 dígitos de NF-e / NFC-e.
 */
export function parseAndValidateAccessKey(rawKey: string): ParsedAccessKeyInfo {
  const digits = rawKey.replace(/\D/g, '');
  if (digits.length !== 44) {
    throw new Error(
      `Chave de acesso inválida: esperados 44 dígitos numéricos, recebidos ${digits.length}.`,
    );
  }

  const ufCode = digits.slice(0, 2);
  const ufSigla = UF_IBGE_MAP[ufCode] ?? 'BA';
  const yy = digits.slice(2, 4);
  const mm = digits.slice(4, 6);
  const merchantCnpj = digits.slice(6, 20);
  const model = digits.slice(20, 22);
  const series = String(Number(digits.slice(22, 25)));
  const receiptNumber = String(Number(digits.slice(25, 34)));
  const emissionType = digits.slice(34, 35);
  const checkDigit = digits.slice(43, 44);

  const expectedDv = calculateAccessKeyCheckDigit(digits.slice(0, 43));
  const isValidCheckDigit = checkDigit === expectedDv;

  if (!isValidCheckDigit) {
    throw new Error(
      `Dígito verificador da chave de acesso inválido (esperado ${expectedDv}, encontrado ${checkDigit}).`,
    );
  }

  return {
    accessKey: digits,
    ufCode,
    ufSigla,
    yearMonth: `20${yy}-${mm}`,
    merchantCnpj,
    model,
    series,
    receiptNumber,
    emissionType,
    checkDigit,
    isValidCheckDigit,
  };
}

/**
 * Normaliza o nome de um produto de supermercado removendo códigos internos,
 * espaços duplicados e padronizando caixa alta sem acentos para catálogo.
 */
export function normalizeProductName(rawName: string): string {
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s.,/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Padroniza a unidade comercial da nota fiscal para o enum MeasurementUnitType.
 */
export function normalizeMeasurementUnit(rawUnit: string): MeasurementUnitType {
  const upper = rawUnit.trim().toUpperCase();
  if (upper === 'KG' || upper === 'QUILO' || upper === 'KILO') return 'KG';
  if (upper === 'G' || upper === 'GR' || upper === 'GRAMA') return 'G';
  if (upper === 'L' || upper === 'LT' || upper === 'LITRO') return 'L';
  if (upper === 'ML' || upper === 'MILILITRO') return 'ML';
  if (upper === 'CX' || upper === 'CAIXA') return 'CX';
  if (upper === 'PCT' || upper === 'PACOTE' || upper === 'PC') return 'PCT';
  if (upper === 'FD' || upper === 'FARDO') return 'FD';
  if (upper === 'M' || upper === 'MT' || upper === 'METRO') return 'M';
  if (upper === 'UN' || upper === 'UND' || upper === 'UNID' || upper === 'UNIDADE') {
    return 'UN';
  }
  return 'OTHER';
}

/**
 * Interpreta o conteúdo lido de um QR Code de NFC-e (URL da SEFAZ-BA ou de outra UF, ou chave direta).
 */
export function parseNfceQrCodeContent(qrContent: string): ParsedReceiptDraft {
  const trimmed = qrContent.trim();
  if (!trimmed) {
    throw new Error('O conteúdo do QR Code está vazio.');
  }

  // Extrair sequência de 44 dígitos presente na URL (`?p=44digitos|2|1|...` ou `?chNFe=44digitos`)
  const match44 = trimmed.match(/(\d{44})/);
  if (!match44 || !match44[1]) {
    throw new Error(
      'Não foi possível localizar a chave de acesso de 44 dígitos no QR Code da NFC-e.',
    );
  }

  const keyInfo = parseAndValidateAccessKey(match44[1]);
  const defaultIssuedDate = `${keyInfo.yearMonth}-15T12:00:00.000Z`;

  const isBahiaSefazUrl =
    trimmed.toLowerCase().includes('sefaz.ba.gov.br') || keyInfo.ufSigla === 'BA';

  return {
    accessKey: keyInfo.accessKey,
    receiptNumber: keyInfo.receiptNumber,
    series: keyInfo.series,
    issuerUf: keyInfo.ufSigla,
    merchantName: `Estabelecimento CNPJ ${keyInfo.merchantCnpj}`,
    merchantTradeName: null,
    merchantCnpj: keyInfo.merchantCnpj,
    issuedAt: defaultIssuedDate,
    totalGrossAmount: 0,
    totalDiscountAmount: 0,
    totalPaidAmount: 0,
    sourceType: 'qr_code',
    qrCodeRawUrl: trimmed.startsWith('http') ? trimmed : null,
    requiresAssistedReview: true,
    statusMessage: isBahiaSefazUrl
      ? 'Chave de acesso NFC-e da Bahia (SEFAZ-BA) validada. Caso o portal SEFAZ exija CAPTCHA, importe o XML ou revise/adicione os itens abaixo antes de confirmar.'
      : `Chave de acesso NFC-e (${keyInfo.ufSigla}) validada com sucesso. Revise os itens antes de salvar.`,
    items: [],
  };
}

function extractXmlTagValue(xmlBlock: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlBlock.match(regex);
  return match && match[1] != null ? match[1].trim() : null;
}

/**
 * Faz o parse completo de um arquivo XML oficial de NF-e / NFC-e (`procNFe` ou `NFe`),
 * extraindo estabelecimento, CNPJ, chave de 44 dígitos, data, produtos, quantidades,
 * preços unitários, descontos e totais com precisão.
 */
export function parseNfceXmlContent(xmlContent: string): ParsedReceiptDraft {
  const trimmed = xmlContent.trim();
  if (!trimmed.includes('<NFe') && !trimmed.includes('<nfeProc')) {
    throw new Error(
      'O arquivo selecionado não é um XML válido de Nota Fiscal Eletrônica (NFC-e / NF-e).',
    );
  }

  // Extrair Chave de Acesso (de <chNFe> ou Id="NFe44digitos")
  let rawKey = extractXmlTagValue(trimmed, 'chNFe');
  if (!rawKey) {
    const idMatch = trimmed.match(/Id=["']NFe(\d{44})["']/i);
    if (idMatch?.[1]) {
      rawKey = idMatch[1];
    }
  }

  const keyInfo = rawKey ? parseAndValidateAccessKey(rawKey) : null;

  // Bloco <ide>
  const ideBlock = extractXmlTagValue(trimmed, 'ide') ?? trimmed;
  const nNF = extractXmlTagValue(ideBlock, 'nNF') ?? keyInfo?.receiptNumber ?? null;
  const serie = extractXmlTagValue(ideBlock, 'serie') ?? keyInfo?.series ?? null;
  const dhEmi =
    extractXmlTagValue(ideBlock, 'dhEmi') ??
    extractXmlTagValue(ideBlock, 'dEmi') ??
    new Date().toISOString();

  // Bloco <emit>
  const emitBlock = extractXmlTagValue(trimmed, 'emit') ?? trimmed;
  const merchantName =
    extractXmlTagValue(emitBlock, 'xNome') ?? 'Estabelecimento Fiscal';
  const merchantTradeName = extractXmlTagValue(emitBlock, 'xFant');
  const merchantCnpj =
    extractXmlTagValue(emitBlock, 'CNPJ') ?? keyInfo?.merchantCnpj ?? null;
  const issuerUf = extractXmlTagValue(emitBlock, 'UF') ?? keyInfo?.ufSigla ?? 'BA';

  // Extrair itens <det nItem="...">
  const detMatches = [...trimmed.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/gi)];
  const items: ParsedReceiptItemDraft[] = detMatches.map((match, idx) => {
    const detBody = match[1] ?? '';
    const prodBlock = extractXmlTagValue(detBody, 'prod') ?? detBody;

    const originalName =
      extractXmlTagValue(prodBlock, 'xProd') ?? `ITEM ${idx + 1}`;
    const rawEan = extractXmlTagValue(prodBlock, 'cEAN');
    const eanBarcode =
      rawEan && rawEan !== 'SEM GTIN' && /^\d{8,14}$/.test(rawEan) ? rawEan : null;

    const qCom = Number(extractXmlTagValue(prodBlock, 'qCom') ?? '1');
    const uCom = normalizeMeasurementUnit(
      extractXmlTagValue(prodBlock, 'uCom') ?? 'UN',
    );
    const vUnCom = Number(extractXmlTagValue(prodBlock, 'vUnCom') ?? '0');
    const vProd = Number(
      extractXmlTagValue(prodBlock, 'vProd') ?? String(qCom * vUnCom),
    );
    const vDesc = Number(extractXmlTagValue(prodBlock, 'vDesc') ?? '0');

    const safeQty = qCom > 0 ? qCom : 1;
    const totalNetCents = Math.max(0, toCents(vProd) - toCents(vDesc));
    const totalNetPaid = fromCents(totalNetCents);
    const unitDiscountAmount = Number((vDesc / safeQty).toFixed(4));
    const unitNetPricePaid = Number((totalNetPaid / safeQty).toFixed(4));

    return {
      itemSequence: idx + 1,
      originalProductName: originalName,
      normalizedProductName: normalizeProductName(originalName),
      brand: null,
      eanBarcode,
      quantity: Number(safeQty.toFixed(4)),
      measurementUnit: uCom,
      unitGrossPrice: Number(vUnCom.toFixed(4)),
      unitDiscountAmount,
      unitNetPricePaid,
      totalNetPaid,
      isReturned: false,
    };
  });

  // Bloco <ICMSTot> para totais da nota
  const icmsTotBlock = extractXmlTagValue(trimmed, 'ICMSTot');
  const xmlGross = icmsTotBlock
    ? Number(extractXmlTagValue(icmsTotBlock, 'vProd') ?? '0')
    : 0;
  const xmlDiscount = icmsTotBlock
    ? Number(extractXmlTagValue(icmsTotBlock, 'vDesc') ?? '0')
    : 0;
  const xmlNet = icmsTotBlock
    ? Number(extractXmlTagValue(icmsTotBlock, 'vNF') ?? '0')
    : 0;

  const computedGross = fromCents(
    items.reduce(
      (acc, it) => acc + toCents(it.unitGrossPrice * it.quantity),
      0,
    ),
  );
  const computedDiscount = fromCents(
    items.reduce(
      (acc, it) => acc + toCents(it.unitDiscountAmount * it.quantity),
      0,
    ),
  );
  const computedNet = fromCents(
    items.reduce((acc, it) => acc + toCents(it.totalNetPaid), 0),
  );

  return {
    accessKey: keyInfo?.accessKey ?? null,
    receiptNumber: nNF,
    series: serie,
    issuerUf,
    merchantName,
    merchantTradeName,
    merchantCnpj,
    issuedAt: dhEmi,
    totalGrossAmount: xmlGross > 0 ? xmlGross : computedGross,
    totalDiscountAmount: xmlDiscount > 0 ? xmlDiscount : computedDiscount,
    totalPaidAmount: xmlNet > 0 ? xmlNet : computedNet,
    sourceType: 'xml_import',
    qrCodeRawUrl: null,
    requiresAssistedReview: false,
    statusMessage: `XML fiscal importado com sucesso (${items.length} item(ns) extraído(s)). Revise antes de confirmar.`,
    items,
  };
}
