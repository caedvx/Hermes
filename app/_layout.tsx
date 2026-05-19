import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/auth';
import { ThemeProvider, useTheme } from '@/contexts/theme';

function RootNavigator() {
  const { session, loading } = useAuth();
  const { isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!session && !inAuthGroup) {
      // Not logged in — send to login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Logged in but somehow on an auth screen — send to app
      router.replace('/(tabs)');
    }
    // Authenticated users on any other route (activity/[id], athlete/[username],
    // groups/*, etc.) are left alone — the Stack handles them normally.
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="activity/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="athlete/[username]"
          options={{ headerShown: true, title: 'Athlete', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="groups/index"
          options={{ headerShown: true, title: 'Groups', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="groups/[id]"
          options={{ headerShown: true, title: 'Group', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="groups/create"
          options={{ headerShown: true, title: 'New Group', headerBackTitle: 'Cancel' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
