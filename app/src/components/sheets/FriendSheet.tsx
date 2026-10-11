import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { FriendCard, LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { BadgeHex } from '@/components/BadgeHex';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { BADGES, type BadgeKey } from '@/theme/badges';
import { colors, scoreBand } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { clockFromMinutes } from '@/utils/format';

type Props = { entry: LeaderboardEntry | null; isMe: boolean; onClose: () => void; extra?: string };

/** Friend card: score and streak only. Sleep details stay private unless the friend shares them. */
export function FriendSheet({ entry, isMe, onClose, extra }: Props) {
  const badge = BADGES.find((b) => b.key === entry?.badge)?.key as BadgeKey | undefined;
  const [loaded, setCard] = useState<FriendCard | null>(null);
  const id = entry?.user_id;
  const card = loaded?.user_id === id ? loaded : null;

  useEffect(() => {
    if (id == null) return;
    let live = true;
    api
      .friendCard(id)
      .then((c) => live && setCard(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);

  const details = card?.details;
  return (
    <Sheet visible={!!entry} onClose={onClose}>
      {entry && (
        <View style={styles.body}>
          <Avatar name={entry.name} size={96} />
          <View style={styles.names}>
            <Text style={t.title}>{isMe ? `${entry.name} (you)` : entry.name}</Text>
            <Text style={t.body}>
              Rank #{entry.rank}
              {entry.squad ? ` · ${entry.squad}` : ''}
            </Text>
          </View>

          <Card padding={0} style={styles.statsCard}>
            <View style={styles.stats}>
              <Stat label="Score" value={`${Math.round(entry.score)}`} color={colors[scoreBand(entry.score)]} />
              <View style={styles.vline} />
              <Stat label="Streak" value={`${entry.streak_days} nights`} />
              <View style={styles.vline} />
              <View style={styles.stat}>
                {badge ? <BadgeHex badge={badge} unlocked size={34} /> : <Text style={t.rowTitle}>--</Text>}
                <Text style={t.caption}>Top badge</Text>
              </View>
            </View>
          </Card>

          {details && (
            <Card padding={0} style={styles.statsCard}>
              <View style={styles.stats}>
                <Stat label="Usual bedtime" value={clockFromMinutes(details.avg_bedtime)} />
                <View style={styles.vline} />
                <Stat label="Avg sleep" value={`${details.avg_hours} h`} />
                <View style={styles.vline} />
                <Stat label="Best streak" value={`${card?.best_streak ?? 0}`} />
              </View>
            </Card>
          )}

          {card?.bio ? <Text style={[t.body, styles.center]}>{card.bio}</Text> : null}
          {extra && <Text style={[t.body, styles.center]}>{extra}</Text>}
          <Text style={[t.caption, styles.center]}>
            {isMe
              ? details
                ? 'You share your bedtime and hours with friends. Turn it off in Profile under Privacy.'
                : 'Friends see your score and streak. Turn on "Share details with friends" in Profile to show more.'
              : details
                ? `${entry.name} shares their last 7 nights. Not medical advice.`
                : `Sleep details are private unless ${entry.name} shares them.`}
          </Text>
        </View>
      )}
    </Sheet>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[t.rowTitle, color ? { color } : null]}>{value}</Text>
      <Text style={t.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 14, paddingTop: 4 },
  names: { alignItems: 'center', gap: 2 },
  statsCard: { alignSelf: 'stretch' },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 50 },
  vline: { width: 1, backgroundColor: colors.divider },
  center: { textAlign: 'center' },
});
