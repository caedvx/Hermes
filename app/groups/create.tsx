import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GroupPrivacy, SportType } from '@/lib/types';
import { sportLabel } from '@/lib/utils';

const SPORT_ICONS: Record<SportType, string> = {
  run: 'flash-outline',
  ride: 'bicycle-outline',
  swim: 'water-outline',
  hike: 'trail-sign-outline',
  walk: 'walk-outline',
  other: 'barbell-outline',
};

const SPORT_OPTIONS: (SportType | null)[] = [null, 'run', 'ride', 'swim', 'hike', 'walk', 'other'];

export default function CreateGroupScreen() {
  const C = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<SportType | null>(null);
  const [privacy, setPrivacy] = useState<GroupPrivacy>('public');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      Alert.alert('Error', 'Group name must be at least 2 characters.');
      return;
    }
    if (!user) return;

    setSubmitting(true);

    const { data: group, error } = await supabase
      .from('groups')
      .insert([
        {
          name: trimmedName,
          description: description.trim() || null,
          sport_type: sportType,
          privacy,
          created_by: user.id,
          avatar_url: null,
        },
      ] as never[])
      .select('id')
      .single();

    if (error || !group) {
      Alert.alert('Error', error?.message ?? 'Could not create group.');
      setSubmitting(false);
      return;
    }

    await supabase.from('group_members').insert([
      { group_id: (group as { id: string }).id, user_id: user.id, role: 'admin' },
    ] as never[]);

    setSubmitting(false);
    router.replace(`/groups/${(group as { id: string }).id}`);
  };

  const inputStyle = {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16 as const,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
            GROUP NAME *
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Morning Runners Club"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={60}
            returnKeyType="next"
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
            DESCRIPTION
          </Text>
          <TextInput
            style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="What's this group about?"
            placeholderTextColor={C.textMuted}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
          />
          <Text style={{ color: C.textMuted, fontSize: 12, alignSelf: 'flex-end' }}>
            {description.length}/500
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
            SPORT FOCUS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SPORT_OPTIONS.map((s) => {
              const active = sportType === s;
              return (
                <TouchableOpacity
                  key={s ?? 'any'}
                  onPress={() => setSportType(s)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: active ? C.primary : C.border,
                    backgroundColor: active ? C.primaryTint : C.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {s ? (
                      <Ionicons name={SPORT_ICONS[s] as never} size={14} color={active ? C.primary : C.textSecondary} />
                    ) : (
                      <Ionicons name="apps-outline" size={14} color={active ? C.primary : C.textSecondary} />
                    )}
                    <Text style={{ color: active ? C.primary : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 14 }}>
                      {s ? sportLabel(s) : 'Any Sport'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
            PRIVACY
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['public', 'private'] as GroupPrivacy[]).map((p) => {
              const active = privacy === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPrivacy(p)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: active ? C.primary : C.border,
                    backgroundColor: active ? C.primaryTint : C.surface,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={p === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                      size={16}
                      color={active ? C.primary : C.textSecondary}
                    />
                    <Text style={{ color: active ? C.primary : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 15 }}>
                      {p === 'public' ? 'Public' : 'Private'}
                    </Text>
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                    {p === 'public' ? 'Anyone can join' : 'Invite only'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCreate}
          disabled={submitting || name.trim().length < 2}
          style={{
            backgroundColor: C.primary,
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
            opacity: submitting || name.trim().length < 2 ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Create Group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
