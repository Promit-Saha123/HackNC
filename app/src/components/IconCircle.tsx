import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { Glass } from '@/components/Glass';
import { colors } from '@/theme/colors';

type Props = { name: SFSymbol; size?: number; color?: string };

/** Glass orb holding one icon: same glass as the cards, plus a soft 3D highlight like a bubble. */
export function IconCircle({ name, size = 44, color = colors.text }: Props) {
  const c = size / 2;
  return (
    <Glass style={[styles.circle, { width: size, height: size, borderRadius: c }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="orb" cx="38%" cy="30%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.22} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#orb)" />
        <Ellipse
          cx={c * 0.7}
          cy={c * 0.48}
          rx={c * 0.32}
          ry={c * 0.16}
          fill="#FFFFFF"
          opacity={0.75}
          transform={`rotate(-30 ${c * 0.7} ${c * 0.48})`}
        />
      </Svg>
      <SymbolView name={name} size={size * 0.45} tintColor={color} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
