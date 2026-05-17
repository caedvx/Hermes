import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/ActivityCard';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';

export default function FeedScreen() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fetchFeed = useCallback(async () => {
    if (!user) return;

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followingIds = (follows as { following_id: string }[] | null)?.map((f) => f.following_id) ?? [];
    const ids = [user.id, ...followingIds];

    const { data } = await supabase
      .from('activities')
      .select('*, profiles(id, username, full_name, avatar_url)')
      .in('user_id', ids)
      .in('status', ['public', 'followers_only'])
      .order('start_at', { ascending: false })
      .limit(30);

    setActivities((data as Activity[]) ?? []);
  }, [user]);

  useEffect(() => {
    fetchFeed().finally(() => setLoading(false));
  }, [fetchFeed]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HERMES</Text>
      </View>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityCard activity={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={64} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptySubtitle}>Follow athletes or record your first activity!</Text>
          </View>
        }
        contentContainerStyle={activities.length === 0 && styles.emptyContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: C.primary,
      letterSpacing: 4,
    },
    separator: {
      height: 8,
    },
    emptyContainer: {
      flex: 1,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      marginTop: 80,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
    },
  });
}
