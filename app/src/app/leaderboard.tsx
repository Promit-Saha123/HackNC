import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry, Period } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { useUser } from '@/state/user';
import { colors, scoreBand } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'all', label: 'All-time' },
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
    <Screen
      title="Leaderboard"
      subtitle={period === 'week' ? 'This week' : 'All time'}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTick((n) => n + 1);
      }}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <Card padding={0}>
        {entries.map((e, i) => {
          const me = e.user_id === userId;
          return (
            <View key={e.user_id}>
              {i > 0 && <Divider />}
              <View style={[styles.row, me && styles.me]}>
                <Text style={styles.rank}>{e.rank}</Text>
                <Avatar name={e.name} size={40} glow={false} />
                <View style={styles.who}>
                  <Text style={t.rowTitle}>{me ? `${e.name} (you)` : e.name}</Text>
                  <Text style={t.caption}>
                    {e.streak_days} night streak{e.squad ? ` · ${e.squad}` : ''}
                  </Text>
                </View>
                <Text style={[styles.score, { color: colors[scoreBand(e.score)] }]}>{Math.round(e.score)}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  me: { backgroundColor: colors.highlight },
  rank: { width: 22, fontFamily: fontFamily.semibold, fontSize: 16, color: colors.textSoft, textAlign: 'center' },
  who: { flex: 1, gap: 2 },
  score: { fontFamily: fontFamily.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
});
