import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { api, authHeaders } from '@/api/client';
import { IconCircle } from '@/components/IconCircle';
import { Sheet } from '@/components/Sheet';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Props = { userId: number; refreshKey?: number };

/**
 * Gemini morning briefing: a compact two-line row on Home; tap to read it in full.
 * The backend falls back to a template, so this only shows nothing if it's unreachable.
 * When the backend has an ElevenLabs key, a speaker icon on the row (and Listen in the sheet) reads it aloud.
 */
export function BriefingCard({ userId, refreshKey }: Props) {
  const key = `${userId}:${refreshKey ?? 0}`;
  // The text plus the request it answers; it's still loading while that isn't the current request.
  const [result, setResult] = useState<{ key: string; text: string | null; audioUrl: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const loading = result?.key !== key;
  const text = result?.text;
  const audio = useBriefingAudio(loading ? null : (result?.audioUrl ?? null));

  useEffect(() => {
    let live = true;
    api
      .briefing(userId)
      .then((b) => ({ text: b.text, audioUrl: b.audio_url ?? null }))
      .catch(() => ({ text: null, audioUrl: null }))
      .then((r) => {
        if (live) setResult({ key: `${userId}:${refreshKey ?? 0}`, ...r });
      });
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  if (!loading && !text) return null;

  return (
    <>
      <Pressable
        disabled={loading}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <IconCircle name="sparkles" size={38} />
        <View style={styles.body}>
          <Text style={styles.label}>Morning briefing</Text>
          <Text style={loading ? styles.loading : styles.text} numberOfLines={2}>
            {loading ? 'Writing your briefing…' : text}
          </Text>
        </View>
        {audio.available && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={audio.playing ? 'Pause briefing' : 'Listen to briefing'}
            hitSlop={8}
            onPress={audio.toggle}
            disabled={audio.unavailable || audio.preparing}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}>
            {audio.preparing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <SymbolView name={audio.icon} size={14} tintColor={audio.unavailable ? colors.textSoft : colors.text} />
            )}
          </Pressable>
        )}
        {!loading && <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Morning briefing" subtitle="Compared only with your own nights">
        {audio.available && (
          <Pressable
            onPress={audio.toggle}
            disabled={audio.unavailable || audio.preparing}
            style={({ pressed }) => [styles.listen, pressed && styles.pressed]}>
            <SymbolView name={audio.icon} size={16} tintColor={colors.text} />
            <Text style={styles.listenText}>{audio.label}</Text>
          </Pressable>
        )}
        <Text style={styles.full}>{text}</Text>
        <Text style={t.caption}>Written by Gemini from your sleep data. Not medical advice.</Text>
      </Sheet>
    </>
  );
}

/**
 * One player for the briefing, shared by the row's speaker icon and the sheet's Listen button.
 * The MP3 is only requested on the first tap (the backend generates it on demand), and a new briefing
 * (different url) starts fresh. Playback keeps going when the sheet closes; pause it from the row.
 */
function useBriefingAudio(url: string | null) {
  const [requested, setRequested] = useState<string | null>(null);
  const source = url && requested === url ? url : null;
  const autoPlayed = useRef<string | null>(null);
  // The audio endpoint is private to the signed-in user (STRICT_PRIVACY), so send the token with it.
  const player = useAudioPlayer(source ? { uri: source, headers: authHeaders() } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); // iPhone silent switch would mute it otherwise
  }, []);

  // First tap sets the source; start playing as soon as the MP3 has loaded.
  useEffect(() => {
    if (source && status.isLoaded && autoPlayed.current !== source) {
      autoPlayed.current = source;
      player.play();
    }
  }, [source, status.isLoaded, player]);

  const finished = status.duration > 0 && status.currentTime >= status.duration - 0.25;
  const preparing = (!!source && !status.isLoaded) || status.isBuffering;
  const unavailable = !!status.error;
  const toggle = () => {
    if (!url) return;
    if (status.playing) return player.pause();
    if (!source) return setRequested(url);
    if (finished) player.seekTo(0);
    player.play();
  };

  return {
    available: !!url,
    playing: status.playing,
    preparing,
    unavailable,
    toggle,
    icon: unavailable ? ('speaker.slash.fill' as const) : status.playing ? ('pause.fill' as const) : ('speaker.wave.2.fill' as const),
    label: unavailable
      ? 'Audio unavailable'
      : status.playing
        ? 'Pause'
        : preparing
          ? 'Preparing voice…'
          : finished
            ? 'Play again'
            : 'Listen',
  };
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19, color: colors.text },
  loading: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textSoft, fontStyle: 'italic' },
  speaker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  listenText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.text },
  full: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25, color: colors.text },
});
