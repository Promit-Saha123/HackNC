import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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
import { ApiError, type LoginResponse, type User } from '@/api/types';
import { Backdrop } from '@/components/Backdrop';
import { Card } from '@/components/Card';
import { GradientButton } from '@/components/GradientButton';
import { Logo } from '@/components/Logo';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { useSky } from '@/state/sky';
import { useUser } from '@/state/user';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { SCREEN_PADDING, spacing } from '@/theme/spacing';

/** Shared password for the demo profiles (the backend accepts it for is_demo users only). */
const DEMO_PASSWORD = 'sleepsquad';
/** Same rule as the backend: 3-24 letters, digits, _ . or -. */
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,24}$/;

const OFFLINE = "Can't reach the server. Check your connection.";

/** The backend's message for a rejected request, or the offline message if the request never got there. */
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : OFFLINE);

function useFinish() {
  const { signIn } = useUser();
  return (res: LoginResponse) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    signIn(res);
    router.replace('/');
  };
}

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [users, setUsers] = useState<User[]>([]);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .users()
      .then((u) => live && setUsers(u))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      <Backdrop />
      <Scrim />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Logo />
              <Text style={styles.brand}>Somni</Text>
              <Text style={[t.subtitle, styles.center, styles.readable]}>
                {mode === 'login' ? 'Make sleep the thing your friends compete on.' : 'Create your account'}
              </Text>
            </View>

            {mode === 'login' ? (
              <LoginForm users={users} onForgot={() => setForgotOpen(true)} />
            ) : (
              <SignupForm />
            )}

            <View style={styles.switchRow}>
              <Text style={[t.body, styles.readable]}>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</Text>
              <Pressable hitSlop={8} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                <Text style={styles.link}>{mode === 'login' ? 'Create one' : 'Log in'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ForgotSheet visible={forgotOpen} onClose={() => setForgotOpen(false)} />
    </View>
  );
}

function LoginForm({ users, onForgot }: { users: User[]; onForgot: () => void }) {
  const finish = useFinish();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      finish(await api.login(username.trim(), password));
    } catch (e) {
      setError(messageOf(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Card>
        <View style={styles.fields}>
          <TextField
            label="Username"
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              setError(null);
            }}
            placeholder="maya"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
          />
          <TextField
            ref={passRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            placeholder="Password"
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Pressable hitSlop={8} onPress={onForgot} style={styles.forgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </View>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      <GradientButton label={busy ? 'Logging in...' : 'Log in'} onPress={submit} disabled={busy || !username || !password} />

      {users.length > 0 && (
        <View style={styles.demo}>
          <Text style={[t.caption, styles.center, styles.readable]}>Demo accounts · password {DEMO_PASSWORD}</Text>
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
    </View>
  );
}

type SignupErrors = Partial<Record<'username' | 'password' | 'confirm' | 'form', string>>;

function SignupForm() {
  const finish = useFinish();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): SignupErrors => {
    const e: SignupErrors = {};
    if (!USERNAME_RE.test(username.trim())) e.username = '3-24 letters, numbers, dots, dashes or underscores.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBusy(true);
    try {
      finish(await api.signup(username.trim(), password));
    } catch (err) {
      const msg = messageOf(err);
      // 409 = username taken; show it under the field instead of the form.
      setErrors(err instanceof ApiError && err.status === 409 ? { username: msg } : { form: msg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const clear = (k: keyof SignupErrors) => setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));

  return (
    <View style={styles.form}>
      <Card>
        <View style={styles.fields}>
          <TextField
            label="Username"
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              clear('username');
            }}
            placeholder="alex.r"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
            error={errors.username}
          />
          <TextField
            ref={passRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clear('password');
            }}
            placeholder="At least 8 characters"
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            error={errors.password}
          />
          <TextField
            ref={confirmRef}
            label="Confirm password"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              clear('confirm');
            }}
            placeholder="Type it again"
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.confirm}
          />
        </View>
      </Card>

      {errors.form && <Text style={styles.error}>{errors.form}</Text>}
      <GradientButton label={busy ? 'Creating account...' : 'Create account'} onPress={submit} disabled={busy} />
      <Text style={[t.caption, styles.center, styles.readable]}>
        Somni reads sleep times and stages only. Friends see your score and streak, nothing else. Not medical advice.
      </Text>
    </View>
  );
}

function ForgotSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Forgot password">
      <View style={styles.form}>
        <Text style={t.body}>
          Somni doesn&apos;t store your email, so there&apos;s no reset link yet. If you&apos;re still signed in on another phone,
          change it in Profile. Demo profiles use the password {DEMO_PASSWORD}.
        </Text>
        <GradientButton label="Back to log in" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const shadow = { textShadowColor: 'rgba(5,20,60,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  brand: { fontFamily: fontFamily.bold, fontSize: 40, color: colors.text, letterSpacing: -0.5, marginTop: spacing.sm },
  center: { textAlign: 'center' },
  form: { gap: spacing.md },
  fields: { gap: 14 },
  forgot: { alignSelf: 'flex-end' },
  link: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text, textDecorationLine: 'underline', ...shadow },
  readable: { color: 'rgba(255,255,255,0.94)', ...shadow },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  demo: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,26,70,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.text },
  pressed: { opacity: 0.75 },
});

/** Darkens the sky behind the form, more in daylight, so text stays readable at any hour. */
function Scrim() {
  const { daylight } = useSky();
  const a = (k: number) => `rgba(6,22,64,${(k * (0.25 + daylight * 0.45)).toFixed(2)})`;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[a(0.9), a(0.7), a(1)]}
      locations={[0, 0.45, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
