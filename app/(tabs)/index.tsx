import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Activity } from '@/lib/types';
import { FeedCard } from '@/components/FeedCard';
import { useColors } from '@/hooks/useColors';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { formatDistance, formatDuration, formatPace, sportLabel } from '@/lib/utils';

const CIRC = 2 * Math.PI * 16;
const WEEKLY_GOAL_KM = 50;

function getMotd(): [string, string] {
  const h = new Date().getHours();
  if (h < 10) return ['Rise early.', 'Run first.'];
  if (h < 14) return ['No mercy.', 'No limits.'];
  if (h < 18) return ['Keep moving.', 'Stay sharp.'];
  return ['End strong.', 'Always.'];
}

function getWeekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString();
}

function calcStreak(activities: Activity[]): number {
  if (!activities.length) return 0;
  const dates = [...new Set(activities.map((a) => a.start_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((current.getTime() - day.getTime()) / 86400000);
    if (diff === 0 || diff === streak) { streak++; current = day; }
    else break;
  }
  return streak;
}

export default function FeedScreen() {
  const { user } = useAuth();
  const C = useColors();
  const [lastActivity, setLastActivity] = useState<Activity | null>(null);
  const [weeklyKm, setWeeklyKm] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [line1, line2] = getMotd();

  const load = useCallback(async () => {
    if (!user) return;

    const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    const followingIds = (follows as { following_id: string }[] | null)?.map((f) => f.following_id) ?? [];

    const [myActsRes, feedRes, weekRes] = await Promise.all([
      supabase.from('activities').select('*').eq('user_id', user.id).order('start_at', { ascending: false }).limit(60),
      // Mixed feed: own + following, public + followers_only only
      supabase.from('activities')
        .select('*, profiles(id,username,full_name,avatar_url)')
        .in('user_id', [user.id, ...followingIds])
        .in('status', ['public', 'followers_only'])
        .order('start_at', { ascending: false })
        .limit(30),
      supabase.from('activities').select('distance').eq('user_id', user.id).gte('start_at', getWeekStart()),
    ]);

    const myActs = (myActsRes.data as Activity[]) ?? [];
    setLastActivity(myActs[0] ?? null);
    setStreak(calcStreak(myActs));

    const wkm = ((weekRes.data as { distance: number }[]) ?? []).reduce((s, a) => s + (a.distance ?? 0), 0) / 1000;
    setWeeklyKm(wkm);

    setFeed((feedRes.data as Activity[]) ?? []);
  }, [user]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const weekPct = Math.min(weeklyKm / WEEKLY_GOAL_KM, 1);
  const dashOffset = CIRC * (1 - weekPct);

  const lastAgo = lastActivity ? (() => {
    const days = Math.floor((Date.now() - new Date(lastActivity.start_at).getTime()) / 86400000);
    if (days === 0) return 'TODAY';
    if (days === 1) return 'YESTERDAY';
    return `${days}D AGO`;
  })() : null;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#030A0C' }}>
      <AuroraBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <SafeAreaView edges={['top']}>

          {/* ── Motivational header ── */}
          <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16 }}>
            <Text style={{ fontSize: 9, color: 'rgba(0,188,212,0.55)', letterSpacing: 13, textTransform: 'uppercase', marginBottom: 6 }}>
              OWN IT
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '500', color: '#fff', letterSpacing: -0.5, lineHeight: 28 }}>
              {line1}{'\n'}
              <Text style={{ color: '#4DD0E1' }}>{line2}</Text>
            </Text>
          </View>

          {/* ── Last activity card ── */}
          {lastActivity ? (
            <GlassCard style={{ marginHorizontal: 16, marginBottom: 8 }} padding={14}>
              <Text style={{ fontSize: 8, color: 'rgba(77,208,225,0.45)', letterSpacing: 0.11, textTransform: 'uppercase', marginBottom: 7 }}>
                {`${sportLabel(lastActivity.sport_type).toUpperCase()} · ${lastAgo}`}
              </Text>
              <Text style={{ fontSize: 32, fontWeight: '500', color: '#fff', letterSpacing: -1.2, lineHeight: 36 }}>
                {formatDistance(lastActivity.distance)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                {lastActivity.avg_speed ? (
                  <MiniStat label="Pace" value={formatPace(lastActivity.avg_speed, lastActivity.sport_type)} color="#4DD0E1" labelColor="rgba(77,208,225,0.4)" />
                ) : null}
                <MiniStat label="Time" value={formatDuration(lastActivity.elapsed_time)} color="#4DD0E1" labelColor="rgba(77,208,225,0.4)" />
                {lastActivity.elevation_gain != null && (
                  <MiniStat label="Elev" value={`+${Math.round(lastActivity.elevation_gain)}m`} color="#CE93D8" labelColor="rgba(206,147,216,0.55)" />
                )}
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={{ marginHorizontal: 16, marginBottom: 8 }} padding={14}>
              <Text style={{ fontSize: 8, color: 'rgba(77,208,225,0.45)', letterSpacing: 0.11, textTransform: 'uppercase', marginBottom: 8 }}>NO RUNS YET</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', fontWeight: '400' }}>Record your first activity to see stats here.</Text>
            </GlassCard>
          )}

          {/* ── Weekly ring + Streak ── */}
          <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 }}>
            <GlassCard variant="violet" style={{ flex: 1 }} padding={10}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Svg width={42} height={42} viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
                  <Circle cx={21} cy={21} r={16} fill="none" stroke="rgba(156,136,184,0.20)" strokeWidth={4} />
                  <Circle cx={21} cy={21} r={16} fill="none" stroke="#9C88B8" strokeWidth={4}
                    strokeDasharray={`${CIRC} ${CIRC}`} strokeDashoffset={dashOffset}
                    strokeLinecap="round" transform="rotate(-90 21 21)" />
                  <Circle cx={21} cy={21} r={16} fill="none" stroke="#CE93D8" strokeWidth={2.5}
                    strokeDasharray={`${CIRC * 0.3} ${CIRC}`} strokeDashoffset={0}
                    strokeLinecap="round" transform="rotate(-90 21 21)" opacity={0.8} />
                  <SvgText x={21} y={25} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="500">
                    {Math.round(weekPct * 100)}%
                  </SvgText>
                </Svg>
                <View>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Weekly</Text>
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '500', marginTop: 1, letterSpacing: -0.3 }}>{weeklyKm.toFixed(1)}km</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(206,147,216,0.6)', marginTop: 1 }}>of {WEEKLY_GOAL_KM}km goal</Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={{ flex: 1 }} padding={10}>
              <Text style={{ fontSize: 8, color: 'rgba(77,208,225,0.4)', textTransform: 'uppercase', letterSpacing: 0.09 }}>Streak</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
                <Text style={{ fontSize: 22, fontWeight: '500', color: '#fff', letterSpacing: -0.5 }}>{streak}</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>d</Text>
              </View>
              {streak > 0 && (
                <Text style={{ fontSize: 9, color: '#4DD0E1', marginTop: 2 }}>↑ keep it up</Text>
              )}
            </GlassCard>
          </View>

          {/* ── Social feed ── */}
          {feed.length > 0 && (
            <>
              <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 0.12, textTransform: 'uppercase' }}>
                  Recent Activity
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {feed.map((item) => (
                  <FeedCard key={item.id} activity={item} />
                ))}
              </View>
            </>
          )}

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, color, labelColor }: { label: string; value: string; color: string; labelColor: string }) {
  return (
    <View>
      <Text style={{ fontSize: 8, color: labelColor, letterSpacing: 0.09, textTransform: 'uppercase', marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, color, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
