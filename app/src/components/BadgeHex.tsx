import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import type { BadgeKey } from '@/theme/badges';
import { colors } from '@/theme/colors';

const ICONS: Record<BadgeKey, SFSymbol> = {
  moon: 'moon.fill',
  cloud: 'cloud.fill',
  rainbow: 'rainbow',
  aurora: 'sparkle',
};

/** Pointy-top hexagon points inside a size x size box. */
function hexPoints(size: number, inset = 0) {
  const r = size / 2 - inset;
  const c = size / 2;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
  }).join(' ');
}

/** Glossy hexagon badge. Locked badges are grey-navy with a lock in the corner. */
export function BadgeHex({ badge, unlocked, size = 56 }: { badge: BadgeKey; unlocked: boolean; size?: number }) {
  const id = `hex-${badge}-${size}`;
  return (
    <View style={[{ width: size, height: size }, unlocked && styles.glow]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.purple} />
            <Stop offset="1" stopColor={colors.blue} />
          </LinearGradient>
          <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={unlocked ? 0.35 : 0.08} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon
          points={hexPoints(size, 1)}
          fill={unlocked ? `url(#${id})` : colors.badgeLocked}
          stroke={unlocked ? 'rgba(255,255,255,0.35)' : colors.border}
          strokeWidth={1}
        />
        <Polygon points={hexPoints(size, 3)} fill={`url(#${id}-gloss)`} />
      </Svg>
      <View style={styles.icon} pointerEvents="none">
        <SymbolView name={ICONS[badge]} size={size * 0.42} tintColor={unlocked ? colors.text : colors.tabInactive} />
      </View>
      {!unlocked && (
        <View style={[styles.lock, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]}>
          <SymbolView name="lock.fill" size={size * 0.18} tintColor={colors.textSoft} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: colors.purple,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  icon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
