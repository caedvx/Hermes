import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@/lib/types';
import { formatDistance, formatDuration, formatDate, formatPace, sportIoniconName, sportLabel } from '@/lib/utils';
import { MiniMapView } from './MiniMapView';

interface Props {
  activity: Activity;
}

function relDate(start_at: string): string {
  const days = Math.floor((Date.now() - new Date(start_at).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(start_at);
}

export function FeedCard({ activity }: Props) {
  const router = useRouter();
  const profile = activity.profiles;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${activity.id}`)}
      activeOpacity={0.88}
    >
      {/* Top rim specular */}
      <View style={styles.topRim} />

      {/* Author row — profile picture prominent at top-left */}
      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>
              {(profile?.username?.[0] ?? '?').toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.username} numberOfLines={1}>
            {profile?.full_name ?? profile?.username ?? 'Athlete'}
          </Text>
        </View>
      </View>

      {/* Sport | Distance | Date — all on one row, vertically level */}
      <View style={styles.statsHeader}>
        <Text style={styles.sportLabel}>{sportLabel(activity.sport_type)}</Text>
        <Text style={styles.distanceCorner}>{formatDistance(activity.distance)}</Text>
        <Text style={styles.dateLabel}>{relDate(activity.start_at)}</Text>
      </View>

      {/* Mini map with real tiles */}
      {activity.map_polyline ? (
        <View style={styles.mapWrap}>
          <MiniMapView
            polyline={activity.map_polyline}
            uid={activity.id}
            height={200}
            routeColor="rgba(255,255,255,0.90)"
            routeWidth={2.5}
          />
        </View>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Secondary metrics — greyscale */}
      <View style={styles.metricsRow}>
        {activity.avg_speed ? (
          <Metric label="Pace" value={formatPace(activity.avg_speed, activity.sport_type)} />
        ) : null}
        <Metric label="Time" value={formatDuration(activity.elapsed_time)} />
        {activity.elevation_gain != null && (
          <Metric label="Elev" value={`+${Math.round(activity.elevation_gain)}m`} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(14,16,20,0.97)',
    padding: 16,
    overflow: 'hidden',
  },
  topRim: {
    position: 'absolute',
    top: 0, left: 12, right: 12, height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
  },
  avatarInitial: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    fontWeight: '500',
  },
  username: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sportLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '400',
  },
  distanceCorner: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  dateLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'right',
  },
  mapWrap: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    // no negative margins — SVG width="100%" needs a clean parent
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.09,
    marginBottom: 2,
  },
  metricValue: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
  },
});
