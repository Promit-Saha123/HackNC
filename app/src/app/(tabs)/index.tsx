import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ActionBar } from '@/components/ActionBar';
import { Avatar } from '@/components/Avatar';
import { BriefingCard } from '@/components/BriefingCard';
import { Card, Divider } from '@/components/Card';
import { GlassIconButton } from '@/components/Glass';
import { GlassBubble } from '@/components/GlassBubble';
import { IconCircle } from '@/components/IconCircle';
import { InsightCard } from '@/components/InsightCard';
import { Screen, Section } from '@/components/Screen';
import { SleepRing } from '@/components/SleepRing';
import { CalendarSheet } from '@/components/sheets/CalendarSheet';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { LogSleepSheet } from '@/components/sheets/LogSleepSheet';
import { NightSheet } from '@/components/sheets/NightSheet';
import { SquadSheet } from '@/components/sheets/SquadSheet';
import { TargetsSheet } from '@/components/sheets/TargetsSheet';
import { useOverview } from '@/hooks/use-overview';
import { usePrefs } from '@/state/prefs';
import { BADGES } from '@/theme/badges';
import { colors, scoreBand } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { SCREEN_PADDING } from '@/theme/spacing';
import { clock, hm, longDate, weekday } from '@/utils/format';
import { dayEntries, minutesOfDay, nightStages } from '@/utils/nights';

type SheetKey = 'night' | 'calendar' | 'log' | 'targets' | 'squad';

const RING_MAX = 320;

export default function HomeScreen() {
  const { overview, history, error, tick, userId, refreshing, refresh } = useOverview();
  const { goals } = usePrefs();
  const { width } = useWindowDimensions();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [calendarDay, setCalendarDay] = useState<string | null>(null);

  const night = overview?.last_night;
  const score = overview?.score?.score ?? null;
  const streak = overview?.streak_days ?? 0;
  const entries = dayEntries(history);
  const stages = night ? nightStages(night) : null;
  const ringSize = Math.min(RING_MAX, width - 2 * SCREEN_PADDING - 20);
  const close = () => setSheet(null);

  const openCalendar = (day: string | null) => {
    setCalendarDay(day);
    setSheet('calendar');
  };

  const timeInfo = (): Info => ({
    title: 'Time asleep',
    subtitle: night ? hm(night.duration_min) : 'No night synced yet',
    body: night
      ? [
          `You were in bed from ${clock(night.bedtime)} to ${clock(night.wake_time)} and asleep for ${Math.round(night.efficiency * 100)}% of it.`,
          `Your target is ${goals.hours} hours. Duration is 40% of your score: full marks between 7 and 9 hours, falling to zero at 5 hours.`,
        ]
      : ['Log a night or sync from Apple Health to see it here.'],
    action: { label: 'Change targets', onPress: () => { setInfo(null); setTimeout(() => setSheet('targets'), 450); } },
  });

  const streakInfo = (): Info => {
    const next = BADGES.find((b) => b.nights > streak);
    return {
      title: `${streak}-night streak`,
      subtitle: next ? `${next.nights - streak} more to unlock ${next.label}` : 'Every badge unlocked',
      body: [
        'A night counts toward your streak if you sleep 7 hours or more and go to bed within 1 hour of your usual bedtime.',
        'Streaks unlock badges at 3, 7, 14 and 30 nights, and add up to 10 points to your nightly score.',
      ],
      action: { label: 'See badges', onPress: () => { setInfo(null); router.navigate('/achievements'); } },
    };
  };

  return (
    <Screen
      title="Welcome"
      subtitle={error ? "Can't reach the backend" : longDate()}
      refreshing={refreshing}
      onRefresh={refresh}
      right={
        <>
          <GlassIconButton onPress={() => openCalendar(null)}>
            <SymbolView name="calendar" size={20} tintColor={colors.text} />
          </GlassIconButton>
          <Pressable hitSlop={8} onPress={() => router.navigate('/profile')}>
            <Avatar name={overview?.user.name ?? '?'} />
          </Pressable>
        </>
      }>
      <View style={styles.ringArea}>
        <GlassBubble size={ringSize * 1.02} style={styles.disc} />
        <SleepRing
          size={ringSize}
          score={score}
          stages={stages}
          sleep={night ? { bed: minutesOfDay(night.bedtime), wake: minutesOfDay(night.wake_time) } : null}
          target={{ bed: goals.bedtime, wake: goals.wake }}
          onPress={() => setSheet('night')}
        />
      </View>

      <BriefingCard userId={userId} refreshKey={tick} />
      <InsightCard userId={userId} refreshKey={tick} />

      <Section title="Quick recap">
      <View style={styles.recap}>
        <Card padding={0} style={styles.recapTile} onPress={() => setInfo(timeInfo())}>
          <View style={styles.recapCell}>
            <IconCircle name="moon.fill" size={40} />
            <View>
              <Text style={t.caption}>Time slept</Text>
              <Text style={t.rowTitle}>{night ? hm(night.duration_min) : '--'}</Text>
            </View>
          </View>
        </Card>
        <Card padding={0} style={styles.recapTile} onPress={() => setInfo(streakInfo())}>
          <View style={styles.recapCell}>
            <IconCircle name="flame.fill" size={40} />
            <View>
              <Text style={t.caption}>Streak</Text>
              <Text style={t.rowTitle}>{overview ? `${streak} nights` : '--'}</Text>
            </View>
          </View>
        </Card>
      </View>
      </Section>

      <ActionBar
        actions={[
          { key: 'log', label: 'Log sleep', icon: 'plus', onPress: () => setSheet('log') },
          { key: 'targets', label: 'Targets', icon: 'target', onPress: () => setSheet('targets') },
          { key: 'squad', label: 'Squads', icon: 'person.3.fill', onPress: () => setSheet('squad') },
        ]}
      />

      <View style={styles.logSection}>
      <Pressable style={styles.logHead} onPress={() => openCalendar(null)}>
        <Text style={t.section}>Sleep log</Text>
        <Text style={styles.link}>See calendar</Text>
      </Pressable>
      <Card padding={0}>
        {entries.length === 0 && <Text style={[t.body, styles.empty]}>Nothing logged yet.</Text>}
        {entries.slice(0, 5).map((e, i) => (
          <View key={e.day}>
            {i > 0 && <Divider />}
            <Pressable style={({ pressed }) => [styles.logRow, pressed && styles.pressed]} onPress={() => openCalendar(e.day)}>
              <View style={styles.logText}>
                <Text style={styles.logTitle}>
                  {i === 0 ? 'Last sleep' : 'Sleep'} ({weekday(e.day)})
                </Text>
                <Text style={t.caption}>{e.bed && e.wake ? `${clock(e.bed)} - ${clock(e.wake)}` : 'Synced night'}
                  {e.source === 'logged' ? ' · logged' : ''}</Text>
              </View>
              <View style={styles.logRight}>
                {e.minutes != null && <Text style={styles.logTitle}>{hm(e.minutes)}</Text>}
                {e.score != null && (
                  <Text style={[t.caption, { color: colors[scoreBand(e.score)] }]}>{Math.round(e.score)}%</Text>
                )}
              </View>
            </Pressable>
          </View>
        ))}
      </Card>
      </View>

      <NightSheet visible={sheet === 'night'} onClose={close} overview={overview} stages={stages} goals={goals} />
      <CalendarSheet visible={sheet === 'calendar'} onClose={close} entries={entries} initialDay={calendarDay} />
      <LogSleepSheet visible={sheet === 'log'} onClose={close} />
      <TargetsSheet visible={sheet === 'targets'} onClose={close} />
      <SquadSheet visible={sheet === 'squad'} onClose={close} />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  ringArea: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  disc: { position: 'absolute' },
  recap: { flexDirection: 'row', gap: 12 },
  recapTile: { flex: 1 },
  recapCell: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  logSection: { gap: 12 },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.textSoft, fontSize: 14, fontFamily: fontFamily.medium },
  empty: { padding: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  logText: { flex: 1, gap: 1 },
  logTitle: { ...t.rowTitle, fontSize: 16 },
  logRight: { alignItems: 'flex-end', gap: 1 },
});
