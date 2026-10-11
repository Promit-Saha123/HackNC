import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import type { User } from '@/api/types';
import { Card, Divider } from '@/components/Card';
import { GradientButton } from '@/components/GradientButton';
import { useUser } from '@/state/user';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { SCREEN_PADDING, radius, spacing } from '@/theme/spacing';

/** Shared password for the demo accounts until real auth exists. */
const DEMO_PASSWORD = 'sleepsquad';

export default function LoginScreen() {
  const { signIn } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<'user' | 'pass' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);

  useEffect(() => {
    let live = true;
    api
      .users()
      .then((u) => live && setUsers(u))
      .catch(() => live && setError("Can't reach the server. Check your connection."));
    return () => {
      live = false;
    };
  }, []);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const list = users.length ? users : await api.users();
      const match = list.find((u) => u.name.toLowerCase() === username.trim().toLowerCase());
      if (!match || password !== DEMO_PASSWORD) {
        setError('That username and password do not match.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      signIn(match.id);
      router.replace('/');
    } catch {
      setError("Can't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.edgeGlow, colors.bg, colors.bg]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <View style={styles.moon}>
                <SymbolView name="moon.stars.fill" size={40} tintColor={colors.text} />
              </View>
              <Text style={t.title}>Sleep Squad</Text>
              <Text style={[t.subtitle, styles.center]}>Make sleep the thing your friends compete on.</Text>
            </View>

            <Card padding={0}>
              <TextInput
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  setError(null);
                }}
                placeholder="Username"
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
                onFocus={() => setFocus('user')}
                onBlur={() => setFocus(null)}
                style={[styles.input, focus === 'user' && styles.inputFocus]}
              />
              <Divider />
              <TextInput
                ref={passRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="Password"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                onFocus={() => setFocus('pass')}
                onBlur={() => setFocus(null)}
                style={[styles.input, focus === 'pass' && styles.inputFocus]}
              />
            </Card>

            {error && <Text style={styles.error}>{error}</Text>}

            <GradientButton label={busy ? 'Logging in...' : 'Log in'} onPress={submit} disabled={busy || !username || !password} />

            {users.length > 0 && (
              <View style={styles.demo}>
                <Text style={[t.caption, styles.center]}>Demo accounts · password {DEMO_PASSWORD}</Text>
                <View style={styles.chips}>
                  {users.map((u) => (
                    <Pressable
                      key={u.id}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => {
                        setUsername(u.name);
                        setPassword(DEMO_PASSWORD);
                        setError(null);
                      }}>
                      <Text style={styles.chipText}>{u.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing.xl, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  moon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.glow,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  center: { textAlign: 'center' },
  input: {
    height: 52,
    paddingHorizontal: 16,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocus: { borderColor: colors.accentEnd },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  demo: { gap: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.text },
  pressed: { opacity: 0.75 },
});
