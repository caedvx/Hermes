import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/auth';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && !inTabsGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="activity/[id]"
          options={{ headerShown: true, title: 'Activity', headerBackTitle: 'Back' }}
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
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
