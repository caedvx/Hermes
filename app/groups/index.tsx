import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Group, GroupRole } from '@/lib/types';
import AvatarView from '@/components/AvatarView';

type MyGroupRow = Group & { my_role: GroupRole };

export default function GroupsScreen() {
  const C = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const navigation = useNavigation();

  const [myGroups, setMyGroups] = useState<MyGroupRow[]>([]);
  const [discover, setDiscover] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: memberRows } = await supabase
      .from('group_members')
      .select('role, groups(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    const myList: MyGroupRow[] = (memberRows ?? [])
      .filter((r: { groups: Group | null }) => r.groups)
      .map((r: { role: GroupRole; groups: Group }) => ({ ...r.groups, my_role: r.role }));
    setMyGroups(myList);

    const myIds = myList.map((g) => g.id);

    let query = supabase
      .from('groups')
      .select('*')
      .eq('privacy', 'public')
      .order('member_count', { ascending: false })
      .limit(20);

    if (myIds.length > 0) {
      query = query.not('id', 'in', `(${myIds.join(',')})`);
    }

    const { data: discoverRows } = await query;
    setDiscover((discoverRows ?? []) as Group[]);
  }, [user]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/groups/create')} style={{ marginRight: 4 }}>
          <Ionicons name="add" size={28} color={C.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, C.primary]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const joinGroup = async (group: Group) => {
    if (!user) return;
    setJoiningId(group.id);
    await supabase.from('group_members').insert([
      { group_id: group.id, user_id: user.id, role: 'member' },
    ] as never[]);
    setJoiningId(null);
    router.push(`/groups/${group.id}`);
  };

  const groupInitial = (group: Group) => group.name[0].toUpperCase();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={['bottom']}>
      <FlatList
        data={discover}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ListHeaderComponent={
          <>
            {myGroups.length > 0 && (
              <View>
                <Text
                  style={{
                    color: C.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 6,
                  }}
                >
                  MY GROUPS
                </Text>
                {myGroups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    onPress={() => router.push(`/groups/${group.id}`)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: C.surface,
                      borderBottomWidth: 1,
                      borderBottomColor: C.border,
                      gap: 12,
                    }}
                  >
                    <AvatarView
                      uri={group.avatar_url}
                      name={groupInitial(group)}
                      size={48}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
                          {group.name}
                        </Text>
                        {group.privacy === 'private' && (
                          <Ionicons name="lock-closed" size={12} color={C.textMuted} />
                        )}
                        {group.my_role === 'admin' && (
                          <Text
                            style={{
                              color: C.primary,
                              fontSize: 11,
                              fontWeight: '700',
                              borderWidth: 1,
                              borderColor: C.primary,
                              borderRadius: 4,
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                            }}
                          >
                            ADMIN
                          </Text>
                        )}
                      </View>
                      {group.description ? (
                        <Text
                          style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {group.description}
                        </Text>
                      ) : null}
                      <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {discover.length > 0 && (
              <Text
                style={{
                  color: C.textMuted,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1,
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 6,
                }}
              >
                DISCOVER
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: C.surface,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
              gap: 12,
            }}
          >
            <AvatarView uri={item.avatar_url} name={groupInitial(item)} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
              {item.description ? (
                <Text
                  style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
              ) : null}
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => joinGroup(item)}
              disabled={joiningId === item.id}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.primary,
                backgroundColor: C.primary,
                minWidth: 60,
                alignItems: 'center',
              }}
            >
              {joiningId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          myGroups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Ionicons name="people-circle-outline" size={48} color={C.textMuted} />
              <Text
                style={{ color: C.textMuted, marginTop: 12, textAlign: 'center', fontSize: 15 }}
              >
                No groups yet. Create one or discover public groups.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={
          myGroups.length === 0 && discover.length === 0 ? { flex: 1 } : undefined
        }
      />
    </SafeAreaView>
  );
}
