import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from './theme';

/**
 * Linha de tendência minimalista (sem eixos). Recebe a série já calculada a
 * partir de dados reais — o componente apenas desenha.
 */
export function Sparkline({
  values,
  width,
  height = 56,
  color = colors.accentOnDeep,
  fillOpacity = 0.18,
}: {
  values: readonly number[];
  width: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}) {
  const geometry = useMemo(() => {
    if (values.length < 2 || width <= 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 4;
    const stepX = (width - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => ({
      x: pad + i * stepX,
      y: pad + (height - pad * 2) * (1 - (v - min) / span),
    }));
    // Curva suave (Catmull-Rom → Bézier)
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i - 1] ?? pts[i]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    const last = pts[pts.length - 1]!;
    const area = `${d} L ${last.x} ${height} L ${pts[0]!.x} ${height} Z`;
    return { d, area, last };
  }, [values, width, height]);

  if (!geometry) return <View style={{ height }} />;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={fillOpacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={geometry.area} fill="url(#spark)" />
      <Path d={geometry.d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={geometry.last.x} cy={geometry.last.y} r={3.5} fill={color} />
    </Svg>
  );
}
