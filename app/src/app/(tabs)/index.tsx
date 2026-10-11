import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionBar } from '@/components/ActionBar';
import { Avatar } from '@/components/Avatar';
import { BriefingCard } from '@/components/BriefingCard';
import { Card, Divider } from '@/components/Card';
import { IconCircle } from '@/components/IconCircle';
import { Screen } from '@/components/Screen';
import { SleepRing } from '@/components/SleepRing';
import { SomniButton } from '@/components/SomniChat';
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
import { type as t } from '@/theme/fonts';
import { clock, hm, longDate, weekday } from '@/utils/format';
import { dayEntries, demoStages, minutesOfDay } from '@/utils/nights';

type SheetKey = 'night' | 'calendar' | 'log' | 'targets' | 'squad';

const RING_MIN = 130;
const RING_MAX = 290;

export default function HomeScreen() {
  const { overview, error, tick, userId } = useOverview();
  const { goals, logs } = usePrefs();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const [ringBox, setRingBox] = useState({ w: 0, h: 0 });

  const night = overview?.last_night;
  const score = overview?.score?.score ?? null;
  const streak = overview?.streak_days ?? 0;
  const entries = dayEntries(overview, logs);
  const stages = night ? demoStages(night.duration_min) : null;
  const ringSize = Math.max(RING_MIN, Math.min(RING_MAX, ringBox.w, ringBox.h));
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
      scroll={false}
      title="Welcome"
      subtitle={error ? "Can't reach the backend" : longDate()}
      right={
        <>
          <Pressable
            hitSlop={8}
            onPress={() => openCalendar(null)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <SymbolView name="calendar" size={20} tintColor={colors.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => router.navigate('/profile')}>
            <Avatar name={overview?.user.name ?? '?'} />
          </Pressable>
        </>
      }>
      <View
        style={styles.ringArea}
        onLayout={(e) => setRingBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {ringBox.h > 0 && (
          <SleepRing
            size={ringSize}
            score={score}
            stages={stages}
            sleep={night ? { bed: minutesOfDay(night.bedtime), wake: minutesOfDay(night.wake_time) } : null}
            target={{ bed: goals.bedtime, wake: goals.wake }}
            onPress={() => setSheet('night')}
          />
        )}
      </View>

      <Card padding={0}>
        <View style={styles.recap}>
          <Pressable style={({ pressed }) => [styles.recapCell, pressed && styles.pressed]} onPress={() => setInfo(timeInfo())}>
            <IconCircle name="moon.fill" size={40} />
            <View>
              <Text style={t.caption}>Time slept</Text>
              <Text style={t.rowTitle}>{night ? hm(night.duration_min) : '--'}</Text>
            </View>
          </Pressable>
          <View style={styles.vline} />
          <Pressable style={({ pressed }) => [styles.recapCell, pressed && styles.pressed]} onPress={() => setInfo(streakInfo())}>
            <IconCircle name="flame.fill" size={40} />
            <View>
              <Text style={t.caption}>Streak</Text>
              <Text style={t.rowTitle}>{overview ? `${streak} nights` : '--'}</Text>
            </View>
          </Pressable>
        </View>
      </Card>

      <BriefingCard userId={userId} refreshKey={tick} />

      <ActionBar
        actions={[
          { key: 'log', label: 'Log sleep', icon: 'plus', onPress: () => setSheet('log') },
          { key: 'targets', label: 'Targets', icon: 'target', onPress: () => setSheet('targets') },
          { key: 'squad', label: 'Squads', icon: 'person.3.fill', onPress: () => setSheet('squad') },
        ]}
      />

      <Card padding={0}>
        <Pressable style={styles.logHead} onPress={() => openCalendar(null)}>
          <Text style={t.rowTitle}>Sleep log</Text>
          <Text style={styles.link}>See calendar</Text>
        </Pressable>
        {entries.length === 0 && <Text style={[t.body, styles.empty]}>Nothing logged yet.</Text>}
        {entries.slice(0, 2).map((e, i) => (
          <View key={e.day}>
            <Divider />
            <Pressable style={({ pressed }) => [styles.logRow, pressed && styles.pressed]} onPress={() => openCalendar(e.day)}>
              <View style={styles.logText}>
                <Text style={styles.logTitle}>
                  {i === 0 ? 'Last sleep' : 'Sleep'} ({weekday(e.day)})
                </Text>
                <Text style={t.caption}>{e.bed && e.wake ? `${clock(e.bed)} - ${clock(e.wake)}` : 'Synced night'}</Text>
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

      <NightSheet visible={sheet === 'night'} onClose={close} overview={overview} stages={stages} goals={goals} />
      <CalendarSheet visible={sheet === 'calendar'} onClose={close} entries={entries} initialDay={calendarDay} />
      <LogSleepSheet visible={sheet === 'log'} onClose={close} />
      <TargetsSheet visible={sheet === 'targets'} onClose={close} />
      <SquadSheet visible={sheet === 'squad'} onClose={close} backendSquad={overview?.user.squad} />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
      <SomniButton userId={userId} name={overview?.user.name} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
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
  ringArea: { flex: 1, minHeight: RING_MIN, alignItems: 'center', justifyContent: 'center' },
  recap: { flexDirection: 'row', alignItems: 'center' },
  recapCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  vline: { width: 1, alignSelf: 'stretch', backgroundColor: colors.divider },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  link: { color: colors.tabActive, fontSize: 14 },
  empty: { padding: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9 },
  logText: { flex: 1, gap: 1 },
  logTitle: { ...t.rowTitle, fontSize: 16 },
  logRight: { alignItems: 'flex-end', gap: 1 },
});
