import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export default function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const C = useColors();

  return (
    <View style={{
      borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)',
      backgroundColor: 'rgba(4,12,18,0.95)',
    }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {options.map((option, index) => {
          const active = index === selectedIndex;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(index)}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 50,
                borderWidth: 1,
                borderColor: active ? 'rgba(0,188,212,0.40)' : 'rgba(0,188,212,0.12)',
                backgroundColor: active ? 'rgba(0,188,212,0.14)' : 'transparent',
              }}
            >
              <Text style={{
                color: active ? C.primary : C.textMuted,
                fontWeight: active ? '500' : '400',
                fontSize: 13,
                letterSpacing: 0.1,
              }}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
