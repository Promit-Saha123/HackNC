import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  /** false = fixed layout that fits one screen (children lay out with flex). */
  scroll?: boolean;
};

/** Dark navy background with a soft blue edge glow, a big title row, and a scrolling (or fixed) body. */
export function Screen({ title, subtitle, right, children, refreshing, onRefresh, scroll = true }: Props) {
  const header = (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={t.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={t.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.edgeGlow, colors.bg, colors.bg, colors.edgeGlow]}
        locations={[0, 0.3, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textSoft} />
              ) : undefined
            }>
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fixed]}>
            {header}
            {children}
          </View>
        )}
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
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.lg },
  fixed: { flex: 1, gap: 12, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titles: { flex: 1, gap: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs },
  section: { gap: 12 },
});
