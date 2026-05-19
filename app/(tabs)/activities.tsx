import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, formatDate, sportIoniconName, sportLabel } from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const C = useColors();

  const fetchActivities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('activities').select('*').eq('user_id', user.id).order('start_at', { ascending: false });
    setActivities((data as Activity[]) ?? []);
  }, [user]);

  useEffect(() => { fetchActivities().finally(() => setLoading(false)); }, [fetchActivities]);

  async function onRefresh() { setRefreshing(true); await fetchActivities(); setRefreshing(false); }

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '500', color: C.text, letterSpacing: -0.3 }}>My Activities</Text>
        <Text style={{ fontSize: 12, color: C.primary, fontWeight: '500', backgroundColor: 'rgba(0,188,212,0.10)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' }}>
          {activities.length}
        </Text>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/activity/${item.id}`)} activeOpacity={0.85}>
            <GlassCard style={{ marginHorizontal: 12 }} padding={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,188,212,0.10)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={sportIoniconName(item.sport_type) as never} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: C.text, letterSpacing: -0.2, marginBottom: 2 }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{formatDate(item.start_at)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, color: C.primary, fontWeight: '500' }}>{formatDistance(item.distance)}</Text>
                    <Text style={{ fontSize: 13, color: C.textMuted }}>·</Text>
                    <Text style={{ fontSize: 13, color: C.primary, fontWeight: '500' }}>{formatDuration(item.elapsed_time)}</Text>
                    {item.elevation_gain != null && (
                      <>
                        <Text style={{ fontSize: 13, color: C.textMuted }}>·</Text>
                        <Text style={{ fontSize: 13, color: C.secondary, fontWeight: '500' }}>+{Math.round(item.elevation_gain)}m</Text>
                      </>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 80, gap: 8 }}>
            <Ionicons name="list-outline" size={48} color={C.textMuted} />
            <Text style={{ fontSize: 17, fontWeight: '500', color: C.text }}>No activities yet</Text>
            <Text style={{ fontSize: 13, color: C.textMuted }}>Tap Record to start your first activity</Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
