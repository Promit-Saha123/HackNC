import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Divider } from '@/components/Card';
import { GradientButton } from '@/components/GradientButton';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { usePrefs } from '@/state/prefs';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { clockFromMinutes, hm } from '@/utils/format';

type Props = { visible: boolean; onClose: () => void };

/** Set target bedtime, wake time and hours. */
export function TargetsSheet({ visible, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Sleep targets" subtitle="Your score compares each night to these.">
      {visible && <TargetsForm onDone={onClose} />}
    </Sheet>
  );
}

function TargetsForm({ onDone }: { onDone: () => void }) {
  const { goals, setGoals } = usePrefs();
  const [draft, setDraft] = useState(goals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setGoals(draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your targets.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const window = (draft.wake - draft.bedtime + 1440) % 1440;

  return (
    <View style={styles.body}>
      <View>
        <Stepper
          label="Target bedtime"
          value={draft.bedtime}
          step={15}
          wrap={1440}
          format={clockFromMinutes}
          onChange={(bedtime) => setDraft((d) => ({ ...d, bedtime }))}
        />
        <Divider />
        <Stepper
          label="Target wake time"
          value={draft.wake}
          step={15}
          wrap={1440}
          format={clockFromMinutes}
          onChange={(wake) => setDraft((d) => ({ ...d, wake }))}
        />
        <Divider />
        <Stepper
          label="Target sleep"
          value={draft.hours}
          step={0.5}
          min={5}
          max={11}
          format={(h) => `${h} h`}
          onChange={(hours) => setDraft((d) => ({ ...d, hours }))}
        />
      </View>
      <Text style={t.caption}>
        That window is {hm(window)} in bed. Most adults do best with 7 to 9 hours of sleep.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <GradientButton label={saving ? 'Saving...' : 'Save targets'} disabled={saving} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  error: { color: colors.danger, fontSize: 14 },
});
