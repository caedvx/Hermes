import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const C = useColors();

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Please enter your email and password.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AuroraBackground />
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>

        {/* Wordmark */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text style={{
            fontSize: 42, fontWeight: '700', color: C.primary,
            letterSpacing: 10, textShadowColor: 'rgba(0,188,212,0.35)',
            textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 },
          }}>
            HERMES
          </Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6, letterSpacing: 0.3 }}>
            Track every step. Own every mile.
          </Text>
        </View>

        {/* Glass form card */}
        <GlassCard padding={20} radius={22} style={{ marginBottom: 16 }}>
          <TextInput
            style={{
              backgroundColor: 'rgba(0,188,212,0.07)',
              borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
              paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 15, color: C.text, marginBottom: 12,
            }}
            placeholder="Email"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={{
              backgroundColor: 'rgba(0,188,212,0.07)',
              borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
              paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 15, color: C.text, marginBottom: 20,
            }}
            placeholder="Password"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <PillButton label="Log In" onPress={handleLogin} loading={loading} glow style={{ width: '100%' }} />
        </GlassCard>

        {/* Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={{ color: C.primary, fontSize: 13, fontWeight: '500' }}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
