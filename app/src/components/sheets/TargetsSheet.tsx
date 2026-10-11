import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Divider } from '@/components/Card';
import { GradientButton } from '@/components/GradientButton';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { usePrefs } from '@/state/prefs';
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
      <GradientButton
        label="Save targets"
        onPress={() => {
          setGoals(draft);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
});
