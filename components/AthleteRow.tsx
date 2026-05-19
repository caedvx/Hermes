import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Profile } from '@/lib/types';
import AvatarView from './AvatarView';

interface AthleteRowProps {
  profile: Profile;
  actionLabel?: string;
  actionVariant?: 'primary' | 'outline' | 'danger';
  onAction?: () => void;
  onPress?: () => void;
  isLoading?: boolean;
  rightElement?: React.ReactNode;
}

export default function AthleteRow({
  profile, actionLabel, actionVariant = 'primary',
  onAction, onPress, isLoading, rightElement,
}: AthleteRowProps) {
  const C = useColors();

  const buttonBg = actionVariant === 'primary' ? C.primary : 'transparent';
  const buttonBorder = actionVariant === 'primary' ? C.primary : actionVariant === 'danger' ? C.danger : 'rgba(0,188,212,0.25)';
  const buttonTextColor = actionVariant === 'primary' ? C.background : actionVariant === 'danger' ? C.danger : C.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(4,12,18,0.92)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,188,212,0.10)',
        gap: 12,
      }}
    >
      <AvatarView uri={profile.avatar_url} name={profile.username} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '500', fontSize: 14 }}>
          {profile.username}
        </Text>
        {profile.full_name ? (
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }}>
            {profile.full_name}
          </Text>
        ) : null}
      </View>
      {rightElement !== undefined ? rightElement : actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={isLoading}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 50,
            borderWidth: 1,
            borderColor: buttonBorder,
            backgroundColor: buttonBg,
            minWidth: 80,
            alignItems: 'center',
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={buttonTextColor} />
          ) : (
            <Text style={{ color: buttonTextColor, fontSize: 12, fontWeight: '500' }}>
              {actionLabel}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}
