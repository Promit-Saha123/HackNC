import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { Podium } from '@/components/Podium';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { FriendSheet } from '@/components/sheets/FriendSheet';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { useUser } from '@/state/user';
import { colors, scoreBand } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Board = 'week' | 'all' | 'improved';

const BOARDS: { key: Board; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'all', label: 'All-time' },
  { key: 'improved', label: 'Improved' },
];

const SUBTITLE: Record<Board, string> = {
  week: 'This week · resets Monday',
  all: 'All time',
  improved: 'Biggest gains this week',
};

/** Score change across the week: average of the last 3 nights minus the first 4. */
function improvement(scores: number[]) {
  if (scores.length < 4) return 0;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.round(avg(scores.slice(-3)) - avg(scores.slice(0, scores.length - 3)));
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function LeaderboardScreen() {
  const { userId } = useUser();
  const [board, setBoard] = useState<Board>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [gains, setGains] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [friend, setFriend] = useState<LeaderboardEntry | null>(null);
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const list = await api.leaderboard(board === 'all' ? 'all' : 'week');
      if (board !== 'improved') return { entries: list.entries, gains: {} };
      // TODO(P1): a real "most improved" board needs last week's scores; this compares early vs late this week.
      const overviews = await Promise.all(list.entries.map((e) => api.overview(e.user_id)));
      const g: Record<number, number> = {};
      overviews.forEach((o) => (g[o.user.id] = improvement(o.history.map((h) => h.score))));
      const ranked = [...list.entries]
        .sort((a, b) => g[b.user_id] - g[a.user_id])
        .map((e, i) => ({ ...e, rank: i + 1 }));
      return { entries: ranked, gains: g };
    };
    load()
      .then((r) => {
        if (live) {
          setEntries(r.entries);
          setGains(r.gains);
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
  }, [board, tick]);

  const valueOf = (e: LeaderboardEntry) =>
    board === 'improved' ? signed(gains[e.user_id] ?? 0) : `${Math.round(e.score)}`;
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);

  const boardInfo = (): Info => ({
    title: BOARDS.find((b) => b.key === board)!.label,
    body:
      board === 'improved'
        ? [
            'Most improved ranks people by how much their score went up, compared only to their own earlier nights. It replaces any "worst sleeper" list.',
            'For now it compares the last 3 nights with the start of this week.',
          ]
        : board === 'week'
          ? ['Ranks everyone by their average nightly score this week. It resets every Monday so newcomers get a shot.']
          : ['Ranks everyone by their average nightly score since they joined.'],
  });

  return (
    <Screen
      title="Leaderboard"
      subtitle={SUBTITLE[board]}
      right={
        <Pressable hitSlop={8} onPress={() => setInfo(boardInfo())} style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}>
          <SymbolView name="info.circle" size={20} tintColor={colors.text} />
        </Pressable>
      }
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTick((n) => n + 1);
      }}>
      <Segmented options={BOARDS} value={board} onChange={setBoard} />
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      {top.length > 0 && <Podium top={top} meId={userId} valueOf={valueOf} onPress={setFriend} />}

      {rest.length > 0 && (
        <Card padding={0}>
          {rest.map((e, i) => {
            const me = e.user_id === userId;
            const gain = gains[e.user_id] ?? 0;
            return (
              <View key={e.user_id}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => [styles.row, me && styles.me, pressed && styles.pressed]}
                  onPress={() => setFriend(e)}>
                  <Text style={styles.rank}>{e.rank}</Text>
                  <Avatar name={e.name} size={40} glow={false} />
                  <View style={styles.who}>
                    <Text style={t.rowTitle}>{me ? 'You' : e.name}</Text>
                    <View style={styles.streak}>
                      <SymbolView name="moon.fill" size={11} tintColor={colors.textSoft} />
                      <Text style={t.caption}>{e.streak_days}</Text>
                    </View>
                  </View>
                  {board === 'improved' ? (
                    <Text style={[styles.score, { color: gain > 0 ? colors.up : gain < 0 ? colors.danger : colors.textSoft }]}>
                      {signed(gain)}
                    </Text>
                  ) : (
                    <Text style={[styles.score, { color: colors[scoreBand(e.score)] }]}>{Math.round(e.score)}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      <FriendSheet
        entry={friend}
        isMe={friend?.user_id === userId}
        onClose={() => setFriend(null)}
        extra={
          friend && board === 'improved'
            ? `${signed(gains[friend.user_id] ?? 0)} points compared with the start of the week.`
            : undefined
        }
      />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  me: { backgroundColor: colors.highlight },
  rank: { width: 22, fontFamily: fontFamily.semibold, fontSize: 16, color: colors.textSoft, textAlign: 'center' },
  who: { flex: 1, gap: 2 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  score: { fontFamily: fontFamily.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
});
