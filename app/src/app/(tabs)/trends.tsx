import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Overview } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { NightBarChart, type ChartBar } from '@/components/NightBarChart';
import { Screen, Section } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { SAMPLE_NIGHTS } from '@/data/sample';
import { useOverview } from '@/hooks/use-overview';
import { usePrefs } from '@/state/prefs';
import { colors, scoreBand, type ScoreBand } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';
import { clockFromMinutes, hm, shortDay, weekday } from '@/utils/format';

type View3 = 'score' | 'bed' | 'bedtime';

const VIEWS: { key: View3; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'bed', label: 'Time in bed' },
  { key: 'bedtime', label: 'Bedtime' },
];

/** The Bedtime axis runs 9 pm (top) to 9 am (bottom): 720 minutes. */
const AXIS_START = 21 * 60;
const AXIS_SPAN = 12 * 60;

type Night = {
  day: string;
  score: number;
  /** Minutes after 9 pm. */
  bed: number;
  asleep: number;
  sample: boolean;
};

const minutesAfter9pm = (iso: string) => {
  const d = new Date(iso);
  return (d.getHours() * 60 + d.getMinutes() - AXIS_START + 1440) % 1440;
};

/** One entry per night in the overview history; nights without real times borrow sample values. */
function buildNights(overview: Overview | null): Night[] {
  const history = (overview?.history ?? []).slice(-7);
  const last = overview?.last_night;
  return history.map((h, i) => {
    if (last && h.day === last.day) {
      return { day: h.day, score: h.score, bed: minutesAfter9pm(last.bedtime), asleep: last.duration_min, sample: false };
    }
    const s = SAMPLE_NIGHTS[SAMPLE_NIGHTS.length - history.length + i] ?? SAMPLE_NIGHTS[0];
    return { day: h.day, score: h.score, bed: s.bedAfter9pm, asleep: s.asleepMin, sample: true };
  });
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** `target` is the target bedtime in minutes after 9 pm. */
function toBar(n: Night, view: View3, target: number): ChartBar {
  const label = weekday(n.day);
  if (view === 'score') return { key: n.day, label, top: 1 - clamp(n.score / 100), bottom: 1, bright: n.score >= 80 };
  if (view === 'bed') {
    const h = n.asleep / 60;
    return { key: n.day, label, top: 1 - clamp(h / 12), bottom: 1, bright: h >= 7 };
  }
  const goodNight = n.asleep >= 7 * 60 && Math.abs(n.bed - target) <= 60;
  return {
    key: n.day,
    label,
    top: clamp(n.bed / AXIS_SPAN),
    bottom: clamp((n.bed + n.asleep) / AXIS_SPAN),
    bright: goodNight,
  };
}

function tooltip(n: Night, view: View3) {
  if (view === 'score') return `${Math.round(n.score)}%`;
  if (view === 'bed') return hm(n.asleep);
  return `${clockFromMinutes(AXIS_START + n.bed)} to ${clockFromMinutes(AXIS_START + n.bed + n.asleep)}`;
}

function statsFor(nights: Night[], view: View3): [{ label: string; value: string; sub?: string }, { label: string; value: string; sub?: string }] {
  if (nights.length === 0) return [{ label: '--', value: '--' }, { label: '--', value: '--' }];
  if (view === 'score') {
    const best = nights.reduce((a, b) => (b.score > a.score ? b : a));
    const weekdays = nights.filter((n) => {
      const d = new Date(`${n.day}T12:00:00`).getDay();
      return d >= 1 && d <= 5;
    });
    return [
      { label: 'Best night', value: `${Math.round(best.score)}%`, sub: shortDay(best.day) },
      { label: 'Weekday avg', value: weekdays.length ? `${Math.round(avg(weekdays.map((n) => n.score)))}%` : '--', sub: 'Mon to Fri' },
    ];
  }
  if (view === 'bed') {
    const longest = nights.reduce((a, b) => (b.asleep > a.asleep ? b : a));
    return [
      { label: 'Longest night', value: hm(longest.asleep), sub: shortDay(longest.day) },
      { label: 'Average', value: hm(Math.round(avg(nights.map((n) => n.asleep)))), sub: 'per night' },
    ];
  }
  const earliest = nights.reduce((a, b) => (b.bed < a.bed ? b : a));
  return [
    { label: 'Earliest bedtime', value: clockFromMinutes(AXIS_START + earliest.bed), sub: shortDay(earliest.day) },
    { label: 'Average bedtime', value: clockFromMinutes(AXIS_START + avg(nights.map((n) => n.bed))), sub: 'this week' },
  ];
}

const VIEW_AXIS: Record<View3, string[]> = {
  score: ['100', '75', '50', '25', '0'],
  bed: ['12h', '9h', '6h', '3h', '0h'],
  bedtime: ['9pm', '12am', '3am', '6am', '9am'],
};

const BANDS: { key: ScoreBand; label: string; range: string }[] = [
  { key: 'excellent', label: 'Excellent', range: '80-100%' },
  { key: 'moderate', label: 'Moderate', range: '50-79%' },
  { key: 'low', label: 'Low', range: '0-49%' },
];

const STAT_HELP: Record<string, string> = {
  'Best night': 'Your highest-scoring night this week.',
  'Weekday avg': 'Your average score on Monday to Friday nights. Weekends often drift later.',
  'Longest night': 'The most time asleep in one night this week. More is not always better: duration scoring tops out at 9 hours.',
  Average: 'Average time asleep per night this week. The healthy range is 7 to 9 hours.',
  'Earliest bedtime': 'The earliest you went to bed this week.',
  'Average bedtime': 'Your typical bedtime this week. Going to bed within 30 minutes of it every night gives full consistency points.',
};

const BAND_HELP: Record<ScoreBand, string> = {
  excellent: 'Great nights: enough sleep, close to your usual bedtime, and restful.',
  moderate: 'Decent nights with room to improve, usually a little short or off your usual bedtime.',
  low: 'Rough nights, often short sleep or a much later bedtime than usual.',
};

export default function TrendsScreen() {
  const { overview, error, refreshing, refresh } = useOverview();
  const [view, setView] = useState<View3>('score');
  const [selected, setSelected] = useState<number | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const { goals } = usePrefs();
  const target = (goals.bedtime - AXIS_START + 1440) % 1440;

  const nights = buildNights(overview);
  const bars = nights.map((n) => toBar(n, view, target));
  const [statA, statB] = statsFor(nights, view);
  const usesSample = view !== 'score' && nights.some((n) => n.sample);
  const picked = selected != null ? nights[selected] : null;

  const subtitle =
    nights.length > 0 ? `Week of ${shortDay(nights[0].day)} - ${shortDay(nights[nights.length - 1].day)}` : 'This week';

  return (
    <Screen
      title="Sleep journey"
      subtitle={subtitle}
      right={<Avatar name={overview?.user.name ?? '?'} />}
      refreshing={refreshing}
      onRefresh={refresh}>
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <Segmented
        options={VIEWS}
        value={view}
        onChange={(v) => {
          setView(v);
          setSelected(null);
        }}
      />

      <Card>
        <View style={styles.chartHeader}>
          <Text style={t.caption}>{picked ? `${weekday(picked.day)}, ${shortDay(picked.day)}` : 'Tap a bar for details'}</Text>
          {picked && <Text style={t.rowTitle}>{tooltip(picked, view)}</Text>}
        </View>
        <NightBarChart
          bars={bars}
          ticks={VIEW_AXIS[view]}
          band={view === 'bed' ? { top: 1 - 9 / 12, bottom: 1 - 7 / 12 } : undefined}
          marker={view === 'bedtime' && target <= AXIS_SPAN ? target / AXIS_SPAN : undefined}
          selected={selected}
          onSelect={(i) => setSelected(i === selected ? null : i)}
        />
        {view === 'bed' && <Text style={[t.caption, styles.legend]}>Shaded strip: healthy 7-9 h</Text>}
        {view === 'bedtime' && (
          <Text style={[t.caption, styles.legend]}>Dashed line: target bedtime {clockFromMinutes(goals.bedtime)}</Text>
        )}
      </Card>

      <Card padding={0}>
        <View style={styles.stats}>
          {[statA, statB].map((s, i) => (
            <Pressable
              key={s.label}
              style={({ pressed }) => [styles.stat, i === 1 && styles.statRight, pressed && styles.pressed]}
              onPress={() =>
                setInfo({
                  title: s.label,
                  subtitle: s.sub ? `${s.value} · ${s.sub}` : s.value,
                  body: [STAT_HELP[s.label] ?? 'Worked out from the nights shown in the chart above.'],
                })
              }>
              <Text style={t.caption}>{s.label}</Text>
              <Text style={t.rowTitle}>{s.value}</Text>
              {s.sub && <Text style={t.caption}>{s.sub}</Text>}
            </Pressable>
          ))}
        </View>
      </Card>

      <Section title="Your sleep distribution">
        <Card padding={0}>
          {BANDS.map((b, i) => {
            const count = nights.filter((n) => scoreBand(n.score) === b.key).length;
            const pct = nights.length ? Math.round((count / nights.length) * 100) : 0;
            const inBand = nights.filter((n) => scoreBand(n.score) === b.key);
            return (
              <View key={b.key}>
                {i > 0 && <Divider />}
                <Pressable
                  style={({ pressed }) => [styles.bandRow, pressed && styles.pressed]}
                  onPress={() =>
                    setInfo({
                      title: `${b.label} nights`,
                      subtitle: `Score ${b.range} · ${count} ${count === 1 ? 'night' : 'nights'} this week`,
                      body: [BAND_HELP[b.key]],
                      extra: (
                        <Card padding={0}>
                          {inBand.length === 0 && <Text style={[t.body, styles.listEmpty]}>None this week.</Text>}
                          {inBand.map((n, j) => (
                            <View key={n.day}>
                              {j > 0 && <Divider />}
                              <View style={styles.listRow}>
                                <Text style={t.body}>
                                  {weekday(n.day)}, {shortDay(n.day)}
                                </Text>
                                <Text style={[t.rowTitle, { color: colors[b.key] }]}>{Math.round(n.score)}%</Text>
                              </View>
                            </View>
                          ))}
                        </Card>
                      ),
                    })
                  }>
                  <View style={[styles.dot, { backgroundColor: colors[b.key] }]} />
                  <View style={styles.bandText}>
                    <Text style={t.rowTitle}>{b.label}</Text>
                    <Text style={t.caption}>{b.range}</Text>
                  </View>
                  <View style={styles.bandRight}>
                    <Text style={t.rowTitle}>{pct}%</Text>
                    <Text style={t.caption}>
                      {count} {count === 1 ? 'night' : 'nights'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </Card>
      </Section>

      {usesSample && (
        <Text style={[t.caption, styles.note]}>Only last night has real times so far. Earlier nights use sample data.</Text>
      )}

      <InfoSheet info={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginBottom: spacing.sm },
  legend: { marginTop: spacing.sm },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, padding: spacing.md, gap: 2 },
  statRight: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  pressed: { opacity: 0.75 },
  listEmpty: { padding: spacing.md },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  bandText: { flex: 1, gap: 2 },
  bandRight: { alignItems: 'flex-end', gap: 2 },
  note: { textAlign: 'center' },
});
