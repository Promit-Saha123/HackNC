import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { BadgeHex } from '@/components/BadgeHex';
import { Card, Divider } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen, Section } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { SAMPLE_BEST_STREAK } from '@/data/sample';
import { useOverview } from '@/hooks/use-overview';
import { BADGES, type BadgeKey } from '@/theme/badges';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';
import { badgeStates } from '@/utils/badges';

const RULE = 'A night counts if you sleep 7 hours or more and go to bed within 1 hour of your usual bedtime.';

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function AchievementsScreen() {
  const { overview, error, refreshing, refresh } = useOverview();
  const [open, setOpen] = useState<BadgeKey | null>(null);

  const streak = overview?.streak_days ?? 0;
  const best = Math.max(streak, SAMPLE_BEST_STREAK);
  const badges = badgeStates(streak, overview?.badge);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const next = badges.find((b) => !b.unlocked);
  const recent = badges.filter((b) => b.unlocked && b.earned).reverse();
  const selected = badges.find((b) => b.key === open);

  return (
    <Screen
      title="Achievements"
      subtitle={`${unlockedCount} of ${BADGES.length} unlocked`}
      right={<Avatar name={overview?.user.name ?? '?'} />}
      refreshing={refreshing}
      onRefresh={refresh}>
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <Card onPress={next ? () => setOpen(next.key) : undefined}>
        <View style={styles.streakRow}>
          <StreakRing value={next ? streak / next.nights : 1} />
          <View style={styles.streakText}>
            <Text style={t.rowTitle}>{streak}-night streak</Text>
            <Text style={t.body}>
              {next
                ? `${next.nights - streak} more ${next.nights - streak === 1 ? 'night' : 'nights'} to unlock ${next.label}`
                : 'Every badge unlocked'}
            </Text>
          </View>
          {next && <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />}
        </View>
        <Divider />
        <View style={styles.bestRow}>
          <View style={styles.bestCell}>
            <Text style={t.caption}>Current</Text>
            <Text style={t.rowTitle}>{streak} nights</Text>
          </View>
          <View style={styles.vline} />
          <View style={styles.bestCell}>
            <Text style={t.caption}>Best streak</Text>
            <Text style={t.rowTitle}>{best} nights</Text>
          </View>
        </View>
      </Card>

      <Section title="Badges">
        <View style={styles.grid}>
          {badges.map((b) => (
            <Card key={b.key} style={styles.gridCard} onPress={() => setOpen(b.key)}>
              <View style={styles.gridInner}>
                <BadgeHex badge={b.key} unlocked={b.unlocked} />
                <Text style={[t.rowTitle, !b.unlocked && styles.lockedText]}>{b.label}</Text>
                {b.unlocked ? (
                  <UnlockedPill />
                ) : (
                  <View style={styles.progress}>
                    <ProgressBar value={b.progress} />
                    <Text style={t.caption}>
                      {Math.min(streak, b.nights)}/{b.nights}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          ))}
        </View>
      </Section>

      {recent.length > 0 && (
        <Section title="Recent">
          <Card padding={0}>
            {recent.map((b, i) => (
              <View key={b.key}>
                {i > 0 && <Divider />}
                <Pressable style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]} onPress={() => setOpen(b.key)}>
                  <BadgeHex badge={b.key} unlocked size={36} />
                  <View style={styles.recentText}>
                    <Text style={t.rowTitle}>{b.label}</Text>
                    <Text style={t.caption}>Unlocked · {b.earned ? shortDate(b.earned) : ''}</Text>
                  </View>
                  <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />
                </Pressable>
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Text style={[t.caption, styles.note]}>Best streak is sample data for now.</Text>

      <Sheet visible={!!selected} onClose={() => setOpen(null)}>
        {selected && (
          <View style={styles.detail}>
            <BadgeHex badge={selected.key} unlocked={selected.unlocked} size={120} />
            <Text style={t.title}>{selected.label}</Text>
            <Text style={[t.body, styles.centerText, styles.blurb]}>{selected.blurb}</Text>
            <Card style={styles.howCard}>
              <Text style={t.rowTitle}>How to earn it</Text>
              <Text style={t.body}>
                Keep a {selected.nights}-night streak. {RULE}
              </Text>
            </Card>
            {selected.unlocked ? (
              <View style={styles.detailStatus}>
                <UnlockedPill />
                {selected.earned && <Text style={t.caption}>Earned {shortDate(selected.earned)}</Text>}
              </View>
            ) : (
              <View style={styles.detailProgress}>
                <ProgressBar value={selected.progress} height={6} />
                <Text style={[t.body, styles.centerText]}>
                  {Math.min(streak, selected.nights)}/{selected.nights} · {selected.nights - streak} more{' '}
                  {selected.nights - streak === 1 ? 'night' : 'nights'}
                </Text>
              </View>
            )}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

function UnlockedPill() {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>Unlocked</Text>
    </View>
  );
}

/** Small ring around a moon: progress toward the next badge. */
function StreakRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="streak" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accentEnd} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ringTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#streak)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringIcon}>
        <SymbolView name="moon.fill" size={20} tintColor={colors.text} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  streakText: { flex: 1, gap: 2 },
  ringIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bestRow: { flexDirection: 'row', paddingTop: spacing.md },
  bestCell: { flex: 1, alignItems: 'center', gap: 2 },
  vline: { width: 1, backgroundColor: colors.divider },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridCard: { width: '48%' },
  gridInner: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  lockedText: { color: colors.textSoft },
  progress: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
  pill: { backgroundColor: colors.unlockedBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: colors.unlockedText, fontFamily: fontFamily.semibold, fontSize: 12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  recentText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.8 },
  note: { textAlign: 'center' },
  detail: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  centerText: { textAlign: 'center' },
  blurb: { color: colors.text },
  howCard: { alignSelf: 'stretch' },
  detailStatus: { alignItems: 'center', gap: spacing.xs },
  detailProgress: { alignSelf: 'stretch', gap: spacing.sm },
});
