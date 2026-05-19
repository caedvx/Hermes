import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const C = useColors();

  const inputStyle = {
    backgroundColor: 'rgba(0,188,212,0.07)' as const,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15 as const, color: C.text, marginBottom: 12,
  };

  async function handleSignup() {
    if (!email || !password || !username) { Alert.alert('Error', 'Please fill in all required fields.'); return; }
    if (!ageConfirmed) { Alert.alert('Required', 'You must be 13 years of age or older.'); return; }
    if (!privacyAccepted) { Alert.alert('Required', 'You must accept the Privacy Policy.'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username, full_name: fullName } },
    });
    setLoading(false);
    if (error) Alert.alert('Sign up failed', error.message);
    else Alert.alert('Check your email', 'We sent you a confirmation link.');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{
            fontSize: 42, fontWeight: '700', color: C.primary,
            letterSpacing: 10, textShadowColor: 'rgba(0,188,212,0.35)',
            textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 },
          }}>HERMES</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6, letterSpacing: 0.3 }}>
            Create your account
          </Text>
        </View>

        <GlassCard padding={20} radius={22} style={{ marginBottom: 16 }}>
          <TextInput style={inputStyle} placeholder="Username *" placeholderTextColor={C.textMuted}
            value={username} onChangeText={setUsername} autoCapitalize="none" returnKeyType="next" />
          <TextInput style={inputStyle} placeholder="Full Name" placeholderTextColor={C.textMuted}
            value={fullName} onChangeText={setFullName} returnKeyType="next" />
          <TextInput style={inputStyle} placeholder="Email *" placeholderTextColor={C.textMuted}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
          <TextInput style={inputStyle} placeholder="Password * (min 6 chars)" placeholderTextColor={C.textMuted}
            value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={handleSignup} />

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
            onPress={() => setAgeConfirmed((v) => !v)} activeOpacity={0.7}
          >
            <Ionicons name={ageConfirmed ? 'checkbox' : 'square-outline'} size={20} color={ageConfirmed ? C.primary : C.textMuted} />
            <Text style={{ flex: 1, fontSize: 13, color: C.textSecondary }}>I am 13 years of age or older</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, marginBottom: 16 }}
            onPress={() => setPrivacyAccepted((v) => !v)} activeOpacity={0.7}
          >
            <Ionicons name={privacyAccepted ? 'checkbox' : 'square-outline'} size={20} color={privacyAccepted ? C.primary : C.textMuted} />
            <Text style={{ flex: 1, fontSize: 13, color: C.textSecondary }}>
              I agree to the{' '}
              <Text style={{ color: C.primary, fontWeight: '500' }}
                onPress={() => Linking.openURL('https://caedvx.github.io/Hermes-Privacy-Policy/')}>
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <PillButton label="Create Account" onPress={handleSignup} loading={loading} glow style={{ width: '100%' }} />
        </GlassCard>

        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: C.primary, fontSize: 13, fontWeight: '500' }}>Log In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
