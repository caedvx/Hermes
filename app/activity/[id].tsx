import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity, ActivityStream, Comment } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDistance, formatDuration, formatDate,
  formatPace, formatElevation, formatSpeed,
  sportIoniconName, sportLabel, formatRelativeTime,
} from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';

const { width: W } = Dimensions.get('window');
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function decodePolyline(encoded: string): [number, number][] {
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <GlassCard variant={accent ? 'violet' : 'cyan'} style={{ flex: 1 }} padding={12}>
      <Text style={{ fontSize: 8, color: accent ? 'rgba(206,147,216,0.50)' : 'rgba(77,208,225,0.45)', textTransform: 'uppercase', letterSpacing: 0.09, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '500', color: accent ? '#CE93D8' : '#4DD0E1', letterSpacing: -0.5 }}>
        {value}
      </Text>
    </GlassCard>
  );
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [stream, setStream] = useState<ActivityStream | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudo, setHasKudo] = useState(false);
  const [privacy, setPrivacyState] = useState<'public' | 'followers_only' | 'private'>('public');
  const [loading, setLoading] = useState(true);
  const cameraRef = useRef<CameraRef>(null);
  const boundsRef = useRef<{ ne: [number,number]; sw: [number,number] } | null>(null);
  const C = useColors();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      // Fetch activity separately — no profile join to avoid RLS issues
      supabase.from('activities').select('*').eq('id', id).single(),
      // maybeSingle — stream may not exist for older activities
      supabase.from('activity_streams').select('*').eq('activity_id', id).maybeSingle(),
      supabase.from('comments').select('*, profiles(id,username,avatar_url)').eq('activity_id', id).order('created_at'),
      supabase.from('kudos').select('user_id').eq('activity_id', id),
    ]).then(([actRes, streamRes, commentsRes, kudosRes]) => {
      const act = (actRes.data as Activity) ?? null;
      setActivity(act);
      if (act?.status) setPrivacyState(act.status as 'public' | 'followers_only' | 'private');
      setStream((streamRes.data as ActivityStream) ?? null);
      setComments((commentsRes.data as Comment[]) ?? []);
      const kudos = (kudosRes.data as { user_id: string }[] | null) ?? [];
      setKudoCount(kudos.length);
      setHasKudo(kudos.some((k) => k.user_id === user?.id));
    }).finally(() => setLoading(false));
  }, [id, user]);

  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(() => {
      const b = boundsRef.current;
      if (!b) return;
      // v11 LngLatBounds = [west, south, east, north]
      cameraRef.current?.fitBounds(
        [b.sw[0], b.sw[1], b.ne[0], b.ne[1]],
        { padding: { top: 44, right: 44, bottom: 44, left: 44 }, duration: 0 },
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [activity?.id]);

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
      .select('*, profiles(id,username,avatar_url)')
      .single();
    if (data) setComments((prev) => [...prev, data as Comment]);
  }

  async function changePrivacy(next: 'public' | 'followers_only' | 'private') {
    if (!id) return;
    setPrivacyState(next);
    await supabase.from('activities').update({ status: next }).eq('id', id);
  }

  async function handleDelete() {
    if (!activity || activity.user_id !== user?.id) return;
    Alert.alert('Delete Activity', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('activities').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: '#030A0C' }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (!activity) {
    return (
      <View style={[styles.centered, { backgroundColor: '#030A0C' }]}>
        <View style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Ionicons name="alert-circle-outline" size={44} color="rgba(0,188,212,0.35)" />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500', marginTop: 12 }}>Activity not found</Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 }}>It may have been deleted or is private.</Text>
      </View>
    );
  }

  // ── Build polyline ───────────────────────────────────────────────────────
  const coords: [number, number][] = activity.map_polyline
    ? decodePolyline(activity.map_polyline).map(([lat, lng]) => [lng, lat])
    : (stream?.latlng?.map(([lat, lng]: number[]) => [lng, lat] as [number, number]) ?? []);

  const cameraNE = coords.length > 1 ? [Math.max(...coords.map(([lng]) => lng)), Math.max(...coords.map(([, lat]) => lat))] as [number, number] : null;
  const cameraSW = coords.length > 1 ? [Math.min(...coords.map(([lng]) => lng)), Math.min(...coords.map(([, lat]) => lat))] as [number, number] : null;
  if (cameraNE && cameraSW) boundsRef.current = { ne: cameraNE, sw: cameraSW };
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const isOwner = activity.user_id === user?.id;

  return (
    <View style={{ flex: 1, backgroundColor: '#030A0C' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Full-width map ─────────────────────────────────────────────── */}
        <View style={{ height: 320, backgroundColor: '#051015' }}>
          {coords.length > 1 && cameraNE && cameraSW ? (
            <MapLibreMap
              style={StyleSheet.absoluteFill}
              mapStyle={MAP_STYLE}
              attribution={false}
          >
              <Camera ref={cameraRef} />
              <GeoJSONSource
                id="route"
                data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }}
              >
                <Layer
                  id="routeLine"
                  type="line"
                  paint={{ 'line-color': '#00BCD4', 'line-width': 3 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                />
              </GeoJSONSource>
            </MapLibreMap>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.centered]}>
              <Ionicons name="map-outline" size={36} color="rgba(0,188,212,0.25)" />
              <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 12, marginTop: 8 }}>No route recorded</Text>
            </View>
          )}

          {/* Back button overlaid on map */}
          <View style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Delete button overlaid on map (owner only) */}
          {isOwner && (
            <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
              <TouchableOpacity onPress={handleDelete} style={[styles.backBtn, { backgroundColor: 'rgba(255,69,58,0.20)', borderColor: 'rgba(255,69,58,0.35)' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF453A" />
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom fade over map */}
          <View style={styles.mapFade} pointerEvents="none" />
        </View>

        {/* ── Activity header ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
          {/* Sport badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,188,212,0.30)', backgroundColor: 'rgba(0,188,212,0.10)' }}>
              <Ionicons name={sportIoniconName(activity.sport_type) as never} size={11} color="#4DD0E1" />
              <Text style={{ color: '#4DD0E1', fontSize: 11, fontWeight: '500' }}>{sportLabel(activity.sport_type)}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>{formatDate(activity.start_at)}</Text>
          </View>

          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '500', letterSpacing: -0.4, marginBottom: 4 }}>
            {activity.title}
          </Text>
          {activity.description ? (
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18, marginTop: 4 }}>
              {activity.description}
            </Text>
          ) : null}
        </View>

        {/* ── Primary stats row ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
          <StatTile label="Distance" value={formatDistance(activity.distance)} />
          <StatTile label="Duration" value={formatDuration(activity.elapsed_time)} />
          <StatTile label="Elevation" value={formatElevation(activity.elevation_gain)} accent />
        </View>

        {/* ── Secondary stats row ────────────────────────────────────────── */}
        {(activity.avg_speed || activity.max_speed) && (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
            {activity.avg_speed && (
              <StatTile label="Avg Pace" value={formatPace(activity.avg_speed, activity.sport_type)} />
            )}
            {activity.avg_speed && (
              <StatTile label="Avg Speed" value={formatSpeed(activity.avg_speed)} />
            )}
            {activity.max_speed && (
              <StatTile label="Max Speed" value={formatSpeed(activity.max_speed)} />
            )}
          </View>
        )}

        {/* ── Privacy picker (owner only) ────────────────────────────────── */}
        {isOwner && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 9, color: 'rgba(0,188,212,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '500', marginBottom: 10 }}>
              Visibility
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { value: 'public',         label: 'Public',    icon: 'globe-outline' },
                { value: 'followers_only', label: 'Followers', icon: 'people-outline' },
                { value: 'private',        label: 'Private',   icon: 'lock-closed-outline' },
              ] as const).map(({ value, label, icon }) => {
                const active = privacy === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => changePrivacy(value)}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 5, paddingVertical: 9, borderRadius: 50, borderWidth: 1,
                      borderColor: active ? 'rgba(0,188,212,0.55)' : 'rgba(0,188,212,0.18)',
                      backgroundColor: active ? 'rgba(0,188,212,0.18)' : 'rgba(0,188,212,0.05)',
                    }}
                  >
                    <Ionicons name={icon as never} size={13} color={active ? '#4DD0E1' : 'rgba(255,255,255,0.30)'} />
                    <Text style={{ fontSize: 11, fontWeight: active ? '500' : '400', color: active ? '#4DD0E1' : 'rgba(255,255,255,0.30)' }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Kudo ───────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={toggleKudo}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 18,
              borderRadius: 50, borderWidth: 1,
              borderColor: hasKudo ? '#00BCD4' : 'rgba(0,188,212,0.25)',
              backgroundColor: hasKudo ? '#00BCD4' : 'rgba(0,188,212,0.08)',
            }}
          >
            <Ionicons
              name={hasKudo ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={hasKudo ? '#030A0C' : 'rgba(255,255,255,0.45)'}
            />
            <Text style={{ fontSize: 13, fontWeight: '500', color: hasKudo ? '#030A0C' : 'rgba(255,255,255,0.45)' }}>
              {kudoCount > 0 ? `${kudoCount} Kudo${kudoCount !== 1 ? 's' : ''}` : 'Give Kudo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Comments ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 9, color: 'rgba(0,188,212,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '500', marginBottom: 12 }}>
            Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
          </Text>

          {comments.length > 0 && (
            <GlassCard padding={0} style={{ marginBottom: 10 }}>
              {comments.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(0,188,212,0.10)' }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,188,212,0.10)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.22)', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#4DD0E1', fontSize: 11, fontWeight: '500' }}>
                      {(c.profiles?.username?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)', marginBottom: 3 }}>
                      {c.profiles?.username ?? 'Unknown'}
                    </Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>{c.content}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>
                      {formatRelativeTime(c.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}

          <TouchableOpacity
            onPress={() => Alert.prompt('Add a comment', '', (text) => { if (text) submitComment(text); })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(0,188,212,0.20)', backgroundColor: 'rgba(0,188,212,0.06)' }}
          >
            <Ionicons name="chatbubble-outline" size={14} color="rgba(0,188,212,0.45)" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>Add a comment…</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(3,10,12,0.65)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 60,
    backgroundColor: '#030A0C',
    opacity: 0.6,
  },
});
