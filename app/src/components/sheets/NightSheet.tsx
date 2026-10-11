import { StyleSheet, Text, View } from 'react-native';

import type { Overview } from '@/api/types';
import { Card, Divider } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Sheet } from '@/components/Sheet';
import type { Goals } from '@/state/prefs';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { clock, clockFromMinutes, hm } from '@/utils/format';
import { STAGE_META, minutesOfDay, type Stages } from '@/utils/nights';

type Props = {
  visible: boolean;
  onClose: () => void;
  overview: Overview | null;
  stages: Stages | null;
  goals: Goals;
};

const SCORE_PARTS = [
  { key: 'duration_pts', label: 'Duration', max: 40 },
  { key: 'consistency_pts', label: 'Bedtime consistency', max: 30 },
  { key: 'quality_pts', label: 'Sleep quality', max: 20 },
  { key: 'streak_pts', label: 'Streak', max: 10 },
] as const;

/** Signed difference in minutes between two clock times, wrapped to -12h..12h. */
const clockDiff = (a: number, b: number) => ((a - b + 720 + 1440) % 1440) - 720;

const offBy = (diff: number, early: string, late: string) =>
  Math.abs(diff) < 5 ? 'right on target' : `${hm(Math.abs(diff))} ${diff < 0 ? early : late}`;

/** Full breakdown behind the Home ring: stages, timing vs targets, and score parts. */
export function NightSheet({ visible, onClose, overview, stages, goals }: Props) {
  const night = overview?.last_night;
  const score = overview?.score;
  const total = stages ? stages.deep + stages.light + stages.rem + stages.awake : 0;

  return (
    <Sheet visible={visible} onClose={onClose} title="Last night" subtitle={score ? `Rest score ${Math.round(score.score)}%` : 'No night synced yet'}>
      <View style={styles.body}>
        {stages && total > 0 && (
          <View style={styles.block}>
            <Text style={t.rowTitle}>Sleep stages · inner ring</Text>
            <Card padding={0}>
              {STAGE_META.map((m, i) => (
                <View key={m.key}>
                  {i > 0 && <Divider />}
                  <View style={styles.stage}>
                    <View style={styles.stageHead}>
                      <View style={[styles.dot, { backgroundColor: m.color }]} />
                      <Text style={[t.rowTitle, styles.flex]}>{m.label}</Text>
                      <Text style={t.rowTitle}>{hm(stages[m.key])}</Text>
                      <Text style={[t.caption, styles.pct]}>{Math.round((stages[m.key] / total) * 100)}%</Text>
                    </View>
                    <ProgressBar value={stages[m.key] / total} color={m.color} />
                    <Text style={t.caption}>{m.about}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {night && (
          <View style={styles.block}>
            <Text style={t.rowTitle}>Timing · outer ring</Text>
            <Card padding={0}>
              <Line
                label="Bedtime"
                value={clock(night.bedtime)}
                sub={offBy(clockDiff(minutesOfDay(night.bedtime), goals.bedtime), 'early', 'late')}
              />
              <Divider />
              <Line
                label="Woke up"
                value={clock(night.wake_time)}
                sub={offBy(clockDiff(minutesOfDay(night.wake_time), goals.wake), 'early', 'late')}
              />
              <Divider />
              <Line
                label="Asleep"
                value={hm(night.duration_min)}
                sub={`Target ${goals.hours} h · ${Math.round(night.efficiency * 100)}% of time in bed asleep`}
              />
            </Card>
            <Text style={t.caption}>
              The outer ring is a 12-hour clock. The bright arc is when you slept; the faint arc is your target,{' '}
              {clockFromMinutes(goals.bedtime)} to {clockFromMinutes(goals.wake)}.
            </Text>
          </View>
        )}

        {score && (
          <View style={styles.block}>
            <Text style={t.rowTitle}>How your score adds up</Text>
            <Card>
              <View style={styles.parts}>
                {SCORE_PARTS.map((p) => (
                  <View key={p.key} style={styles.part}>
                    <View style={styles.stageHead}>
                      <Text style={[t.body, styles.flex, styles.light]}>{p.label}</Text>
                      <Text style={t.body}>
                        {Math.round(score[p.key])}/{p.max}
                      </Text>
                    </View>
                    <ProgressBar value={score[p.key] / p.max} />
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        <Text style={[t.caption, styles.note]}>Sleep stages are demo data for now. Somni is not medical advice.</Text>
      </View>
    </Sheet>
  );
}

function Line({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.flex}>
        <Text style={[t.body, styles.light]}>{label}</Text>
        <Text style={t.caption}>{sub}</Text>
      </View>
      <Text style={t.rowTitle}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20, paddingBottom: 8 },
  block: { gap: 10 },
  stage: { padding: 14, gap: 8 },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  pct: { width: 36, textAlign: 'right' },
  line: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  light: { color: colors.text },
  parts: { gap: 14 },
  part: { gap: 6 },
  note: { textAlign: 'center' },
});
