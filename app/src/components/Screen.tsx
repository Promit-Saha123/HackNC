import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { SCREEN_PADDING, spacing } from '@/theme/spacing';

type Props = {
  title: string;
  subtitle?: string;
  /** Top-right slot (avatar, calendar icon). */
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** Black backdrop with soft light, a big title row, and a scrolling body that clears the glass tab bar. */
export function Screen({ title, subtitle, right, children, refreshing, onRefresh }: Props) {
  return (
    <View style={styles.root}>
      <Backdrop />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textSoft} />
            ) : undefined
          }>
          <View style={styles.header}>
            <View style={styles.titles}>
              <Text style={t.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? <Text style={t.subtitle}>{subtitle}</Text> : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Heading above a card, 12 pt gap to the card. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={t.section}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.sm, paddingBottom: 110, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titles: { flex: 1, gap: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing.xs },
  section: { gap: 12 },
});
