import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, formatDate, sportIoniconName, sportLabel } from '@/lib/utils';

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fetchActivities = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('start_at', { ascending: false });
    setActivities((data as Activity[]) ?? []);
  }, [user]);

  useEffect(() => {
    fetchActivities().finally(() => setLoading(false));
  }, [fetchActivities]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchActivities();
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
        <Text style={styles.headerTitle}>My Activities</Text>
        <Text style={styles.headerCount}>{activities.length} total</Text>
      </View>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/activity/${item.id}`)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name={sportIoniconName(item.sport_type) as never} size={26} color={C.textSecondary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowDate}>{formatDate(item.start_at)}</Text>
              <View style={styles.rowStats}>
                <View style={styles.rowStatItem}>
                  <Ionicons name="resize-outline" size={12} color={C.textMuted} />
                  <Text style={styles.rowStat}>{formatDistance(item.distance)}</Text>
                </View>
                <View style={styles.rowStatItem}>
                  <Ionicons name="time-outline" size={12} color={C.textMuted} />
                  <Text style={styles.rowStat}>{formatDuration(item.elapsed_time)}</Text>
                </View>
                {item.elevation_gain != null && (
                  <View style={styles.rowStatItem}>
                    <Ionicons name="trending-up-outline" size={12} color={C.textMuted} />
                    <Text style={styles.rowStat}>{Math.round(item.elevation_gain)}m</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={64} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptySubtitle}>Tap Record to start your first activity</Text>
          </View>
        }
        contentContainerStyle={activities.length === 0 && styles.emptyContainer}
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
    },
    headerCount: {
      fontSize: 13,
      color: C.textMuted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLeft: {
      marginRight: 14,
      width: 28,
      alignItems: 'center',
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 2,
    },
    rowDate: {
      fontSize: 12,
      color: C.textMuted,
      marginBottom: 6,
    },
    rowStats: {
      flexDirection: 'row',
      gap: 10,
    },
    rowStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    rowStat: {
      fontSize: 13,
      color: C.textSecondary,
      fontWeight: '500',
    },
    rowRight: {
      paddingLeft: 8,
    },
    chevron: {
      fontSize: 24,
      color: C.textMuted,
    },
    separator: {
      height: 1,
      backgroundColor: C.border,
      marginLeft: 72,
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
