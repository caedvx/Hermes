import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleSignup() {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (!ageConfirmed) {
      Alert.alert('Required', 'You must be 13 years of age or older to create an account.');
      return;
    }
    if (!privacyAccepted) {
      Alert.alert('Required', 'You must accept the Privacy Policy to create an account.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
    } else {
      Alert.alert('Check your email', 'We sent you a confirmation link.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>HERMES</Text>
        <Text style={styles.tagline}>Create your account</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Username *"
            placeholderTextColor={C.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={C.textMuted}
            value={fullName}
            onChangeText={setFullName}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password * (min 6 chars)"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <TouchableOpacity
            style={styles.privacyRow}
            onPress={() => setAgeConfirmed((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={ageConfirmed ? 'checkbox' : 'square-outline'}
              size={22}
              color={ageConfirmed ? C.primary : C.textMuted}
            />
            <Text style={styles.privacyText}>I am 13 years of age or older</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.privacyRow}
            onPress={() => setPrivacyAccepted((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={privacyAccepted ? 'checkbox' : 'square-outline'}
              size={22}
              color={privacyAccepted ? C.primary : C.textMuted}
            />
            <Text style={styles.privacyText}>
              I agree to the{' '}
              <Text
                style={styles.privacyLink}
                onPress={() => Linking.openURL('https://caedvx.github.io/Hermes-Privacy-Policy/')}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    inner: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    logo: {
      fontSize: 40,
      fontWeight: '900',
      color: C.primary,
      textAlign: 'center',
      letterSpacing: 6,
      marginBottom: 8,
    },
    tagline: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
      marginBottom: 48,
    },
    form: {
      gap: 12,
    },
    input: {
      backgroundColor: C.surface,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
    },
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    privacyText: {
      flex: 1,
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 20,
    },
    privacyLink: {
      color: C.primary,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    button: {
      backgroundColor: C.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 32,
    },
    footerText: {
      color: C.textMuted,
      fontSize: 14,
    },
    footerLink: {
      color: C.primary,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
