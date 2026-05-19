import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Group, GroupRole } from '@/lib/types';
import AvatarView from '@/components/AvatarView';
import { GlassCard } from '@/components/GlassCard';

type MyGroupRow = Group & { my_role: GroupRole };

export default function GroupsScreen() {
  const C = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [myGroups, setMyGroups] = useState<MyGroupRow[]>([]);
  const [discover, setDiscover] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: memberRows } = await supabase.from('group_members').select('role, groups(*)').eq('user_id', user.id).order('joined_at', { ascending: false });
    const myList: MyGroupRow[] = (memberRows ?? []).filter((r: { groups: Group | null }) => r.groups).map((r: { role: GroupRole; groups: Group }) => ({ ...r.groups, my_role: r.role }));
    setMyGroups(myList);
    const myIds = myList.map((g) => g.id);
    let query = supabase.from('groups').select('*').eq('privacy', 'public').order('member_count', { ascending: false }).limit(20);
    if (myIds.length > 0) query = query.not('id', 'in', `(${myIds.join(',')})`);
    const { data: discoverRows } = await query;
    setDiscover((discoverRows ?? []) as Group[]);
  }, [user]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/groups/create')} style={{ marginRight: 4 }}>
          <Ionicons name="add" size={26} color={C.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, C.primary]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const joinGroup = async (group: Group) => {
    if (!user) return;
    setJoiningId(group.id);
    await supabase.from('group_members').insert([{ group_id: group.id, user_id: user.id, role: 'member' }] as never[]);
    setJoiningId(null);
    router.push(`/groups/${group.id}`);
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030A0C' }}><ActivityIndicator color={C.primary} /></View>;

  const GroupRow = ({ group, onPress, right }: { group: Group; onPress: () => void; right?: React.ReactNode }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <GlassCard style={{ marginHorizontal: 12 }} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AvatarView uri={group.avatar_url} name={group.name} size={46} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ color: C.text, fontWeight: '500', fontSize: 14, letterSpacing: -0.2 }}>{group.name}</Text>
              {group.privacy === 'private' && <Ionicons name="lock-closed" size={11} color={C.textMuted} />}
            </View>
            {group.description ? <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 2 }} numberOfLines={1}>{group.description}</Text> : null}
            <Text style={{ color: C.textMuted, fontSize: 11 }}>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</Text>
          </View>
          {right}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['bottom']}>
      <FlatList
        data={discover}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        ListHeaderComponent={
          <>
            {myGroups.length > 0 && (
              <View style={{ paddingBottom: 4 }}>
                <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>MY GROUPS</Text>
                <View style={{ gap: 8 }}>
                  {myGroups.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
                      onPress={() => router.push(`/groups/${group.id}`)}
                      right={
                        group.my_role === 'admin' ? (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', backgroundColor: 'rgba(0,188,212,0.10)' }}>
                            <Text style={{ color: C.primary, fontSize: 10, fontWeight: '500' }}>ADMIN</Text>
                          </View>
                        ) : <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
                      }
                    />
                  ))}
                </View>
              </View>
            )}
            {discover.length > 0 && (
              <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>DISCOVER</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <GroupRow
            group={item}
            onPress={() => {}}
            right={
              <TouchableOpacity
                onPress={() => joinGroup(item)}
                disabled={joiningId === item.id}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, borderWidth: 1, borderColor: C.primary, backgroundColor: C.primary, minWidth: 56, alignItems: 'center' }}
              >
                {joiningId === item.id ? <ActivityIndicator size="small" color="#030A0C" /> : <Text style={{ color: '#030A0C', fontSize: 12, fontWeight: '500' }}>Join</Text>}
              </TouchableOpacity>
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          myGroups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 }}>
              <Ionicons name="people-circle-outline" size={44} color={C.textMuted} />
              <Text style={{ color: C.textMuted, textAlign: 'center', fontSize: 14 }}>No groups yet. Create one or discover public groups.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 100, flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}
