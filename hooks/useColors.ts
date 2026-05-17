import { useColorScheme } from 'react-native';
import { LIGHT, DARK, type Colors } from '@/constants/colors';

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}
