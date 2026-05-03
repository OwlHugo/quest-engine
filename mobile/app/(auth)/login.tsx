import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { ColorPalette, font, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Owl from '@/components/Owl';
import Button from '@/components/Button';
import Input from '@/components/Input';

export default function Login() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <View style={s.hero}>
          <Owl size={140} mood="wave" />
          <Text style={s.brand}>Quest Engine</Text>
          <Text style={s.tagline}>Tua rotina, em modo aventura.</Text>
        </View>

        <View style={s.form}>
          <Input
            placeholder="email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button label="Entrar" onPress={submit} loading={loading} />
          <Link href="/(auth)/register" style={s.link}>Ainda não tenho conta</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
    hero: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
    brand: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.text, marginTop: spacing.md },
    tagline: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.regular },
    form: { gap: spacing.md, paddingBottom: spacing.xxl },
    link: { textAlign: 'center', color: colors.info, fontWeight: font.weight.bold, fontSize: font.size.md, marginTop: spacing.sm },
  });
}
