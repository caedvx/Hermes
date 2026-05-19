import { useRef, useMemo, useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';

const { width: W } = Dimensions.get('window');
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function decode(encoded: string): [number, number][] {
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, shift = 0, r = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += r & 1 ? ~(r >> 1) : r >> 1;
    shift = 0; r = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += r & 1 ? ~(r >> 1) : r >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

function simplify(pts: [number, number][], max: number): [number, number][] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  return pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % step === 0);
}

interface Props {
  polyline?: string | null;
  uid: string;
  height?: number;
  routeColor?: string;
  routeWidth?: number;
}

export function MiniMapView({ polyline, uid, height = 90, routeColor = '#00BCD4', routeWidth = 3 }: Props) {
  const cameraRef = useRef<CameraRef>(null);

  const geo = useMemo(() => {
    if (!polyline) return null;
    const raw = decode(polyline);
    if (raw.length < 2) return null;
    const pts    = simplify(raw, 80);
    const coords = pts.map(([lat, lng]) => [lng, lat] as [number, number]);
    const lngs   = coords.map(([lng]) => lng);
    const lats   = coords.map(([, lat]) => lat);
    // v11 LngLatBounds = [west, south, east, north]
    const bounds: [number, number, number, number] = [
      Math.min(...lngs), Math.min(...lats),
      Math.max(...lngs), Math.max(...lats),
    ];
    return { coords, bounds };
  }, [polyline]);

  useEffect(() => {
    if (!geo) return;
    // Give the map ~500ms to load tiles then fit the route
    const t = setTimeout(() => {
      cameraRef.current?.fitBounds(geo.bounds, {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        duration: 0,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [geo]);

  if (!geo) return <View style={{ height, backgroundColor: '#051015' }} />;

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={DARK}
        attribution={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        logoEnabled={false}
      >
        <Camera ref={cameraRef} />
        <GeoJSONSource
          id={`ms-${uid}`}
          data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: geo.coords }, properties: {} }}
        >
          <Layer
            id={`ml-${uid}`}
            type="line"
            paint={{ 'line-color': routeColor, 'line-width': routeWidth }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>
      </MapLibreMap>
    </View>
  );
}
