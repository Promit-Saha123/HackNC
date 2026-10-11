import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { colors, gradient, scoreBand } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { clock, hm } from '@/utils/format';
import { isoDay, type DayEntry } from '@/utils/nights';

type Props = { visible: boolean; onClose: () => void; entries: DayEntry[]; initialDay?: string | null };

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid of past nights. Dots are colored by score band; tap a day to see that night. */
export function CalendarSheet({ visible, onClose, entries, initialDay }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Sleep calendar" subtitle="Tap a day to see that night.">
      {visible && <CalendarBody entries={entries} initialDay={initialDay ?? null} />}
    </Sheet>
  );
}

function CalendarBody({ entries, initialDay }: { entries: DayEntry[]; initialDay: string | null }) {
  const today = new Date();
  const todayKey = isoDay(today);
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const start = initialDay ?? entries[0]?.day ?? todayKey;
  const [month, setMonth] = useState(() => {
    const d = new Date(`${start}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(start);

  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const lead = new Date(year, m, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && m === today.getMonth();
  const entry = byDay.get(selected);
  const selectedDate = new Date(`${selected}T12:00:00`);

  return (
    <View style={styles.body}>
      <View style={styles.monthRow}>
        <Pressable hitSlop={10} onPress={() => setMonth(new Date(year, m - 1, 1))} style={styles.nav}>
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={t.rowTitle}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable
          hitSlop={10}
          disabled={isCurrentMonth}
          onPress={() => setMonth(new Date(year, m + 1, 1))}
          style={[styles.nav, isCurrentMonth && styles.disabled]}>
          <SymbolView name="chevron.right" size={16} tintColor={colors.text} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEK.map((d, i) => (
          <Text key={i} style={[t.caption, styles.weekday]}>
            {d}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <View key={`e${i}`} style={styles.cell} />;
          const key = isoDay(new Date(year, m, d));
          const e = byDay.get(key);
          const future = key > todayKey;
          const isSel = key === selected;
          return (
            <Pressable key={key} style={styles.cell} disabled={future} onPress={() => setSelected(key)}>
              <View style={styles.dayCircle}>
                {isSel && <LinearGradient colors={gradient} style={[StyleSheet.absoluteFill, styles.round]} />}
                <Text
                  style={[
                    styles.dayText,
                    future && styles.future,
                    key === todayKey && !isSel && styles.today,
                    isSel && styles.selectedText,
                  ]}>
                  {d}
                </Text>
              </View>
              <View
                style={[
                  styles.dot,
                  e && (e.score != null ? { backgroundColor: colors[scoreBand(e.score)] } : styles.dotHollow),
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Card>
        <Text style={t.caption}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        {entry ? (
          <View style={styles.detail}>
            <View style={styles.detailRow}>
              <Text style={t.rowTitle}>{entry.minutes != null ? hm(entry.minutes) : 'Synced night'}</Text>
              {entry.score != null && (
                <Text style={[t.rowTitle, { color: colors[scoreBand(entry.score)] }]}>{Math.round(entry.score)}%</Text>
              )}
            </View>
            <Text style={t.body}>
              {entry.bed && entry.wake ? `${clock(entry.bed)} - ${clock(entry.wake)}` : 'Bed and wake times not available'}
            </Text>
            <Text style={t.caption}>{entry.source === 'logged' ? 'Logged by hand' : 'Synced from Apple Health'}</Text>
          </View>
        ) : (
          <Text style={[t.body, styles.detail]}>No sleep logged for this night.</Text>
        )}
      </Card>

      <View style={styles.legend}>
        {(['excellent', 'moderate', 'low'] as const).map((b) => (
          <View key={b} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors[b] }]} />
            <Text style={t.caption}>{b[0].toUpperCase() + b.slice(1)}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotHollow]} />
          <Text style={t.caption}>Logged</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', marginBottom: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, gap: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 17 },
  dayText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
  future: { color: colors.dimBar },
  today: { color: colors.tabActive, textDecorationLine: 'underline' },
  selectedText: { color: colors.onAccent, fontFamily: fontFamily.bold },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotHollow: { borderWidth: 1, borderColor: colors.text },
  detail: { gap: 4, marginTop: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
