import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

// Reduce point count for performance without losing visible shape
function simplify(pts: [number, number][], max = 120): [number, number][] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  return pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % Math.ceil(step) === 0);
}

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

interface Props {
  polyline?: string | null;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  bgColor?: string;
}

export function MiniRouteMap({
  polyline,
  height = 88,
  strokeColor = '#00BCD4',
  strokeWidth = 2.2,
  bgColor = 'transparent',
}: Props) {
  if (!polyline) return null;

  const raw = decode(polyline);
  if (raw.length < 2) return null;

  const pts = simplify(raw);

  const lats = pts.map(([lat]) => lat);
  const lngs = pts.map(([, lng]) => lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const PAD  = 10;
  const VW   = 320;   // reference viewBox width
  const VH   = height;

  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;

  // Fit to viewBox maintaining aspect ratio, centred
  const scale  = Math.min((VW - PAD * 2) / lngSpan, (VH - PAD * 2) / latSpan);
  const dw     = lngSpan * scale;
  const dh     = latSpan * scale;
  const ox     = PAD + (VW - PAD * 2 - dw) / 2;
  const oy     = PAD + (VH - PAD * 2 - dh) / 2;

  const svgPts = pts.map(([lat, lng]) => {
    const x = ox + (lng - minLng) * scale;
    const y = oy + (maxLat - lat) * scale; // invert Y
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View style={{ height, backgroundColor: bgColor, overflow: 'hidden', alignSelf: 'stretch' }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ flex: 1 }}
      >
        <Polyline
          points={svgPts}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}
