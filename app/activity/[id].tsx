import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity, ActivityStream, Comment } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/theme';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDistance, formatDuration, formatDate, formatPace,
  formatElevation, formatSpeed, sportIoniconName, sportLabel, formatRelativeTime,
} from '@/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { isDark } = useTheme();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [stream, setStream] = useState<ActivityStream | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudo, setHasKudo] = useState(false);
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
      setHasKudo(false); setKudoCount((c) => c - 1);
    } else {
      await supabase.from('kudos').insert([{ activity_id: id, user_id: user.id }] as never[]);
      setHasKudo(true); setKudoCount((c) => c + 1);
    }
  }

  async function submitComment(text: string) {
    if (!user || !id || !text.trim()) return;
    const { data } = await supabase
      .from('comments')
      .insert([{ activity_id: id, user_id: user.id, content: text.trim() }] as never[])
      .select('*, profiles(*)')
      .single();
    if (data) setComments((prev) => [...prev, data as Comment]);
  }

  async function handleDelete() {
    if (!activity || activity.user_id !== user?.id) return;
    Alert.alert('Delete Activity', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('activities').delete().eq('id', id);
        router.back();
      }},
    ]);
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>;
  }
  if (!activity) {
    return <View style={styles.centered}><Text style={styles.errorText}>Activity not found</Text></View>;
  }

  const polylineCoords: [number, number][] = activity.map_polyline
    ? decodePolyline(activity.map_polyline).map(([lat, lng]) => [lng, lat])
    : (stream?.latlng?.map(([lat, lng]) => [lng, lat]) ?? []);

  const cameraBounds: [number, number, number, number] | undefined = polylineCoords.length > 0 ? (() => {
    const lngs = polylineCoords.map(([lng]) => lng);
    const lats = polylineCoords.map(([, lat]) => lat);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  })() : undefined;

  const mapStyle = isDark
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  const isOwner = activity.user_id === user?.id;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {polylineCoords.length > 0 && cameraBounds && (
          <MapLibreMap style={styles.map} mapStyle={mapStyle} attribution={false}>
            <Camera bounds={cameraBounds} />
            <GeoJSONSource
              id="route"
              data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: polylineCoords }, properties: {} }}
            >
              <Layer
                id="routeLine"
                type="line"
                paint={{ 'line-color': C.primary, 'line-width': 3 }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </GeoJSONSource>
          </MapLibreMap>
        )}

        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={styles.sportBadge}>
              <Ionicons name={sportIoniconName(activity.sport_type) as never} size={12} color={C.primary} />
              <Text style={styles.sportBadgeText}>{sportLabel(activity.sport_type)}</Text>
            </View>
            {isOwner && (
              <TouchableOpacity onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.date}>{formatDate(activity.start_at)}</Text>
          {activity.description && <Text style={styles.description}>{activity.description}</Text>}
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <StatRow items={[
            { label: 'Distance', value: formatDistance(activity.distance) },
            { label: 'Duration', value: formatDuration(activity.elapsed_time) },
            { label: 'Elevation', value: formatElevation(activity.elevation_gain), accent: true },
          ]} />
          <View style={styles.divider} />
          <StatRow items={[
            { label: 'Avg Pace', value: activity.avg_speed ? formatPace(activity.avg_speed, activity.sport_type) : '--' },
            { label: 'Avg Speed', value: activity.avg_speed ? formatSpeed(activity.avg_speed) : '--' },
            { label: 'Max Speed', value: activity.max_speed ? formatSpeed(activity.max_speed) : '--' },
          ]} />
          {(activity.avg_heart_rate || activity.avg_cadence || activity.calories) && (
            <>
              <View style={styles.divider} />
              <StatRow items={[
                { label: 'Avg HR', value: activity.avg_heart_rate ? `${activity.avg_heart_rate} bpm` : '--' },
                { label: 'Cadence', value: activity.avg_cadence ? `${activity.avg_cadence} rpm` : '--' },
                { label: 'Calories', value: activity.calories ? `${activity.calories} kcal` : '--' },
              ]} />
            </>
          )}
        </View>

        {/* Kudo */}
        <View style={styles.socialSection}>
          <TouchableOpacity style={[styles.kudoButton, hasKudo && styles.kudoButtonActive]} onPress={toggleKudo}>
            <Ionicons
              name={hasKudo ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={hasKudo ? C.background : C.textMuted}
            />
            <Text style={[styles.kudoText, hasKudo && styles.kudoTextActive]}>
              {kudoCount > 0 ? `${kudoCount} Kudo${kudoCount !== 1 ? 's' : ''}` : 'Give Kudo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments */}
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
          <TouchableOpacity
            style={styles.addCommentButton}
            onPress={() => Alert.prompt('Add a comment', '', (text) => { if (text) submitComment(text); })}
          >
            <Ionicons name="chatbubble-outline" size={14} color={C.textMuted} />
            <Text style={styles.addCommentText}>Add a comment…</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ items }: { items: { label: string; value: string; accent?: boolean }[] }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{
            fontSize: 18, fontWeight: '500',
            color: item.accent ? C.secondary : C.primary,
            marginBottom: 3, letterSpacing: -0.5,
          }}>{item.value}</Text>
          <Text style={{
            fontSize: 10, color: C.textMuted,
            textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '400',
          }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
    errorText: { fontSize: 15, color: C.textMuted },
    map: { width: SCREEN_WIDTH, height: 240 },
    headerSection: {
      backgroundColor: C.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTop: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
    },
    sportBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.primaryTint, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 20, borderWidth: 1, borderColor: C.border,
    },
    sportBadgeText: { fontSize: 12, fontWeight: '500', color: C.primary },
    deleteText: { color: C.danger, fontSize: 13, fontWeight: '500' },
    title: { fontSize: 20, fontWeight: '500', color: C.text, marginBottom: 4, letterSpacing: -0.3 },
    date: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
    description: { fontSize: 14, color: C.textSecondary, lineHeight: 20 },
    statsSection: {
      backgroundColor: C.surface, marginTop: 8, paddingVertical: 4,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
    },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
    socialSection: {
      backgroundColor: C.surface, marginTop: 8, padding: 16,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
    },
    kudoButton: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingVertical: 9, paddingHorizontal: 16, borderRadius: 50,
      backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
      alignSelf: 'flex-start',
    },
    kudoButtonActive: { backgroundColor: C.primary, borderColor: C.primary },
    kudoText: { fontSize: 13, fontWeight: '500', color: C.textMuted },
    kudoTextActive: { color: C.background },
    commentsSection: {
      backgroundColor: C.surface, marginTop: 8, padding: 16,
      borderTopWidth: 1, borderColor: C.border,
    },
    sectionTitle: { fontSize: 10, fontWeight: '500', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
    commentRow: { flexDirection: 'row', marginBottom: 16, gap: 12 },
    commentAvatar: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: C.primaryTint, borderWidth: 1, borderColor: C.border,
      justifyContent: 'center', alignItems: 'center',
    },
    commentAvatarText: { color: C.primary, fontWeight: '500', fontSize: 13 },
    commentBody: { flex: 1 },
    commentAuthor: { fontSize: 13, fontWeight: '500', color: C.text, marginBottom: 2 },
    commentContent: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
    commentTime: { fontSize: 10, color: C.textMuted, marginTop: 3 },
    addCommentButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 50,
      borderWidth: 1, borderColor: C.border, marginTop: 4,
    },
    addCommentText: { fontSize: 13, color: C.textMuted },
  });
}
