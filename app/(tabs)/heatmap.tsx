import { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/theme';
import { decodePolyline } from '@/lib/geo';
import type { Colors } from '@/constants/colors';

type Mode = 'heatmap' | 'routes';

type Route = { latitude: number; longitude: number }[];

export default function HeatmapScreen() {
  const { user } = useAuth();
  const C = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('heatmap');

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: activities } = await supabase
        .from('activities')
        .select('id, map_polyline')
        .eq('user_id', user!.id)
        .order('start_at', { ascending: false })
        .limit(150);

      if (!activities?.length) { setLoading(false); return; }

      const ids = activities.map((a) => a.id);
      const { data: streams } = await supabase
        .from('activity_streams')
        .select('latlng, activity_id')
        .in('activity_id', ids);

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

      setRoutes(loaded);

      if (loaded.length) {
        const all = loaded.flat();
        const lats = all.map((p) => p.latitude);
        const lngs = all.map((p) => p.longitude);
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        setTimeout(() => {
          cameraRef.current?.fitBounds(ne, sw, [40, 40, 40, 40], 0);
        }, 300);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Heatmap</Text>
        <Text style={styles.subtitle}>{routes.length} activit{routes.length !== 1 ? 'ies' : 'y'}</Text>
      </View>

      <View style={styles.mapWrapper}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : routes.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="flame-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyText}>No activities yet</Text>
            <Text style={styles.emptySubtext}>Upload workouts to see your heatmap</Text>
          </View>
        ) : (
          <>
            <MapLibreGL.MapView
              style={StyleSheet.absoluteFill}
              styleURL={isDark
                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'}
              logoEnabled={false}
              attributionEnabled={false}
            >
              <MapLibreGL.Camera ref={cameraRef} zoomLevel={10} />
              <MapLibreGL.ShapeSource
                id="routes"
                shape={{
                  type: 'FeatureCollection',
                  features: routes.map((coords, i) => ({
                    type: 'Feature' as const,
                    id: String(i),
                    geometry: {
                      type: 'LineString' as const,
                      coordinates: coords.map((p) => [p.longitude, p.latitude]),
                    },
                    properties: {},
                  })),
                }}
              >
                <MapLibreGL.LineLayer
                  id="routeLines"
                  style={{
                    lineColor: mode === 'heatmap' ? 'rgba(252,76,2,0.45)' : 'rgba(37,99,235,0.75)',
                    lineWidth: mode === 'heatmap' ? 3 : 2,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapLibreGL.ShapeSource>
            </MapLibreGL.MapView>

            <TouchableOpacity style={styles.toggleButton} onPress={() => setMode(mode === 'heatmap' ? 'routes' : 'heatmap')}>
              <Ionicons name="layers-outline" size={16} color={C.text} style={{ marginRight: 6 }} />
              <Text style={styles.toggleText}>{mode === 'heatmap' ? 'Show Routes' : 'Show Heatmap'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },
    title: { fontSize: 22, fontWeight: '800', color: C.text },
    subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
    mapWrapper: {
      flex: 1,
      marginHorizontal: 12,
      marginBottom: 12,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: C.surfaceAlt,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    emptyText: { fontSize: 17, fontWeight: '600', color: C.text, marginTop: 8 },
    emptySubtext: { fontSize: 14, color: C.textMuted },
    toggleButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surfaceOverlay,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    toggleText: { fontSize: 13, fontWeight: '600', color: C.text },
  });
}
