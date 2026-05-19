import { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { GlassCard } from './GlassCard';
import { formatDistance, formatDuration, formatDate, formatPace, sportIoniconName, sportLabel } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';

interface Props {
  activity: Activity;
  showAuthor?: boolean;
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <Ionicons name={sportIoniconName(activity.sport_type) as never} size={10} color={C.textMuted} />
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {sportLabel(activity.sport_type)} · {formatDate(activity.start_at)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Primary metric — distance, large */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 9, color: 'rgba(0,188,212,0.50)', letterSpacing: 0.12, textTransform: 'uppercase', marginBottom: 5 }}>
            {!showAuthor ? `${sportLabel(activity.sport_type)} · ${formatDate(activity.start_at)}` : activity.title}
          </Text>
          <Text style={{ color: C.text, fontWeight: '500', fontSize: 30, letterSpacing: -1.2, lineHeight: 34 }}>
            {formatDistance(activity.distance).replace(' km', '')}
            <Text style={{ fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.35)' }}> km</Text>
          </Text>
        </View>

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
