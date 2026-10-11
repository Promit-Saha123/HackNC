import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Divider } from '@/components/Card';
import { GradientButton, OutlineButton } from '@/components/GradientButton';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { usePrefs } from '@/state/prefs';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { clockFromMinutes, hm } from '@/utils/format';
import { isoDay } from '@/utils/nights';

const SHORTCUT_URL = 'shortcuts://run-shortcut?name=SleepSquad%20Sync';

type Props = { visible: boolean; onClose: () => void };

/** Enter a night by hand (bedtime + wake time), or sync from Apple Health via the Shortcut. */
export function LogSleepSheet({ visible, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Log sleep" subtitle="Enter when you went to bed and woke up.">
      {visible && <LogForm onDone={onClose} />}
    </Sheet>
  );
}

/** ISO date-time for `minutes` after midnight on `day` (local time). */
function atMinutes(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function LogForm({ onDone }: { onDone: () => void }) {
  const { goals, addLog } = usePrefs();
  const [daysAgo, setDaysAgo] = useState(0);
  const [bed, setBed] = useState(goals.bedtime);
  const [wake, setWake] = useState(goals.wake);
  const [error, setError] = useState<string | null>(null);

  const wakeDay = new Date();
  wakeDay.setDate(wakeDay.getDate() - daysAgo);
  // A bedtime in the afternoon/evening belongs to the night before the wake-up date.
  const bedDay = new Date(wakeDay);
  if (bed >= 12 * 60) bedDay.setDate(bedDay.getDate() - 1);
  const bedAt = atMinutes(bedDay, bed);
  const wakeAt = atMinutes(wakeDay, wake);
  const minutes = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60000);
  const valid = minutes > 0 && minutes <= 16 * 60;

  const nightLabel =
    daysAgo === 0
      ? 'Last night'
      : `Night before ${wakeDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;

  return (
    <View style={styles.body}>
      <View>
        <Stepper
          label="Night"
          value={daysAgo}
          step={1}
          min={0}
          max={13}
          format={(d) => (d === 0 ? 'Last night' : `${d + 1} nights ago`)}
          onChange={setDaysAgo}
        />
        <Divider />
        <Stepper label="Bedtime" value={bed} step={15} wrap={1440} format={clockFromMinutes} onChange={setBed} />
        <Divider />
        <Stepper label="Wake time" value={wake} step={15} wrap={1440} format={clockFromMinutes} onChange={setWake} />
      </View>

      <View style={styles.summary}>
        <Text style={t.caption}>{nightLabel}</Text>
        <Text style={[styles.total, !valid && { color: colors.danger }]}>{valid ? hm(minutes) : 'Check the times'}</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      <GradientButton
        label="Save night"
        disabled={!valid}
        onPress={() => {
          addLog({ day: isoDay(wakeAt), bed: bedAt.toISOString(), wake: wakeAt.toISOString() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone();
        }}
      />
      <OutlineButton
        label="Sync from Apple Health instead"
        onPress={() => Linking.openURL(SHORTCUT_URL).catch(() => setError('Could not open the Shortcuts app.'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 14 },
});
