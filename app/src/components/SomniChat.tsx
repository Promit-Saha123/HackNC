import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
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

import { ApiError, api, authHeaders } from '@/api/client';
import { GlassIconButton } from '@/components/Glass';
import type { ChatMessage } from '@/api/types';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { radius, spacing } from '@/theme/spacing';

const STARTERS = ['Why did my score change?', "How's my streak going?", 'How can I climb the leaderboard?'];

type Turn = ChatMessage & { local?: boolean }; // local = greeting/errors shown in the UI but never sent to the API

/** Somni icon for the Home header (next to the calendar); opens the Somni chat sheet (type or talk). */
export function SomniButton({ userId, name }: { userId: number; name?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GlassIconButton onPress={() => setOpen(true)}>
        <SymbolView name="sparkles" size={20} tintColor={colors.text} />
      </GlassIconButton>
      {/* key: a different user starts a fresh conversation */}
      <SomniChat key={userId} visible={open} onClose={() => setOpen(false)} userId={userId} name={name} />
    </>
  );
}

type Props = { visible: boolean; onClose: () => void; userId: number; name?: string };

/**
 * Somni chat: Gemini answers about the user's own Somnia data only (backend: POST /ai/chat/{id}).
 * Voice: tap the mic, speak, tap again. ElevenLabs transcribes the question and Somni's reply is spoken back.
 */
export function SomniChat({ visible, onClose, userId, name }: Props) {
  const greeting = `Hi${name ? ` ${name.split(' ')[0]}` : ''}! I'm Somni. Ask me anything about your sleep, scores, streaks or squad.`;
  const [turns, setTurns] = useState<Turn[]>([{ role: 'somni', text: greeting, local: true }]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const list = useRef<FlatList<Turn>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voice = useAudioPlayer(null); // plays Somni's spoken replies
  const [mic, setMic] = useState<'idle' | 'recording' | 'transcribing'>('idle');

  // Keep the newest message in view.
  useEffect(() => {
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [turns.length, thinking]);

  const say = (text: string) => setTurns((prev) => [...prev, { role: 'somni', text, local: true }]);

  const send = async (text: string, speak = false) => {
    const question = text.trim();
    if (!question || thinking) return;
    const history: Turn[] = [...turns, { role: 'user', text: question }];
    setTurns(history);
    setDraft('');
    setThinking(true);
    try {
      const sent = history.filter((m) => !m.local).map(({ role, text: body }) => ({ role, text: body }));
      const r = await api.chat(userId, sent, { speak });
      setTurns((prev) => [...prev, { role: 'somni', text: r.reply }]);
      setSuggestions(r.suggestions.length ? r.suggestions : STARTERS);
      if (speak && r.audio_url) {
        voice.replace({ uri: r.audio_url, headers: authHeaders() });
        voice.play();
      }
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? "You're chatting fast! Give me a minute and ask again."
          : "I couldn't reach the server. Check your connection and try again.";
      say(msg);
    } finally {
      setThinking(false);
    }
  };

  // Push-to-talk: first tap starts recording, second tap stops, transcribes (ElevenLabs) and asks Somni out loud.
  const toggleMic = async () => {
    if (mic === 'transcribing' || thinking) return;
    if (mic === 'idle') {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return say('Allow microphone access in Settings to talk to me.');
      voice.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMic('recording');
      return;
    }
    setMic('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); // replies play on the speaker
      if (!recorder.uri) throw new Error('no recording');
      const { text } = await api.transcribe(userId, recorder.uri);
      setMic('idle');
      await send(text, true);
    } catch (e) {
      setMic('idle');
      say(e instanceof ApiError ? e.message : "I couldn't hear that. Try again, or type your question.");
    }
  };

  const close = () => {
    voice.pause();
    if (mic === 'recording') {
      recorder.stop().catch(() => {});
      setMic('idle');
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <SymbolView name="moon.stars.fill" size={20} tintColor={colors.onAccent} />
          </View>
          <View style={styles.headerText}>
            <Text style={t.section}>Somni</Text>
            <Text style={t.caption}>Your sleep coach · answers from your Somnia data</Text>
          </View>
          <Pressable accessibilityLabel="Close chat" onPress={close} hitSlop={12} style={styles.close}>
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
            thinking || mic === 'transcribing' ? (
              <View style={[styles.bubble, styles.somniBubble, styles.thinking]}>
                <ActivityIndicator size="small" color={colors.textSoft} />
                <Text style={t.caption}>{mic === 'transcribing' ? 'Listening back…' : 'Somni is thinking…'}</Text>
              </View>
            ) : null
          }
        />

        {!thinking && mic === 'idle' && suggestions.length > 0 && (
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
          <Pressable
            accessibilityLabel={mic === 'recording' ? 'Stop and send voice question' : 'Ask by voice'}
            onPress={toggleMic}
            disabled={mic === 'transcribing' || thinking}
            style={[styles.mic, mic === 'recording' && styles.micLive, (mic === 'transcribing' || thinking) && styles.sendDisabled]}>
            <SymbolView name={mic === 'recording' ? 'stop.fill' : 'mic.fill'} size={16} tintColor={mic === 'recording' ? colors.onAccent : colors.text} />
          </Pressable>
          {mic === 'recording' ? (
            <View style={styles.listening}>
              <View style={styles.liveDot} />
              <Text style={styles.listeningText}>Listening… tap stop to send</Text>
            </View>
          ) : (
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
          )}
          <Pressable
            accessibilityLabel="Send"
            onPress={() => send(draft)}
            disabled={!draft.trim() || thinking}
            style={[styles.send, (!draft.trim() || thinking) && styles.sendDisabled]}>
            <SymbolView name="arrow.up" size={16} tintColor={colors.onAccent} />
          </Pressable>
        </View>
        <Text style={[t.caption, styles.footer]}>Somni only uses your Somnia data. Not medical advice.</Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Same look as the calendar button beside it in Home's header.
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  mic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLive: { backgroundColor: colors.down },
  listening: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.down,
    backgroundColor: colors.card,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.down },
  listeningText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
  footer: { textAlign: 'center', paddingTop: 6, paddingBottom: spacing.lg },
});
