import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GradientButton } from '@/components/GradientButton';
import { Sheet } from '@/components/Sheet';
import { type as t } from '@/theme/fonts';

export type Info = {
  title: string;
  subtitle?: string;
  /** Paragraphs of explanation. */
  body: string[];
  /** Optional extra content (a list, a stat) under the text. */
  extra?: ReactNode;
  action?: { label: string; onPress: () => void };
};

/** Simple "tap for details" pop-up: a title, a few lines of text, and an optional action. */
export function InfoSheet({ info, onClose }: { info: Info | null; onClose: () => void }) {
  return (
    <Sheet visible={!!info} onClose={onClose} title={info?.title} subtitle={info?.subtitle}>
      {info && (
        <View style={styles.body}>
          {info.body.map((p, i) => (
            <Text key={i} style={t.body}>
              {p}
            </Text>
          ))}
          {info.extra}
          {info.action && <GradientButton label={info.action.label} onPress={info.action.onPress} />}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
});
