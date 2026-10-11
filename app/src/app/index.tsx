import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { USE_MOCKS, api } from '@/api/client';
import type { Overview } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { GradientButton } from '@/components/GradientButton';
import { IconCircle } from '@/components/IconCircle';
import { Screen, Section } from '@/components/Screen';
import { ScoreRing } from '@/components/ScoreRing';
import { useUser } from '@/state/user';
import { colors, scoreBand } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { clock, hm, longDate, weekday } from '@/utils/format';

const SHORTCUT_URL = 'shortcuts://run-shortcut?name=SleepSquad%20Sync';

export default function HomeScreen() {
  const { userId } = useUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .overview(userId)
      .then((o) => {
        if (live) {
          setOverview(o);
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
  }, [userId, tick]);

  // Coming back from the Shortcut (or any backgrounding) refetches.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const night = overview?.last_night;
  const score = overview?.score?.score ?? null;
  // Newest first, skipping nothing: the first row is last night.
  const log = [...(overview?.history ?? [])].reverse().slice(0, 3);

  return (
    <Screen
      title="Welcome"
      subtitle={longDate()}
      right={<Avatar name={overview?.user.name ?? '?'} />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTick((n) => n + 1);
      }}>
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <ScoreRing score={score} inner={night?.efficiency} />
      {score == null && !error && overview && <Text style={[t.body, styles.center]}>No sleep synced yet.</Text>}

      <Section title="Quick recap">
        <Card padding={0}>
          <View style={styles.recap}>
            <View style={styles.recapCell}>
              <IconCircle name="moon.fill" />
              <View>
                <Text style={t.caption}>Time sleep</Text>
                <Text style={t.rowTitle}>{night ? hm(night.duration_min) : '--'}</Text>
              </View>
            </View>
            <View style={styles.vline} />
            <View style={styles.recapCell}>
              <IconCircle name="chart.pie.fill" />
              <View>
                <Text style={t.caption}>Streak</Text>
                <Text style={t.rowTitle}>{overview ? `${overview.streak_days} nights` : '--'}</Text>
              </View>
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Sleep log">
        <Card padding={0}>
          {log.length === 0 && <Text style={[t.body, styles.empty]}>Nothing logged yet.</Text>}
          {log.map((h, i) => {
            const isLast = night && h.day === night.day;
            return (
              <View key={h.day}>
                {i > 0 && <Divider />}
                <View style={styles.logRow}>
                  <View style={styles.logText}>
                    <Text style={t.rowTitle}>
                      {i === 0 ? 'Last sleep' : 'Sleep'} ({weekday(h.day)})
                    </Text>
                    {isLast && night && (
                      <Text style={t.body}>
                        {clock(night.bedtime)} - {clock(night.wake_time)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.logRight}>
                    {isLast && night && <Text style={t.rowTitle}>{hm(night.duration_min)}</Text>}
                    <Text style={[t.body, { color: colors[scoreBand(h.score)] }]}>{Math.round(h.score)}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <GradientButton
        label="Sync from Apple Watch"
        onPress={() => Linking.openURL(SHORTCUT_URL).catch(() => setError('Could not open Shortcuts'))}
      />
      {USE_MOCKS && <Text style={[t.caption, styles.center]}>Showing mock data</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14 },
  recap: { flexDirection: 'row', alignItems: 'center' },
  recapCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  vline: { width: 1, alignSelf: 'stretch', backgroundColor: colors.divider },
  empty: { padding: 16 },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  logText: { flex: 1, gap: 2 },
  logRight: { alignItems: 'flex-end', gap: 2 },
});
