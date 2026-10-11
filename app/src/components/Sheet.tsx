import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Glass, HAS_GLASS } from '@/components/Glass';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';
import { SCREEN_PADDING, spacing } from '@/theme/spacing';

type Props = { visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode };

/** Pull this far (pt), or flick this fast (pt/s), to close. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;

/**
 * Bottom sheet over a dimmed backdrop. Drag it down (from anywhere once its content is scrolled to the top)
 * to close, tap outside, or tap the close button. Long content scrolls inside. Lifts above the keyboard.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const drag = useSharedValue(0);
  const scrollY = useSharedValue(0);
  // Finger travel already spent scrolling the content back to the top; the sheet only moves past that.
  const spent = useSharedValue(0);

  useEffect(() => {
    if (visible) drag.set(0);
  }, [visible, drag]);

  const close = () => {
    Haptics.selectionAsync();
    onClose();
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(native)
    .activeOffsetY([-8, 8])
    .onStart(() => {
      spent.set(0);
    })
    .onUpdate((e) => {
      if (scrollY.get() > 0) {
        spent.set(e.translationY);
        drag.set(0);
      } else {
        drag.set(Math.max(0, e.translationY - spent.get()));
      }
    })
    .onEnd((e) => {
      if (drag.get() > CLOSE_DISTANCE || (drag.get() > 10 && e.velocityY > CLOSE_VELOCITY)) {
        drag.set(withTiming(height, { duration: 220 }, () => scheduleOnRN(close)));
      } else {
        drag.set(withSpring(0, { damping: 22, stiffness: 260 }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  // Backdrop lightens as the sheet is pulled away.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, drag.get() / (height * 0.6)) }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={styles.fill} onPress={onClose} />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.wrap, sheetStyle]}>
              <Glass solid style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
                <View style={styles.grabber} />
                <View style={styles.head}>
                  <View style={styles.headText}>
                    {title && <Text style={t.section}>{title}</Text>}
                    {subtitle && <Text style={t.body}>{subtitle}</Text>}
                  </View>
                  <Pressable hitSlop={10} onPress={close} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                    <SymbolView name="xmark" size={13} tintColor={colors.text} />
                  </Pressable>
                </View>

                <GestureDetector gesture={native}>
                  <Animated.ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {children}
                  </Animated.ScrollView>
                </GestureDetector>
              </Glass>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Darker dim than before: the sheet glass is see-through, so the screen behind must recede.
  backdrop: { flex: 1, backgroundColor: 'rgba(4,16,52,0.62)' },
  // Soft shadow above the panel so it clearly sits on top of the screen.
  wrap: {
    maxHeight: '88%',
    shadowColor: '#020A24',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  sheet: {
    backgroundColor: HAS_GLASS ? undefined : colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.sm,
    gap: spacing.md,
    flexShrink: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, gap: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.sm },
});
