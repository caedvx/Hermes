import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, formatDate, formatPace, sportIoniconName, sportLabel } from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';
import { MiniMapView } from '@/components/MiniMapView';
import { AuroraBackground } from '@/components/AuroraBackground';

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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#030A0C' }}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.10)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(0,188,212,0.45)', letterSpacing: 0.12, textTransform: 'uppercase', marginBottom: 4 }}>
            YOUR TRAINING
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '500', color: '#fff', letterSpacing: -0.5 }}>Activities</Text>
            <Text style={{ fontSize: 12, color: C.primary, fontWeight: '500' }}>{activities.length}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 120, flexGrow: 1 }}
        >
          {activities.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 }}>
              <Ionicons name="flash-outline" size={44} color="rgba(0,188,212,0.25)" />
              <Text style={{ fontSize: 17, fontWeight: '500', color: '#fff' }}>No activities yet</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', textAlign: 'center' }}>
                Tap Record to start your first workout
              </Text>
            </View>
          ) : (
            activities.map((item) => {
              const daysAgo = (() => {
                const d = new Date(item.start_at);
                const n = new Date();
                const diff = Math.floor((n.getTime() - d.getTime()) / 86400000);
                if (diff === 0) return 'TODAY';
                if (diff === 1) return 'YESTERDAY';
                return formatDate(item.start_at).toUpperCase();
              })();

              return (
                <TouchableOpacity key={item.id} onPress={() => router.push(`/activity/${item.id}`)} activeOpacity={0.88}>
                  <GlassCard padding={14}>
                    {/* Sport | Distance | Date — one row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ flex: 1, fontSize: 12, color: 'rgba(77,208,225,0.55)', fontWeight: '400' }}>
                        {sportLabel(item.sport_type)}
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: '500', color: '#ffffff', letterSpacing: -0.5 }}>
                        {formatDistance(item.distance)}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 12, color: 'rgba(77,208,225,0.55)', fontWeight: '400', textAlign: 'right' }}>
                        {daysAgo}
                      </Text>
                    </View>

                    {/* Mini map with real tiles */}
                    {item.map_polyline ? (
                      <View style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden' }}>
                        <MiniMapView
                          polyline={item.map_polyline}
                          uid={item.id}
                          height={200}
                          routeColor="#00BCD4"
                          routeWidth={3}
                        />
                      </View>
                    ) : null}

                    {/* Sub-metrics */}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      {item.avg_speed ? (
                        <MiniStat label="Pace" value={formatPace(item.avg_speed, item.sport_type)} color="#4DD0E1" labelColor="rgba(77,208,225,0.4)" />
                      ) : null}
                      <MiniStat label="Time" value={formatDuration(item.elapsed_time)} color="#4DD0E1" labelColor="rgba(77,208,225,0.4)" />
                      {item.elevation_gain != null && (
                        <MiniStat label="Elev" value={`+${Math.round(item.elevation_gain)}m`} color="#CE93D8" labelColor="rgba(206,147,216,0.55)" />
                      )}
                      {item.title ? (
                        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', fontWeight: '400' }} numberOfLines={1}>{item.title}</Text>
                        </View>
                      ) : null}
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MiniStat({ label, value, color, labelColor }: { label: string; value: string; color: string; labelColor: string }) {
  return (
    <View>
      <Text style={{ fontSize: 8, color: labelColor, letterSpacing: 0.09, textTransform: 'uppercase', marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, color, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
