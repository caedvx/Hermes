import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Profile, Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, sportIoniconName, sportLabel } from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';

export default function AthleteScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const C = useColors();

  useEffect(() => {
    if (!username) return;
    async function load() {
      const { data } = await supabase.from('profiles').select('*').eq('username', username!).single();
      if (!data) return;
      const p = data as Profile;
      setProfile(p);
      const [actsRes, followRes] = await Promise.all([
        supabase.from('activities').select('*').eq('user_id', p.id).in('status', ['public']).order('start_at', { ascending: false }).limit(10),
        user ? supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', p.id).single() : Promise.resolve({ data: null }),
      ]);
      setActivities((actsRes.data as Activity[]) ?? []);
      setIsFollowing(!!followRes.data);
    }
    load().finally(() => setLoading(false));
  }, [username, user]);

  async function toggleFollow() {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: profile.id }] as never[]);
      setIsFollowing(true);
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}><ActivityIndicator size="large" color={C.primary} /></View>;
  if (!profile) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}><Text style={{ color: C.textMuted }}>Athlete not found</Text></View>;

  const isOwnProfile = user?.id === profile.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <View style={{ alignItems: 'center', padding: 28, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)' }}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', marginBottom: 14 }} />
          ) : (
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,188,212,0.10)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: C.primary, fontSize: 28, fontWeight: '500' }}>{(profile.username[0] ?? '?').toUpperCase()}</Text>
            </View>
          )}

          <Text style={{ fontSize: 17, fontWeight: '500', color: C.text, marginBottom: 2 }}>@{profile.username}</Text>
          {profile.full_name && <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>{profile.full_name}</Text>}
          {profile.bio && <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 }}>{profile.bio}</Text>}
          {(profile.city || profile.country) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 }}>
              <Ionicons name="location-outline" size={11} color={C.textMuted} />
              <Text style={{ fontSize: 11, color: C.textMuted }}>{[profile.city, profile.country].filter(Boolean).join(', ')}</Text>
            </View>
          )}

          {!isOwnProfile && (
            <PillButton
              label={isFollowing ? 'Following' : 'Follow'}
              onPress={toggleFollow}
              variant={isFollowing ? 'outline' : 'primary'}
              glow={!isFollowing}
            />
          )}
        </View>

        {/* Recent activities */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: '500', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>RECENT ACTIVITIES</Text>
          {activities.length === 0 ? (
            <Text style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>No public activities</Text>
          ) : (
            <GlassCard padding={0}>
              {activities.map((act, i) => (
                <View key={act.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(0,188,212,0.10)' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,188,212,0.10)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.20)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={sportIoniconName(act.sport_type) as never} size={18} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>{act.title}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                      {formatDistance(act.distance)} · {formatDuration(act.elapsed_time)}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
