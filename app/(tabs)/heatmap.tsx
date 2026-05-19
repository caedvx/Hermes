import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/theme';
import { decodePolyline } from '@/lib/geo';

type Mode = 'heatmap' | 'routes';
type Route = { latitude: number; longitude: number }[];

export default function HeatmapScreen() {
  const { user } = useAuth();
  const C = useColors();
  const { isDark } = useTheme();
  const cameraRef = useRef<CameraRef>(null);
  const boundsRef = useRef<{ ne: [number,number]; sw: [number,number] } | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('heatmap');

  // Fit camera to all routes once data + map are ready
  useEffect(() => {
    const b = boundsRef.current;
    if (!b || routes.length === 0) return;
    const timer = setTimeout(() => {
      // v11 fitBounds: [west, south, east, north]
      cameraRef.current?.fitBounds(
        [b.sw[0], b.sw[1], b.ne[0], b.ne[1]],
        { padding: { top: 90, right: 90, bottom: 90, left: 90 }, duration: 0 },
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [routes.length]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: activities } = await supabase.from('activities').select('id, map_polyline').eq('user_id', user!.id).order('start_at', { ascending: false }).limit(150);
      if (!activities?.length) { setLoading(false); return; }
      const ids = activities.map((a) => a.id);
      const { data: streams } = await supabase.from('activity_streams').select('latlng, activity_id').in('activity_id', ids);
      const loaded: Route[] = [];
      if (streams?.length) {
        for (const s of streams) {
          const latlng = s.latlng as number[][] | null;
          if (!Array.isArray(latlng) || latlng.length < 2) continue;
          loaded.push(latlng.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
        }
      } else {
        for (const a of activities) {
          if (!a.map_polyline) continue;
          const pts = decodePolyline(a.map_polyline);
          if (pts.length < 2) continue;
          loaded.push(pts.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
        }
      }
      if (loaded.length) {
        const all = loaded.flat();
        const lats = all.map((p) => p.latitude);
        const lngs = all.map((p) => p.longitude);
        boundsRef.current = {
          ne: [Math.max(...lngs), Math.max(...lats)],
          sw: [Math.min(...lngs), Math.min(...lats)],
        };
      }
      setRoutes(loaded);
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '500', color: C.text, letterSpacing: -0.3 }}>My Heatmap</Text>
          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{routes.length} activit{routes.length !== 1 ? 'ies' : 'y'}</Text>
        </View>
        {routes.length > 0 && (
          <TouchableOpacity
            onPress={() => setMode(mode === 'heatmap' ? 'routes' : 'heatmap')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(0,188,212,0.28)', backgroundColor: 'rgba(0,188,212,0.08)' }}
          >
            <Ionicons name="layers-outline" size={14} color={C.primary} />
            <Text style={{ color: C.primary, fontSize: 12, fontWeight: '500' }}>
              {mode === 'heatmap' ? 'Routes' : 'Heatmap'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map area */}
      <View style={{ flex: 1, margin: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#071920', borderWidth: 1, borderColor: 'rgba(0,188,212,0.15)' }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : routes.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <Ionicons name="flame-outline" size={44} color={C.textMuted} />
            <Text style={{ fontSize: 16, fontWeight: '500', color: C.text }}>No activities yet</Text>
            <Text style={{ fontSize: 13, color: C.textMuted }}>Record workouts to build your heatmap</Text>
          </View>
        ) : (
          <MapLibreMap
            style={StyleSheet.absoluteFill}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attribution={false}
          >
            <Camera ref={cameraRef} />
            <GeoJSONSource
              id="routes"
              data={{
                type: 'FeatureCollection',
                features: routes.map((coords, i) => ({
                  type: 'Feature' as const,
                  id: String(i),
                  geometry: { type: 'LineString' as const, coordinates: coords.map((p) => [p.longitude, p.latitude]) },
                  properties: {},
                })),
              }}
            >
              <Layer
                id="routeLines"
                type="line"
                paint={{
                  'line-color': mode === 'heatmap' ? 'rgba(252,76,2,0.55)' : 'rgba(0,188,212,0.80)',
                  'line-width': mode === 'heatmap' ? 3 : 2,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </GeoJSONSource>
          </MapLibreMap>
        )}
      </View>
    </SafeAreaView>
  );
}
