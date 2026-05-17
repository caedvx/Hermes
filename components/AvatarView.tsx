import { Image, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface AvatarViewProps {
  uri?: string | null;
  name: string;
  size?: number;
  style?: ViewStyle;
}

export default function AvatarView({ uri, name, size = 40, style }: AvatarViewProps) {
  const C = useColors();
  const radius = size / 2;
  const initial = (name || '?')[0].toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: C.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
        {initial}
      </Text>
    </View>
  );
}
