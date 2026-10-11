import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, authHeaders } from '@/api/client';
import { IconCircle } from '@/components/IconCircle';
import { Sheet } from '@/components/Sheet';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';

type Props = { userId: number; refreshKey?: number };

/**
 * Gemini morning briefing: a compact two-line row on Home; tap to read it in full.
 * The backend falls back to a template, so this only shows nothing if it's unreachable.
 * When the backend has an ElevenLabs key, the sheet also offers Listen (the briefing read aloud).
 */
export function BriefingCard({ userId, refreshKey }: Props) {
  const key = `${userId}:${refreshKey ?? 0}`;
  // The text plus the request it answers; it's still loading while that isn't the current request.
  const [result, setResult] = useState<{ key: string; text: string | null; audioUrl: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const loading = result?.key !== key;
  const text = result?.text;

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
        {!loading && <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Morning briefing" subtitle="Compared only with your own nights">
        {result?.audioUrl && <ListenButton key={result.audioUrl} url={result.audioUrl} />}
        <Text style={styles.full}>{text}</Text>
        <Text style={t.caption}>Written by Gemini from your sleep data. Not medical advice.</Text>
      </Sheet>
    </>
  );
}

/**
 * Plays the briefing aloud. Audio is only requested on the first tap (the backend generates it on demand),
 * and it stops when the sheet closes because this component unmounts.
 */
function ListenButton({ url }: { url: string }) {
  const [source, setSource] = useState<string | null>(null); // set on first tap
  const autoPlayed = useRef(false);
  // The audio endpoint is private to the signed-in user (STRICT_PRIVACY), so send the token with it.
  const player = useAudioPlayer(source ? { uri: source, headers: authHeaders() } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); // iPhone silent switch would mute it otherwise
  }, []);

  // First tap sets the source; start playing as soon as the MP3 has loaded.
  useEffect(() => {
    if (source && status.isLoaded && !autoPlayed.current) {
      autoPlayed.current = true;
      player.play();
    }
  }, [source, status.isLoaded, player]);

  const finished = status.duration > 0 && status.currentTime >= status.duration - 0.25;
  const onPress = () => {
    if (status.playing) return player.pause();
    if (!source) return setSource(url);
    if (finished) player.seekTo(0);
    player.play();
  };

  const preparing = (!!source && !status.isLoaded) || status.isBuffering;
  const label = status.error ? 'Audio unavailable' : status.playing ? 'Pause' : preparing ? 'Preparing voice…' : finished ? 'Play again' : 'Listen';
  return (
    <Pressable
      onPress={onPress}
      disabled={!!status.error || preparing}
      style={({ pressed }) => [styles.listen, pressed && styles.pressed]}>
      <SymbolView name={status.playing ? 'pause.fill' : 'speaker.wave.2.fill'} size={16} tintColor={colors.text} />
      <Text style={styles.listenText}>{label}</Text>
    </Pressable>
  );
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
