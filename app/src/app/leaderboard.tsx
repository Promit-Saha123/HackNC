import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import type { LeaderboardEntry, Period } from '@/api/types';
import { GlassCard } from '@/components/GlassCard';
import { SkyBackground } from '@/components/SkyBackground';
import { BottomTabInset } from '@/constants/theme';
import { useUser } from '@/state/user';
import { BADGE_EMOJI } from '@/theme/badges';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'all', label: 'All time' },
];

export default function LeaderboardScreen() {
  const { userId } = useUser();
  const [period, setPeriod] = useState<Period>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .leaderboard(period)
      .then((l) => {
        if (live) {
          setEntries(l.entries);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setRefreshing(false);
      });
    return () => {
      live = false;
    };
  }, [period, tick]);

  return (
    <SkyBackground>
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.user_id)}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTick((t) => t + 1);
              }}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Leaderboard</Text>
              <View style={styles.toggle}>
                {PERIODS.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => setPeriod(p.key)}
                    style={[styles.pill, p.key === period && styles.pillActive]}>
                    <Text style={[styles.pillText, p.key === period && styles.pillTextActive]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
              {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard style={[styles.row, item.user_id === userId && styles.me]}>
              <Text style={styles.rank}>{item.rank}</Text>
              <View style={styles.who}>
                <Text style={styles.name}>
                  {item.name}
                  {item.user_id === userId ? ' (you)' : ''}
                </Text>
                <Text style={styles.sub}>
                  {item.squad ?? 'No squad'} · {item.streak_days} night streak
                </Text>
              </View>
              <Text style={styles.badge}>{item.badge ? BADGE_EMOJI[item.badge] : ''}</Text>
              <Text style={styles.score}>{Math.round(item.score)}</Text>
            </GlassCard>
          )}
        />
      </SafeAreaView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: BottomTabInset + spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  toggle: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  pillActive: { backgroundColor: colors.green },
  pillText: { color: colors.text, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  error: { color: '#B3261E' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  me: { borderWidth: 2, borderColor: colors.green },
  rank: { width: 28, fontSize: 20, fontWeight: '800', color: colors.textSoft },
  who: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { color: colors.textSoft, fontSize: 13 },
  badge: { fontSize: 22 },
  score: { fontSize: 26, fontWeight: '800', color: colors.text },
});