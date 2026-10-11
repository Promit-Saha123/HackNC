import { StyleSheet, Text, View } from 'react-native';

import type { LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { BadgeHex } from '@/components/BadgeHex';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { BADGES, type BadgeKey } from '@/theme/badges';
import { colors, scoreBand } from '@/theme/colors';
import { type as t } from '@/theme/fonts';

type Props = { entry: LeaderboardEntry | null; isMe: boolean; onClose: () => void; extra?: string };

/** Friend card: score and streak only. Sleep details stay private unless the friend shares them. */
export function FriendSheet({ entry, isMe, onClose, extra }: Props) {
  const badge = BADGES.find((b) => b.key === entry?.badge)?.key as BadgeKey | undefined;
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

          {extra && <Text style={[t.body, styles.center]}>{extra}</Text>}
          <Text style={[t.caption, styles.center]}>
            {isMe
              ? 'Friends see your score and streak. Turn on "Share details with friends" in Profile to show more.'
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
