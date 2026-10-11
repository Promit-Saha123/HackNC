import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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

/** Shared password for the demo accounts until real auth exists. */
const DEMO_PASSWORD = 'sleepsquad';
/** New accounts are not on the backend yet, so they sign in to this demo profile. */
const DEMO_PROFILE_ID = 1;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Deep navy glass for the form cards so white text reads on the bright daytime sky. */
const FORM_TINT = 'rgba(10,32,84,0.55)';

const OFFLINE = "Can't reach the server. Check your connection.";

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
              <SignupForm users={users} />
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
  const { signIn, accounts } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const who = username.trim().toLowerCase();
      // Accounts made on this phone: username or email + their own password.
      const local = accounts.find((a) => a.username.toLowerCase() === who || a.email.toLowerCase() === who);
      if (local && local.password === password) {
        finish(DEMO_PROFILE_ID);
        return;
      }
      const list = users.length ? users : await api.users();
      const demo = list.find((u) => u.name.toLowerCase() === who);
      if (!demo || password !== DEMO_PASSWORD) {
        setError('That username and password do not match.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      finish(demo.id);
    } catch {
      setError(OFFLINE);
    } finally {
      setBusy(false);
    }
  };

  const finish = (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    signIn(id);
    router.replace('/');
  };

  return (
    <View style={styles.form}>
      <Card tint={FORM_TINT}>
        <View style={styles.fields}>
          <TextField
            label="Username or email"
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

type SignupErrors = Partial<Record<'name' | 'email' | 'username' | 'password' | 'confirm', string>>;

function SignupForm({ users }: { users: User[] }) {
  const { signIn, accounts, addAccount } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const emailRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): SignupErrors => {
    const e: SignupErrors = {};
    const handle = username.trim().toLowerCase();
    if (name.trim().length < 2) e.name = 'Enter your name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    else if (accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase()))
      e.email = 'An account with this email already exists.';
    if (!/^[a-z0-9_.]{3,20}$/i.test(username.trim())) e.username = '3-20 letters, numbers, dots or underscores.';
    else if (accounts.some((a) => a.username.toLowerCase() === handle) || users.some((u) => u.name.toLowerCase() === handle))
      e.username = 'That username is taken.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    addAccount({ name: name.trim(), email: email.trim(), username: username.trim(), password });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      `Welcome to Somni, ${name.trim().split(' ')[0]}`,
      "Accounts aren't saved on the server yet, so you'll see a demo profile's sleep data for now.",
      [
        {
          text: 'Continue',
          onPress: () => {
            signIn(DEMO_PROFILE_ID);
            router.replace('/');
          },
        },
      ],
    );
  };

  const clear = (k: keyof SignupErrors) => setErrors((e) => ({ ...e, [k]: undefined }));

  return (
    <View style={styles.form}>
      <Card tint={FORM_TINT}>
        <View style={styles.fields}>
          <TextField
            label="Full name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clear('name');
            }}
            placeholder="Alex Rivera"
            autoCapitalize="words"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.name}
          />
          <TextField
            ref={emailRef}
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clear('email');
            }}
            placeholder="you@school.edu"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => userRef.current?.focus()}
            error={errors.email}
          />
          <TextField
            ref={userRef}
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

      <GradientButton label="Create account" onPress={submit} />
      <Text style={[t.caption, styles.center, styles.readable]}>
        Somni reads sleep times and stages only. Friends see your score and streak, nothing else. Not medical advice.
      </Text>
    </View>
  );
}

function ForgotSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Reset password" subtitle="Enter the email you signed up with.">
      {visible && <ForgotForm onDone={onClose} />}
    </Sheet>
  );
}

function ForgotForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <View style={styles.form}>
        <Text style={t.body}>
          Password reset by email isn&apos;t connected yet, so no email was sent to {email.trim()}. For the demo accounts, the
          password is {DEMO_PASSWORD}.
        </Text>
        <GradientButton label="Back to log in" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder="you@school.edu"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => (EMAIL_RE.test(email.trim()) ? setSent(true) : setError('Enter a valid email address.'))}
        error={error}
      />
      <GradientButton
        label="Send reset link"
        disabled={!email.trim()}
        onPress={() => (EMAIL_RE.test(email.trim()) ? setSent(true) : setError('Enter a valid email address.'))}
      />
    </View>
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
