import {
  MeasurementUnitType,
  ProductCatalogRow,
  ReceiptItemRow,
} from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';

export type UnitDimensionGroup = 'MASS' | 'VOLUME' | 'COUNT' | 'LENGTH' | 'PACKAGE';

export interface NormalizedUnitPriceResult {
  dimensionGroup: UnitDimensionGroup;
  baseUnit: MeasurementUnitType; // 'KG' para massa, 'L' para volume, 'UN' para contagem, etc.
  pricePerBaseUnit: number;
}

export interface ProductMonthlyPriceComparison {
  comparisonGroupKey: string;
  productDisplayName: string;
  baseUnit: MeasurementUnitType;
  dimensionGroup: UnitDimensionGroup;
  currentMonthAvgPrice: number | null;
  previousMonthAvgPrice: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  minObservedPrice: number;
  maxObservedPrice: number;
  minPriceMerchant: string;
  maxPriceMerchant: string;
  hasSufficientHistory: boolean;
  statusLabel: string;
  merchantHistory: {
    merchantName: string;
    purchaseDate: string;
    unitNetPricePaid: number;
    normalizedPricePerBaseUnit: number;
  }[];
}

/**
 * Identifica a dimensão física da unidade e converte o preço líquido pago
 * para uma unidade base comparável (ex.: G -> KG, ML -> L).
 * Requisito Seção 7: "Não comparar diretamente tamanhos, unidades ou produtos incompatíveis."
 */
export function computeNormalizedBaseUnitPrice(
  unitNetPricePaid: number,
  measurementUnit: MeasurementUnitType,
  packageQuantity = 1,
): NormalizedUnitPriceResult {
  const safePkg = packageQuantity > 0 ? packageQuantity : 1;
  const effectiveUnitPrice = unitNetPricePaid / safePkg;

  switch (measurementUnit) {
    case 'KG':
      return {
        dimensionGroup: 'MASS',
        baseUnit: 'KG',
        pricePerBaseUnit: Number(effectiveUnitPrice.toFixed(4)),
      };
    case 'G':
      return {
        dimensionGroup: 'MASS',
        baseUnit: 'KG',
        // 1 KG = 1000 G -> preço por KG = preço por grama * 1000
        pricePerBaseUnit: Number((effectiveUnitPrice * 1000).toFixed(4)),
      };
    case 'L':
      return {
        dimensionGroup: 'VOLUME',
        baseUnit: 'L',
        pricePerBaseUnit: Number(effectiveUnitPrice.toFixed(4)),
      };
    case 'ML':
      return {
        dimensionGroup: 'VOLUME',
        baseUnit: 'L',
        // 1 L = 1000 ML -> preço por L = preço por ml * 1000
        pricePerBaseUnit: Number((effectiveUnitPrice * 1000).toFixed(4)),
      };
    case 'M':
      return {
        dimensionGroup: 'LENGTH',
        baseUnit: 'M',
        pricePerBaseUnit: Number(effectiveUnitPrice.toFixed(4)),
      };
    case 'CX':
    case 'PCT':
    case 'FD':
    case 'OTHER':
      return {
        dimensionGroup: 'PACKAGE',
        baseUnit: measurementUnit,
        pricePerBaseUnit: Number(effectiveUnitPrice.toFixed(4)),
      };
    case 'UN':
    default:
      return {
        dimensionGroup: 'COUNT',
        baseUnit: 'UN',
        pricePerBaseUnit: Number(effectiveUnitPrice.toFixed(4)),
      };
  }
}

/**
 * Verifica se duas unidades de medida podem ser comparadas diretamente
 * após normalização para a unidade base (ex.: KG e G são compatíveis em MASS;
 * L e ML são compatíveis em VOLUME; KG e L são INCOMPATÍVEIS).
 */
export function areUnitsCompatible(
  unitA: MeasurementUnitType,
  unitB: MeasurementUnitType,
): boolean {
  const normA = computeNormalizedBaseUnitPrice(1, unitA);
  const normB = computeNormalizedBaseUnitPrice(1, unitB);

  if (normA.dimensionGroup !== normB.dimensionGroup) {
    return false;
  }
  if (normA.dimensionGroup === 'PACKAGE') {
    return unitA === unitB;
  }
  return normA.baseUnit === normB.baseUnit;
}

/**
 * Resolve a chave de agrupamento de um item de nota fiscal para comparação histórica:
 * 1. Se o produto do catálogo tiver `equivalent_group_id` (associação manual de equivalentes), usa-o.
 * 2. Se tiver `ean_barcode` válido, agrupa pelo EAN + dimensão base.
 * 3. Caso contrário, agrupa pelo `normalized_product_name` + unidade base.
 */
export function resolveProductComparisonKey(
  item: Pick<
    ReceiptItemRow,
    'product_id' | 'normalized_product_name' | 'ean_barcode' | 'measurement_unit'
  >,
  catalogMap: ReadonlyMap<string, ProductCatalogRow>,
): { groupKey: string; displayName: string; baseUnit: MeasurementUnitType; dimensionGroup: UnitDimensionGroup } {
  const catalogEntry = item.product_id ? catalogMap.get(item.product_id) : undefined;
  const normUnit = computeNormalizedBaseUnitPrice(
    1,
    item.measurement_unit,
    catalogEntry?.package_quantity ?? 1,
  );

  if (catalogEntry?.equivalent_group_id) {
    return {
      groupKey: `equiv:${catalogEntry.equivalent_group_id}:${normUnit.baseUnit}`,
      displayName: catalogEntry.normalized_name,
      baseUnit: normUnit.baseUnit,
      dimensionGroup: normUnit.dimensionGroup,
    };
  }

  if (item.ean_barcode && item.ean_barcode.trim().length >= 8) {
    return {
      groupKey: `ean:${item.ean_barcode.trim()}:${normUnit.baseUnit}`,
      displayName: catalogEntry?.normalized_name ?? item.normalized_product_name,
      baseUnit: normUnit.baseUnit,
      dimensionGroup: normUnit.dimensionGroup,
    };
  }

  return {
    groupKey: `name:${item.normalized_product_name}:${normUnit.baseUnit}`,
    displayName: catalogEntry?.normalized_name ?? item.normalized_product_name,
    baseUnit: normUnit.baseUnit,
    dimensionGroup: normUnit.dimensionGroup,
  };
}

/**
 * Compara os preços efetivamente pagos (líquidos de desconto e ignorando itens devolvidos)
 * entre o mês atual e o mês anterior (Seção 7):
 * - Calcula variação absoluta em R$, variação %, menor e maior preço observado e evolução por estabelecimento.
 * - Se não houver histórico comparável entre os dois meses, retorna `hasSufficientHistory: false`
 *   e `statusLabel: 'sem dados suficientes'`, jamais inventando uma variação.
 */
export function compareCatalogPricesByMonth(
  receiptItems: readonly ReceiptItemRow[],
  catalogProducts: readonly ProductCatalogRow[],
  currentYearMonth: string, // 'YYYY-MM'
  previousYearMonth: string, // 'YYYY-MM'
): ProductMonthlyPriceComparison[] {
  const catalogMap = new Map<string, ProductCatalogRow>();
  for (const prod of catalogProducts) {
    catalogMap.set(prod.id, prod);
  }

  const groups = new Map<
    string,
    {
      displayName: string;
      baseUnit: MeasurementUnitType;
      dimensionGroup: UnitDimensionGroup;
      entries: {
        purchaseDate: string;
        merchantName: string;
        unitNetPricePaid: number;
        normalizedPricePerBaseUnit: number;
      }[];
    }
  >();

  for (const item of receiptItems) {
    // Ignorar devoluções / cancelamentos (Seção 7)
    if (item.is_returned || item.quantity <= 0 || item.unit_net_price_paid <= 0) {
      continue;
    }

    const catalogEntry = item.product_id ? catalogMap.get(item.product_id) : undefined;
    const { groupKey, displayName, baseUnit, dimensionGroup } =
      resolveProductComparisonKey(item, catalogMap);

    const normalizedPrice =
      item.normalized_price_per_base_unit ??
      computeNormalizedBaseUnitPrice(
        item.unit_net_price_paid,
        item.measurement_unit,
        catalogEntry?.package_quantity ?? 1,
      ).pricePerBaseUnit;

    const existing = groups.get(groupKey);
    const entry = {
      purchaseDate: item.purchase_date,
      merchantName: item.merchant_name,
      unitNetPricePaid: item.unit_net_price_paid,
      normalizedPricePerBaseUnit: normalizedPrice,
    };

    if (!existing) {
      groups.set(groupKey, {
        displayName,
        baseUnit,
        dimensionGroup,
        entries: [entry],
      });
    } else {
      existing.entries.push(entry);
    }
  }

  const results: ProductMonthlyPriceComparison[] = [];

  for (const [groupKey, group] of groups.entries()) {
    const sortedEntries = [...group.entries].sort((a, b) =>
      a.purchaseDate.localeCompare(b.purchaseDate),
    );

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minMerchant = '-';
    let maxMerchant = '-';

    const currentMonthPrices: number[] = [];
    const previousMonthPrices: number[] = [];

    for (const e of sortedEntries) {
      if (e.normalizedPricePerBaseUnit < minPrice) {
        minPrice = e.normalizedPricePerBaseUnit;
        minMerchant = e.merchantName;
      }
      if (e.normalizedPricePerBaseUnit > maxPrice) {
        maxPrice = e.normalizedPricePerBaseUnit;
        maxMerchant = e.merchantName;
      }

      if (e.purchaseDate.startsWith(currentYearMonth)) {
        currentMonthPrices.push(e.normalizedPricePerBaseUnit);
      } else if (e.purchaseDate.startsWith(previousYearMonth)) {
        previousMonthPrices.push(e.normalizedPricePerBaseUnit);
      }
    }

    const avg = (arr: number[]): number | null => {
      if (arr.length === 0) return null;
      const sum = arr.reduce((a, b) => a + b, 0);
      return Number((sum / arr.length).toFixed(2));
    };

    const currentAvg = avg(currentMonthPrices);
    const previousAvg = avg(previousMonthPrices);

    const hasSufficientHistory =
      currentAvg != null && previousAvg != null && previousAvg > 0;

    let absoluteDelta: number | null = null;
    let percentDelta: number | null = null;
    let statusLabel = 'sem dados suficientes';

    if (hasSufficientHistory && currentAvg != null && previousAvg != null) {
      const deltaCents = toCents(currentAvg) - toCents(previousAvg);
      absoluteDelta = fromCents(deltaCents);
      percentDelta = Number(((deltaCents / toCents(previousAvg)) * 100).toFixed(2));

      if (deltaCents > 0) {
        statusLabel = `aumento de +${percentDelta.toFixed(2)}%`;
      } else if (deltaCents < 0) {
        statusLabel = `redução de ${percentDelta.toFixed(2)}%`;
      } else {
        statusLabel = 'estável (0,00%)';
      }
    }

    results.push({
      comparisonGroupKey: groupKey,
      productDisplayName: group.displayName,
      baseUnit: group.baseUnit,
      dimensionGroup: group.dimensionGroup,
      currentMonthAvgPrice: currentAvg,
      previousMonthAvgPrice: previousAvg,
      absoluteDelta,
      percentDelta,
      minObservedPrice: Number(minPrice.toFixed(2)),
      maxObservedPrice: Number(maxPrice.toFixed(2)),
      minPriceMerchant: minMerchant,
      maxPriceMerchant: maxMerchant,
      hasSufficientHistory,
      statusLabel,
      merchantHistory: sortedEntries,
    });
  }

  return results.sort((a, b) => {
    const absA = a.percentDelta != null ? Math.abs(a.percentDelta) : -1;
    const absB = b.percentDelta != null ? Math.abs(b.percentDelta) : -1;
    return absB - absA;
  });
}
