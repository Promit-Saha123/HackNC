import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { GlossCap } from '@/components/GlossCap';
import { RankChange } from '@/components/RankChange';
import { colors } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

type Props = {
  top: LeaderboardEntry[];
  meId: number;
  /** Text under each name (score, or "+12" for most improved). */
  valueOf: (e: LeaderboardEntry) => string;
  /** Places moved since yesterday; omit to hide the arrows. */
  delta?: (e: LeaderboardEntry) => number;
  onPress: (e: LeaderboardEntry) => void;
};

const SPOT = {
  1: { avatar: 80, block: 92 },
  2: { avatar: 64, block: 68 },
  3: { avatar: 64, block: 52 },
} as const;

/** Top three: 2nd on the left, 1st in the middle (with a crown), 3rd on the right. */
export function Podium({ top, meId, valueOf, delta, onPress }: Props) {
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <View style={styles.row}>
      {order.map((e) => {
        const place = (top.indexOf(e) + 1) as 1 | 2 | 3;
        const spot = SPOT[place];
        const me = e.user_id === meId;
        return (
          <Pressable key={e.user_id} style={({ pressed }) => [styles.col, pressed && styles.pressed]} onPress={() => onPress(e)}>
            {place === 1 ? (
              <SymbolView name="crown.fill" size={26} tintColor={colors.accent} />
            ) : (
              <View style={styles.crownSpace} />
            )}
            <View>
              <Avatar name={e.name} size={spot.avatar} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{place}</Text>
              </View>
            </View>
            <Text style={[styles.name, me && styles.me]} numberOfLines={1}>
              {me ? 'You' : e.name}
            </Text>
            <Text style={styles.value}>{valueOf(e)}</Text>
            {delta && <RankChange delta={delta(e)} />}
            <View style={[styles.block, { height: spot.block }]}>
              <LinearGradient
                colors={place === 1 ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)'] : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)']}
                style={StyleSheet.absoluteFill}
              />
              <GlossCap strength={place === 1 ? 0.45 : 0.3} />
              <Text style={styles.blockNum}>{place}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.8 },
  crownSpace: { height: 0 },
  badge: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: 11 },
  name: { marginTop: 8, fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text, maxWidth: '100%' },
  me: { color: colors.unlockedText },
  value: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  block: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockNum: { fontFamily: fontFamily.bold, fontSize: 28, color: 'rgba(245,246,247,0.35)' },
});
