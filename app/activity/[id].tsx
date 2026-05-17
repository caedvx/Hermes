import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity, ActivityStream, Comment, Profile } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDistance, formatDuration, formatDate, formatPace,
  formatElevation, formatSpeed, sportIoniconName, sportLabel, formatRelativeTime,
} from '@/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [stream, setStream] = useState<ActivityStream | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudo, setHasKudo] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('activities').select('*, profiles(*)').eq('id', id).single(),
      supabase.from('activity_streams').select('*').eq('activity_id', id).single(),
      supabase.from('comments').select('*, profiles(*)').eq('activity_id', id).order('created_at'),
      supabase.from('kudos').select('user_id').eq('activity_id', id),
    ]).then(([actRes, streamRes, commentsRes, kudosRes]) => {
      setActivity((actRes.data as Activity) ?? null);
      setStream((streamRes.data as ActivityStream) ?? null);
      setComments((commentsRes.data as Comment[]) ?? []);
      const kudos = (kudosRes.data as { user_id: string }[] | null) ?? [];
      setKudoCount(kudos.length);
      setHasKudo(kudos.some((k) => k.user_id === user?.id));
    }).finally(() => setLoading(false));
  }, [id, user]);

  async function toggleKudo() {
    if (!user || !id) return;
    if (hasKudo) {
      await supabase.from('kudos').delete().eq('activity_id', id).eq('user_id', user.id);
      setHasKudo(false);
      setKudoCount((c) => c - 1);
    } else {
      await supabase.from('kudos').insert([{ activity_id: id, user_id: user.id }] as never[]);
      setHasKudo(true);
      setKudoCount((c) => c + 1);
    }
  }

  async function submitComment() {
    if (!user || !id || !newComment.trim()) return;
    const { data } = await supabase
      .from('comments')
      .insert([{ activity_id: id, user_id: user.id, content: newComment.trim() }] as never[])
      .select('*, profiles(*)')
      .single();
    if (data) {
      setComments((prev) => [...prev, data as Comment]);
      setNewComment('');
    }
  }

  async function handleDelete() {
    if (!activity || activity.user_id !== user?.id) return;
    Alert.alert('Delete Activity', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('activities').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Activity not found</Text>
      </View>
    );
  }

  const polylineCoords = activity.map_polyline
    ? decodePolyline(activity.map_polyline).map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
    : (stream?.latlng?.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) ?? []);

  const mapRegion = polylineCoords.length > 0 ? {
    latitude: (Math.max(...polylineCoords.map((c) => c.latitude)) + Math.min(...polylineCoords.map((c) => c.latitude))) / 2,
    longitude: (Math.max(...polylineCoords.map((c) => c.longitude)) + Math.min(...polylineCoords.map((c) => c.longitude))) / 2,
    latitudeDelta: Math.max(Math.max(...polylineCoords.map((c) => c.latitude)) - Math.min(...polylineCoords.map((c) => c.latitude)), 0.01) * 1.3,
    longitudeDelta: Math.max(Math.max(...polylineCoords.map((c) => c.longitude)) - Math.min(...polylineCoords.map((c) => c.longitude)), 0.01) * 1.3,
  } : undefined;

  const isOwner = activity.user_id === user?.id;

  return (
    <SafeAreaView style={styles.container} edges={['bottom'] as const}>
      <ScrollView>
        {polylineCoords.length > 0 && mapRegion && (
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            region={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Polyline
              coordinates={polylineCoords}
              strokeColor={C.primary}
              strokeWidth={3}
            />
          </MapView>
        )}

        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name={sportIoniconName(activity.sport_type) as never} size={14} color={C.textMuted} />
              <Text style={styles.sportBadge}>{sportLabel(activity.sport_type)}</Text>
            </View>
            {isOwner && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.date}>{formatDate(activity.start_at)}</Text>
          {activity.description && (
            <Text style={styles.description}>{activity.description}</Text>
          )}
        </View>

        <View style={styles.statsSection}>
          <StatRow
            items={[
              { label: 'Distance', value: formatDistance(activity.distance) },
              { label: 'Duration', value: formatDuration(activity.elapsed_time) },
              { label: 'Elevation', value: formatElevation(activity.elevation_gain) },
            ]}
          />
          <View style={styles.divider} />
          <StatRow
            items={[
              { label: 'Avg Pace', value: activity.avg_speed ? formatPace(activity.avg_speed, activity.sport_type) : '--' },
              { label: 'Avg Speed', value: activity.avg_speed ? formatSpeed(activity.avg_speed) : '--' },
              { label: 'Max Speed', value: activity.max_speed ? formatSpeed(activity.max_speed) : '--' },
            ]}
          />
          {(activity.avg_heart_rate || activity.avg_cadence || activity.calories) && (
            <>
              <View style={styles.divider} />
              <StatRow
                items={[
                  { label: 'Avg HR', value: activity.avg_heart_rate ? `${activity.avg_heart_rate} bpm` : '--' },
                  { label: 'Avg Cadence', value: activity.avg_cadence ? `${activity.avg_cadence} rpm` : '--' },
                  { label: 'Calories', value: activity.calories ? `${activity.calories} kcal` : '--' },
                ]}
              />
            </>
          )}
        </View>

        <View style={styles.socialSection}>
          <TouchableOpacity style={styles.kudoButton} onPress={toggleKudo}>
            <Ionicons
              name={hasKudo ? 'thumbs-up' : 'thumbs-up-outline'}
              size={18}
              color={hasKudo ? C.primary : C.textSecondary}
            />
            <Text style={[styles.kudoText, hasKudo && styles.kudoTextActive]}>
              {kudoCount > 0 ? `${kudoCount} Kudo${kudoCount !== 1 ? 's' : ''}` : 'Give Kudo'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {(c.profiles?.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.commentAuthor}>{c.profiles?.username ?? 'Unknown'}</Text>
                <Text style={styles.commentContent}>{c.content}</Text>
                <Text style={styles.commentTime}>{formatRelativeTime(c.created_at)}</Text>
              </View>
            </View>
          ))}

          <View style={styles.commentInput}>
            <View style={styles.commentAvatar}>
              <Text style={styles.commentAvatarText}>
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={styles.commentInputField}>
              <Text
                style={styles.commentPlaceholder}
                onPress={() => Alert.prompt('Add a comment', '', (text) => {
                  if (text) {
                    setNewComment(text);
                    submitComment();
                  }
                })}
              >
                {newComment || 'Add a comment…'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ items }: { items: { label: string; value: string }[] }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 }}>{item.value}</Text>
          <Text style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '600' }}>{item.label}</Text>
        </View>
      ))}
    </View>
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
    errorText: {
      fontSize: 16,
      color: C.textMuted,
    },
    map: {
      width: SCREEN_WIDTH,
      height: 240,
    },
    headerSection: {
      backgroundColor: C.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sportBadge: {
      fontSize: 13,
      fontWeight: '600',
      color: C.primary,
      backgroundColor: C.primaryTint,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    deleteText: {
      color: C.danger,
      fontSize: 14,
      fontWeight: '600',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: C.text,
      marginBottom: 4,
    },
    date: {
      fontSize: 13,
      color: C.textMuted,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 20,
    },
    statsSection: {
      backgroundColor: C.surface,
      marginTop: 8,
      paddingVertical: 8,
    },
    divider: {
      height: 1,
      backgroundColor: C.border,
      marginHorizontal: 16,
    },
    socialSection: {
      backgroundColor: C.surface,
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    kudoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: C.background,
      borderWidth: 1,
      borderColor: C.border,
    },
    kudoText: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textSecondary,
    },
    kudoTextActive: {
      color: C.primary,
    },
    commentsSection: {
      backgroundColor: C.surface,
      marginTop: 8,
      padding: 16,
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 16,
    },
    commentRow: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 12,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentAvatarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    commentBody: {
      flex: 1,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
      marginBottom: 2,
    },
    commentContent: {
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 20,
    },
    commentTime: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 4,
    },
    commentInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    commentInputField: {
      flex: 1,
      backgroundColor: C.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    commentPlaceholder: {
      fontSize: 14,
      color: C.textMuted,
    },
  });
}
