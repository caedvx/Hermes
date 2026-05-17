import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import AthleteRow from '@/components/AthleteRow';
import SegmentedControl from '@/components/SegmentedControl';

const TABS = ['Followers', 'Following', 'Find', 'Mutual'] as const;

export default function SocialScreen() {
  const C = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [tabIndex, setTabIndex] = useState(0);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [mutuals, setMutuals] = useState<Profile[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFollowingSet = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);
    if (data) setFollowingSet(new Set(data.map((r: { following_id: string }) => r.following_id)));
  }, [user]);

  const fetchFollowers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('profiles!follows_follower_id_fkey(id,username,full_name,avatar_url)')
      .eq('following_id', user.id);
    if (data) {
      setFollowers(
        data
          .map((r: { profiles: Profile | null }) => r.profiles)
          .filter(Boolean) as Profile[]
      );
    }
  }, [user]);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id,username,full_name,avatar_url)')
      .eq('follower_id', user.id);
    if (data) {
      setFollowing(
        data
          .map((r: { profiles: Profile | null }) => r.profiles)
          .filter(Boolean) as Profile[]
      );
    }
  }, [user]);

  const fetchMutuals = useCallback(
    async (fwSet: Set<string>) => {
      if (!user || fwSet.size === 0) { setMutuals([]); return; }
      const { data } = await supabase
        .from('follows')
        .select('profiles!follows_follower_id_fkey(id,username,full_name,avatar_url)')
        .eq('following_id', user.id)
        .in('follower_id', Array.from(fwSet));
      if (data) {
        setMutuals(
          data
            .map((r: { profiles: Profile | null }) => r.profiles)
            .filter(Boolean) as Profile[]
        );
      }
    },
    [user]
  );

  const loadAll = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchFollowingSet(), fetchFollowers(), fetchFollowing()]);
  }, [user, fetchFollowingSet, fetchFollowers, fetchFollowing]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    fetchMutuals(followingSet);
  }, [followingSet, fetchMutuals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id,username,full_name,avatar_url')
        .or(`username.ilike.%${text.trim()}%,full_name.ilike.%${text.trim()}%`)
        .neq('id', user.id)
        .limit(20);
      if (data) setSearchResults(data as Profile[]);
    }, 300);
  };

  const toggleFollow = async (targetId: string) => {
    if (!user) return;
    const isFollowing = followingSet.has(targetId);
    setLoadingMap((m) => ({ ...m, [targetId]: true }));
    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);
      setFollowingSet((s) => { const n = new Set(s); n.delete(targetId); return n; });
      setFollowing((prev) => prev.filter((p) => p.id !== targetId));
    } else {
      await supabase
        .from('follows')
        .insert([{ follower_id: user.id, following_id: targetId }] as never[]);
      setFollowingSet((s) => new Set(s).add(targetId));
    }
    setLoadingMap((m) => ({ ...m, [targetId]: false }));
  };

  const currentData: Profile[] =
    tabIndex === 0 ? followers :
    tabIndex === 1 ? following :
    tabIndex === 2 ? searchResults :
    mutuals;

  const getActionLabel = (profile: Profile) => {
    if (tabIndex === 0) return followingSet.has(profile.id) ? 'Following' : 'Follow Back';
    if (tabIndex === 1) return 'Unfollow';
    if (tabIndex === 2) return followingSet.has(profile.id) ? 'Following' : 'Follow';
    return 'Following';
  };

  const getActionVariant = (profile: Profile): 'primary' | 'outline' => {
    if (tabIndex === 1) return 'outline';
    if (followingSet.has(profile.id)) return 'outline';
    return 'primary';
  };

  const emptyMessage =
    tabIndex === 0 ? 'No followers yet' :
    tabIndex === 1 ? 'Not following anyone yet' :
    tabIndex === 2 ? (search ? 'No athletes found' : 'Search for athletes by name or username') :
    'No mutual followers yet';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: 4 }}>
          SOCIAL
        </Text>
        <TouchableOpacity onPress={() => router.push('/groups')} style={{ padding: 4 }}>
          <Ionicons name="people-circle-outline" size={28} color={C.primary} />
        </TouchableOpacity>
      </View>

      <SegmentedControl
        options={[...TABS]}
        selectedIndex={tabIndex}
        onChange={setTabIndex}
      />

      {tabIndex === 2 && (
        <View
          style={{
            margin: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: C.surfaceAlt,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="search" size={18} color={C.textMuted} />
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search athletes..."
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, color: C.text, fontSize: 15 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AthleteRow
            profile={item}
            actionLabel={getActionLabel(item)}
            actionVariant={getActionVariant(item)}
            onAction={() => toggleFollow(item.id)}
            onPress={() => router.push(`/athlete/${item.username}`)}
            isLoading={loadingMap[item.id]}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
            <Ionicons name="people-outline" size={48} color={C.textMuted} />
            <Text style={{ color: C.textMuted, marginTop: 12, textAlign: 'center', fontSize: 15 }}>
              {emptyMessage}
            </Text>
          </View>
        }
        contentContainerStyle={currentData.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  );
}
