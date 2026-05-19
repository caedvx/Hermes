import { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { GlassCard } from './GlassCard';
import { MiniMapView } from './MiniMapView';
import { formatDistance, formatDuration, formatDate, formatPace, sportIoniconName, sportLabel } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';

interface Props {
  activity: Activity;
  showAuthor?: boolean;
}

function relDate(start_at: string): string {
  const days = Math.floor((Date.now() - new Date(start_at).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(start_at);
}

export function ActivityCard({ activity, showAuthor = true }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudo, setHasKudo] = useState(false);
  const C = useColors();

  async function toggleKudo() {
    if (!user) return;
    if (hasKudo) {
      await supabase.from('kudos').delete().eq('activity_id', activity.id).eq('user_id', user.id);
      setHasKudo(false);
      setKudoCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('kudos').insert([{ activity_id: activity.id, user_id: user.id }] as never[]);
      setHasKudo(true);
      setKudoCount((c) => c + 1);
    }
  }

  const profile = activity.profiles;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/activity/${activity.id}`)}
      activeOpacity={0.88}
    >
      <GlassCard style={{ marginHorizontal: 12 }} padding={16}>
        {/* Author row */}
        {showAuthor && profile && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(0,188,212,0.12)',
              borderWidth: 1, borderColor: 'rgba(0,188,212,0.25)',
              justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
            }}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 36, height: 36 }} />
              ) : (
                <Text style={{ color: C.primary, fontWeight: '500', fontSize: 14 }}>
                  {(profile.username?.[0] ?? '?').toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '500', fontSize: 13 }}>
                {profile.full_name ?? profile.username}
              </Text>
            </View>
          </View>
        )}

        {/* Sport | Distance | Date — one row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ flex: 1, color: C.textMuted, fontSize: 12, fontWeight: '400' }}>
            {sportLabel(activity.sport_type)}
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '500', letterSpacing: -0.5 }}>
            {formatDistance(activity.distance)}
          </Text>
          <Text style={{ flex: 1, color: C.textMuted, fontSize: 12, fontWeight: '400', textAlign: 'right' }}>
            {relDate(activity.start_at)}
          </Text>
        </View>

        {/* Mini route map */}
        {activity.map_polyline ? (
          <View style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden' }}>
            <MiniMapView
              polyline={activity.map_polyline}
              uid={activity.id}
              height={200}
              routeColor="#00BCD4"
              routeWidth={3}
            />
          </View>
        ) : null}

        {/* Secondary metrics */}
        <View style={{
          flexDirection: 'row', gap: 16, paddingTop: 10,
          borderTopWidth: 1, borderTopColor: 'rgba(0,188,212,0.12)',
          marginBottom: 12,
        }}>
          {activity.avg_speed ? (
            <MetricItem label="Pace" value={formatPace(activity.avg_speed, activity.sport_type)} />
          ) : null}
          <MetricItem label="Time" value={formatDuration(activity.elapsed_time)} />
          {activity.elevation_gain != null && (
            <MetricItem label="Elev" value={`+${Math.round(activity.elevation_gain)}m`} accent />
          )}
        </View>

        {/* Actions */}
        <View style={{
          flexDirection: 'row', gap: 8,
          borderTopWidth: 1, borderTopColor: 'rgba(0,188,212,0.10)', paddingTop: 10,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: 'rgba(0,188,212,0.07)',
              borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
            }}
            onPress={toggleKudo}
          >
            <Ionicons
              name={hasKudo ? 'thumbs-up' : 'thumbs-up-outline'}
              size={14}
              color={hasKudo ? C.primary : C.textMuted}
            />
            <Text style={{ fontSize: 12, color: hasKudo ? C.primary : C.textMuted, fontWeight: '400' }}>
              {kudoCount > 0 ? String(kudoCount) : 'Kudo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
              backgroundColor: 'rgba(0,188,212,0.07)',
              borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
            }}
            onPress={() => router.push(`/activity/${activity.id}`)}
          >
            <Ionicons name="chatbubble-outline" size={14} color={C.textMuted} />
            <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '400' }}>Comment</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

function MetricItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const C = useColors();
  return (
    <View>
      <Text style={{ fontSize: 9, color: accent ? 'rgba(206,147,216,0.55)' : 'rgba(0,188,212,0.45)', textTransform: 'uppercase', letterSpacing: 0.09, marginBottom: 2 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: accent ? C.secondary : C.primary, fontWeight: '500' }}>
        {value}
      </Text>
    </View>
  );
}

export default ActivityCard;
