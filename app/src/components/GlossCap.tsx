import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  /** 0-1 peak whiteness of the shine. */
  strength?: number;
  /** 'top' = shine on the upper half (cards, pills, buttons); 'side' = shine down the left side (vertical bars). */
  direction?: 'top' | 'side';
  style?: StyleProp<ViewStyle>;
};

/**
 * Frutiger Aero gloss: a bright highlight that fades and then cuts off crisply, so a flat fill reads as glass.
 * Drop it inside any filled, overflow-hidden shape.
 */
export function GlossCap({ strength = 0.5, direction = 'top', style }: Props) {
  const w = (k: number) => `rgba(255,255,255,${(strength * k * 0.6).toFixed(3)})`;
  const side = direction === 'side';
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[w(1), w(0.4), w(0.12), 'rgba(255,255,255,0)']}
      locations={[0, 0.3, 0.46, 0.52]}
      start={side ? { x: 0, y: 0 } : { x: 0, y: 0 }}
      end={side ? { x: 1, y: 0 } : { x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
