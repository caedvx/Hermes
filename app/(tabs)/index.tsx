import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { ActivityCard } from '@/components/ActivityCard';
import { useColors } from '@/hooks/useColors';

export default function FeedScreen() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const C = useColors();

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    const followingIds = (follows as { following_id: string }[] | null)?.map((f) => f.following_id) ?? [];
    const { data } = await supabase
      .from('activities')
      .select('*, profiles(id, username, full_name, avatar_url)')
      .in('user_id', [user.id, ...followingIds])
      .in('status', ['public', 'followers_only'])
      .order('start_at', { ascending: false })
      .limit(30);
    setActivities((data as Activity[]) ?? []);
  }, [user]);

  useEffect(() => { fetchFeed().finally(() => setLoading(false)); }, [fetchFeed]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)',
      }}>
        <Text style={{
          fontSize: 20, fontWeight: '700', color: C.primary,
          letterSpacing: 6, textShadowColor: 'rgba(0,188,212,0.30)',
          textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
        }}>
          HERMES
        </Text>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityCard activity={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 }}>
            <Ionicons name="barbell-outline" size={48} color={C.textMuted} />
            <Text style={{ fontSize: 17, fontWeight: '500', color: C.text }}>No activities yet</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
              Follow athletes or record your first activity
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </SafeAreaView>
  );
}
