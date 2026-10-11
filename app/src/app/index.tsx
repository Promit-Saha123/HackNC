import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AppState, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USE_MOCKS, api } from '@/api/client';
import type { Overview } from '@/api/types';
import { BriefingCard } from '@/components/BriefingCard';
import { GlassCard } from '@/components/GlassCard';
import { SkyBackground } from '@/components/SkyBackground';
import { UserPicker } from '@/components/UserPicker';
import { BottomTabInset } from '@/constants/theme';
import { useUser } from '@/state/user';
import { BADGE_EMOJI } from '@/theme/badges';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

const SHORTCUT_URL = 'shortcuts://run-shortcut?name=SleepSquad%20Sync';
const CHART_WIDTH = Dimensions.get('window').width - spacing.md * 4 - 40;

const hm = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

export default function HomeScreen() {
  const { userId } = useUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

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
      });
    return () => {
      live = false;
    };
  }, [userId, refreshTick]);

  // Coming back from the Shortcut (or any backgrounding) refetches.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setRefreshTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  const night = overview?.last_night;
  const score = overview?.score;

  return (
    <SkyBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <UserPicker />
          <Text style={styles.title}>
            {overview ? `Good morning, ${overview.user.name}` : 'Sleep Squad'}
          </Text>
          {USE_MOCKS && <Text style={styles.hint}>Showing mock data</Text>}
          {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

          <GlassCard style={styles.card}>
            <Text style={styles.label}>Last night</Text>
            {score && night ? (
              <>
                <Text style={styles.score}>
                  {Math.round(score.score)}
                  <Text style={styles.outOf}> / 100</Text>
                </Text>
                <View style={styles.stats}>
                  <Text style={styles.stat}>🛏 {hm(night.duration_min)}</Text>
                  <Text style={styles.stat}>⚡ {Math.round(night.efficiency * 100)}%</Text>
                  <Text style={styles.stat}>
                    {overview?.badge ? BADGE_EMOJI[overview.badge] : '🔥'} {overview?.streak_days ?? 0} night streak
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.stat}>No sleep synced yet.</Text>
            )}
          </GlassCard>

          <BriefingCard userId={userId} refreshKey={refreshTick} />

          <GlassCard style={styles.card}>
            <Text style={styles.label}>Last 7 nights</Text>
            <BarChart
              data={(overview?.history ?? []).map((h) => ({
                value: h.score,
                label: weekday(h.day),
                frontColor: colors.green,
              }))}
              width={CHART_WIDTH}
              height={140}
              maxValue={100}
              noOfSections={4}
              barWidth={22}
              spacing={14}
              initialSpacing={8}
              barBorderRadius={8}
              hideRules
              yAxisThickness={0}
              xAxisThickness={0}
              yAxisTextStyle={styles.axis}
              xAxisLabelTextStyle={styles.axis}
              isAnimated
            />
          </GlassCard>

          <Pressable
            style={styles.sync}
            onPress={() => Linking.openURL(SHORTCUT_URL).catch(() => setError('Could not open Shortcuts'))}>
            <Text style={styles.syncText}>Sync from Apple Watch</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: BottomTabInset + spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  hint: { color: colors.textSoft },
  error: { color: '#B3261E' },
  card: { gap: spacing.sm },
  label: { color: colors.textSoft, fontWeight: '600', textTransform: 'uppercase', fontSize: 12 },
  score: { fontSize: 72, fontWeight: '800', color: colors.text },
  outOf: { fontSize: 22, fontWeight: '500', color: colors.textSoft },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { color: colors.text, fontSize: 16 },
  axis: { color: colors.textSoft, fontSize: 11 },
  sync: {
    backgroundColor: colors.green,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  syncText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});