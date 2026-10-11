import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry, Overview } from '@/api/types';
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

type SquadRow = { rank: number; name: string; avg: number; members: LeaderboardEntry[]; mine: boolean };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Score change across the week: average of the last 3 nights minus the earlier ones. */
function improvement(scores: number[]) {
  if (scores.length < 4) return 0;
  return Math.round(avg(scores.slice(-3)) - avg(scores.slice(0, scores.length - 3)));
}

/**
 * Places moved since yesterday: compares today's rank with a ranking on each person's previous night.
 * TODO(P1): replace with a real previous-rank field from the leaderboard endpoint.
 */
function rankDeltas(entries: LeaderboardEntry[], overviews: Overview[]) {
  const prevScore = new Map(
    overviews.map((o) => {
      const h = o.history;
      return [o.user.id, h.length >= 2 ? h[h.length - 2].score : (h[0]?.score ?? 0)];
    }),
  );
  const prevOrder = [...entries].sort((a, b) => (prevScore.get(b.user_id) ?? 0) - (prevScore.get(a.user_id) ?? 0));
  const deltas: Record<number, number> = {};
  entries.forEach((e) => (deltas[e.user_id] = prevOrder.findIndex((p) => p.user_id === e.user_id) + 1 - e.rank));
  return deltas;
}

/** Groups people by squad and ranks squads by average member score (so big squads don't win by size). */
function squadRows(entries: LeaderboardEntry[], meId: number, mySquad: string | null): SquadRow[] {
  const groups = new Map<string, LeaderboardEntry[]>();
  for (const e of entries) {
    // A squad created or joined in the app moves you out of your backend squad.
    const name = e.user_id === meId && mySquad ? mySquad : e.squad;
    if (!name) continue;
    groups.set(name, [...(groups.get(name) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([name, members]) => ({ name, members, avg: avg(members.map((m) => m.score)), mine: name === mySquad }))
    .sort((a, b) => b.avg - a.avg)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function LeaderboardScreen() {
  const { userId } = useUser();
  const { squad } = usePrefs();
  const [board, setBoard] = useState<Board>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [gains, setGains] = useState<Record<number, number>>({});
  const [deltas, setDeltas] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [friend, setFriend] = useState<LeaderboardEntry | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [squadSheet, setSquadSheet] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const list = await api.leaderboard(board === 'all' ? 'all' : 'week');
      const overviews = await Promise.all(list.entries.map((e) => api.overview(e.user_id)));
      const g: Record<number, number> = {};
      overviews.forEach((o) => (g[o.user.id] = improvement(o.history.map((h) => h.score))));
      // TODO(P1): a real "most improved" board needs last week's scores; this compares early vs late this week.
      const ranked =
        board === 'improved'
          ? [...list.entries].sort((a, b) => g[b.user_id] - g[a.user_id]).map((e, i) => ({ ...e, rank: i + 1 }))
          : list.entries;
      return { entries: ranked, gains: g, deltas: rankDeltas(list.entries, overviews) };
    };
    load()
      .then((r) => {
        if (live) {
          setEntries(r.entries);
          setGains(r.gains);
          setDeltas(r.deltas);
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

  const me = entries.find((e) => e.user_id === userId);
  const mySquad = squad?.name ?? me?.squad ?? null;
  const squads = board === 'squads' ? squadRows(entries, userId, mySquad) : [];
  const showDelta = board === 'week' || board === 'all';

  const valueOf = (e: LeaderboardEntry) =>
    board === 'improved' ? signed(gains[e.user_id] ?? 0) : `${Math.round(e.score)}`;
  const top = board === 'squads' ? [] : entries.slice(0, 3);
  const rest = board === 'squads' ? [] : entries.slice(3);

  const boardInfo = (): Info => ({
    title: BOARDS.find((b) => b.key === board)!.label,
    body:
      board === 'improved'
        ? [
            'Most improved ranks people by how much their score went up, compared only to their own earlier nights. It replaces any "worst sleeper" list.',
            'For now it compares the last 3 nights with the start of this week.',
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

  const squadInfo = (s: SquadRow): Info => ({
    title: s.name,
    subtitle: `#${s.rank} · average ${Math.round(s.avg)} · ${s.members.length} ${s.members.length === 1 ? 'member' : 'members'}`,
    body: ['Members show score and streak only.'],
    extra: (
      <Card padding={0}>
        {[...s.members]
          .sort((a, b) => b.score - a.score)
          .map((m, i) => (
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
  });

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
          delta={showDelta ? (e) => deltas[e.user_id] ?? 0 : undefined}
          onPress={setFriend}
        />
      )}

      {rest.length > 0 && (
        <Card padding={0}>
          {rest.map((e, i) => {
            const isMe = e.user_id === userId;
            const gain = gains[e.user_id] ?? 0;
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
                      <RankChange delta={deltas[e.user_id] ?? 0} />
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
              <View key={s.name}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => [styles.row, s.mine && styles.me, pressed && styles.pressed]}
                  onPress={() => setInfo(squadInfo(s))}>
                  <Text style={styles.rank}>{s.rank}</Text>
                  <IconCircle name="person.3.fill" size={40} />
                  <View style={styles.who}>
                    <Text style={t.rowTitle}>{s.name}</Text>
                    <Text style={t.caption}>
                      {s.members.length} {s.members.length === 1 ? 'member' : 'members'}
                      {s.mine ? ' · your squad' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.score, { color: colors[scoreBand(s.avg)] }]}>{Math.round(s.avg)}</Text>
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
            ? `${signed(gains[friend.user_id] ?? 0)} points compared with the start of the week.`
            : undefined
        }
      />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
      <SquadSheet visible={squadSheet} onClose={() => setSquadSheet(false)} backendSquad={me?.squad} />
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
