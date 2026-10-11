import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError, api } from '@/api/client';
import type { ChatMessage } from '@/api/types';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

const STARTERS = ['Why did my score change?', "How's my streak going?", 'How can I climb the leaderboard?'];

type Turn = ChatMessage & { local?: boolean }; // local = greeting/errors shown in the UI but never sent to the API

/** Floating "Ask Somni" button for Home; opens the Somni chat sheet. */
export function SomniButton({ userId, name }: { userId: number; name?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Somni, your sleep coach"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <SymbolView name="sparkles" size={16} tintColor={colors.onAccent} />
        <Text style={styles.fabText}>Ask Somni</Text>
      </Pressable>
      {/* key: a different user starts a fresh conversation */}
      <SomniChat key={userId} visible={open} onClose={() => setOpen(false)} userId={userId} name={name} />
    </>
  );
}

type Props = { visible: boolean; onClose: () => void; userId: number; name?: string };

/** Somni chat: Gemini answers about the user's own Sleep Squad data only (backend: POST /ai/chat/{id}). */
export function SomniChat({ visible, onClose, userId, name }: Props) {
  const greeting = `Hi${name ? ` ${name.split(' ')[0]}` : ''}! I'm Somni. Ask me anything about your sleep, scores, streaks or squad.`;
  const [turns, setTurns] = useState<Turn[]>([{ role: 'somni', text: greeting, local: true }]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const list = useRef<FlatList<Turn>>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [turns.length, thinking]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    const history: Turn[] = [...turns, { role: 'user', text: question }];
    setTurns(history);
    setDraft('');
    setThinking(true);
    try {
      const sent = history.filter((m) => !m.local).map(({ role, text: body }) => ({ role, text: body }));
      const r = await api.chat(userId, sent);
      setTurns((prev) => [...prev, { role: 'somni', text: r.reply }]);
      setSuggestions(r.suggestions.length ? r.suggestions : STARTERS);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? "You're chatting fast! Give me a minute and ask again."
          : "I couldn't reach the server. Check your connection and try again.";
      setTurns((prev) => [...prev, { role: 'somni', text: msg, local: true }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <SymbolView name="moon.stars.fill" size={20} tintColor={colors.onAccent} />
          </View>
          <View style={styles.headerText}>
            <Text style={t.section}>Somni</Text>
            <Text style={t.caption}>Your sleep coach · answers from your Sleep Squad data</Text>
          </View>
          <Pressable accessibilityLabel="Close chat" onPress={onClose} hitSlop={12} style={styles.close}>
            <SymbolView name="xmark" size={14} tintColor={colors.textSoft} />
          </Pressable>
        </View>

        <FlatList
          ref={list}
          data={turns}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.somniBubble]}>
              <Text style={item.role === 'user' ? styles.userText : styles.somniText}>{item.text}</Text>
            </View>
          )}
          ListFooterComponent={
            thinking ? (
              <View style={[styles.bubble, styles.somniBubble, styles.thinking]}>
                <ActivityIndicator size="small" color={colors.textSoft} />
                <Text style={t.caption}>Somni is thinking…</Text>
              </View>
            ) : null
          }
        />

        {!thinking && suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chips}>
            {suggestions.map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your sleep…"
            placeholderTextColor={colors.tabInactive}
            style={styles.input}
            maxLength={500}
            multiline
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => send(draft)}
          />
          <Pressable
            accessibilityLabel="Send"
            onPress={() => send(draft)}
            disabled={!draft.trim() || thinking}
            style={[styles.send, (!draft.trim() || thinking) && styles.sendDisabled]}>
            <SymbolView name="arrow.up" size={16} tintColor={colors.onAccent} />
          </Pressable>
        </View>
        <Text style={[t.caption, styles.footer]}>Somni only uses your Sleep Squad data. Not medical advice.</Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 0,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    shadowColor: colors.glow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fabText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.onAccent },
  pressed: { opacity: 0.8 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  somniBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  somniText: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  userText: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, color: colors.onAccent },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.highlight,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
  footer: { textAlign: 'center', paddingTop: 6, paddingBottom: spacing.lg },
});
