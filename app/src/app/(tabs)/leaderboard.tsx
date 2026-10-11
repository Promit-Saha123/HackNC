import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry, SquadEntry } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { GlassIconButton } from '@/components/Glass';
import { IconCircle } from '@/components/IconCircle';
import { Podium } from '@/components/Podium';
import { RankChange } from '@/components/RankChange';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { FriendSheet } from '@/components/sheets/FriendSheet';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { SquadSheet } from '@/components/sheets/SquadSheet';
import { usePrefs } from '@/state/prefs';
import { useUser } from '@/state/user';
import { colors, scoreBand } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Board = 'week' | 'all' | 'improved' | 'squads';

const BOARDS: { key: Board; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'all', label: 'All-time' },
  { key: 'improved', label: 'Improved' },
  { key: 'squads', label: 'Squads' },
];

const SUBTITLE: Record<Board, string> = {
  week: 'This week · resets Monday',
  all: 'All time',
  improved: 'Biggest gains this week',
  squads: 'Average score per squad',
};

/** Places moved since last night: positive = moved up. New entries (no previous rank) show no arrow. */
const rankDelta = (e: LeaderboardEntry) => (e.prev_rank == null ? 0 : e.prev_rank - e.rank);

/** Score change for the Improved board: this week's average minus last week's. */
const gainOf = (e: LeaderboardEntry) => Math.round(e.delta ?? 0);

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function LeaderboardScreen() {
  const { userId, version } = useUser();
  const { squad } = usePrefs();
  const [board, setBoard] = useState<Board>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [squads, setSquads] = useState<SquadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [friend, setFriend] = useState<LeaderboardEntry | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [squadSheet, setSquadSheet] = useState(false);

  useEffect(() => {
    let live = true;
    const load =
      board === 'squads'
        ? api.squadLeaderboard('week').then((r) => ({ entries: [] as LeaderboardEntry[], squads: r.entries }))
        : api.leaderboard(board).then((r) => ({ entries: r.entries, squads: [] as SquadEntry[] }));
    load
      .then((r) => {
        if (live) {
          setEntries(r.entries);
          setSquads(r.squads);
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
  }, [board, tick, version]);

  const mySquad = squad?.name ?? null;
  const showDelta = board === 'week' || board === 'all';

  const valueOf = (e: LeaderboardEntry) =>
    board === 'improved' ? signed(gainOf(e)) : `${Math.round(e.score)}`;
  const top = board === 'squads' ? [] : entries.slice(0, 3);
  const rest = board === 'squads' ? [] : entries.slice(3);

  const boardInfo = (): Info => ({
    title: BOARDS.find((b) => b.key === board)!.label,
    body:
      board === 'improved'
        ? [
            'Most improved ranks people by how much their score went up, compared only to their own earlier nights. It replaces any "worst sleeper" list.',
            "It compares this week's average with last week's, and only shows people who improved.",
          ]
        : board === 'squads'
          ? [
              'Squads are ranked by the average score of their members, so a big squad cannot win just by being big.',
              'Tap a squad to see its members, or join and create squads from the button below.',
            ]
          : [
              board === 'week'
                ? 'Ranks everyone by their average nightly score this week. It resets every Monday so newcomers get a shot.'
                : 'Ranks everyone by their average nightly score since they joined.',
              'The arrows show how many places someone moved since yesterday.',
            ],
  });

  const openSquad = async (sq: SquadEntry) => {
    const base = {
      title: sq.squad,
      subtitle: `#${sq.rank} · average ${Math.round(sq.score)} · ${sq.members} ${sq.members === 1 ? 'member' : 'members'}`,
      body: ['Members show score and streak only.'],
    };
    setInfo(base);
    const members = await api.leaderboard('week', sq.squad).then((r) => r.entries).catch(() => []);
    setInfo((cur) =>
      cur?.title !== sq.squad
        ? cur
        : {
            ...base,
            extra: (
              <Card padding={0}>
                {members.map((m, i) => (
                  <View key={m.user_id}>
                    {i > 0 && <Divider />}
                    <View style={styles.memberRow}>
                      <Avatar name={m.name} size={32} glow={false} />
                      <Text style={[t.rowTitle, styles.flex]}>{m.user_id === userId ? 'You' : m.name}</Text>
                      <View style={styles.streak}>
                        <SymbolView name="moon.fill" size={11} tintColor={colors.textSoft} />
                        <Text style={t.caption}>{m.streak_days}</Text>
                      </View>
                      <Text style={[styles.score, styles.memberScore]}>{Math.round(m.score)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            ),
          },
    );
  };

  return (
    <Screen
      title="Leaderboard"
      subtitle={SUBTITLE[board]}
      right={
        <GlassIconButton onPress={() => setInfo(boardInfo())}>
          <SymbolView name="info.circle" size={20} tintColor={colors.text} />
        </GlassIconButton>
      }
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTick((n) => n + 1);
      }}>
      <Segmented options={BOARDS} value={board} onChange={setBoard} />
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      {top.length > 0 && (
        <Podium
          top={top}
          meId={userId}
          valueOf={valueOf}
          delta={showDelta ? rankDelta : undefined}
          onPress={setFriend}
        />
      )}

      {rest.length > 0 && (
        <Card padding={0}>
          {rest.map((e, i) => {
            const isMe = e.user_id === userId;
            const gain = gainOf(e);
            return (
              <View key={e.user_id}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => [styles.row, isMe && styles.me, pressed && styles.pressed]}
                  onPress={() => setFriend(e)}>
                  <Text style={styles.rank}>{e.rank}</Text>
                  <Avatar name={e.name} size={40} glow={false} />
                  <View style={styles.who}>
                    <Text style={t.rowTitle}>{isMe ? 'You' : e.name}</Text>
                    <View style={styles.streak}>
                      <SymbolView name="moon.fill" size={11} tintColor={colors.textSoft} />
                      <Text style={t.caption}>{e.streak_days}</Text>
                    </View>
                  </View>
                  {board === 'improved' ? (
                    <Text style={[styles.score, { color: gain > 0 ? colors.up : gain < 0 ? colors.down : colors.textSoft }]}>
                      {signed(gain)}
                    </Text>
                  ) : (
                    <View style={styles.right}>
                      <Text style={[styles.score, { color: colors[scoreBand(e.score)] }]}>{Math.round(e.score)}</Text>
                      <RankChange delta={rankDelta(e)} />
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      {board === 'squads' && (
        <>
          <Card padding={0}>
            {squads.length === 0 && <Text style={[t.body, styles.empty]}>No squads yet.</Text>}
            {squads.map((s, i) => (
              <View key={s.squad}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => [styles.row, s.squad === mySquad && styles.me, pressed && styles.pressed]}
                  onPress={() => openSquad(s)}>
                  <Text style={styles.rank}>{s.rank}</Text>
                  <IconCircle name="person.3.fill" size={40} />
                  <View style={styles.who}>
                    <Text style={t.rowTitle}>{s.squad}</Text>
                    <Text style={t.caption}>
                      {s.members} {s.members === 1 ? 'member' : 'members'}
                      {s.squad === mySquad ? ' · your squad' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.score, { color: colors[scoreBand(s.score)] }]}>{Math.round(s.score)}</Text>
                </Pressable>
              </View>
            ))}
          </Card>
          <Pressable style={({ pressed }) => [styles.squadLink, pressed && styles.pressed]} onPress={() => setSquadSheet(true)}>
            <SymbolView name="plus.circle.fill" size={18} tintColor={colors.text} />
            <Text style={styles.squadLinkText}>{mySquad ? 'Switch or create a squad' : 'Join or create a squad'}</Text>
          </Pressable>
        </>
      )}

      <FriendSheet
        entry={friend}
        isMe={friend?.user_id === userId}
        onClose={() => setFriend(null)}
        extra={
          friend && board === 'improved'
            ? `${signed(gainOf(friend))} points compared with last week.`
            : undefined
        }
      />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
      <SquadSheet visible={squadSheet} onClose={() => setSquadSheet(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  pressed: { opacity: 0.75 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  me: { backgroundColor: colors.highlight },
  rank: { width: 22, fontFamily: fontFamily.semibold, fontSize: 16, color: colors.textSoft, textAlign: 'center' },
  who: { flex: 1, gap: 2 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { alignItems: 'flex-end', gap: 2 },
  score: { fontFamily: fontFamily.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
  empty: { padding: 14 },
  flex: { flex: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  memberScore: { fontSize: 17, color: colors.text },
  squadLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  squadLinkText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text },
});
