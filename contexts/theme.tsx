import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT, DARK, type Colors } from '@/constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  isDark: false,
  mode: 'system',
  setMode: () => {},
});

const STORAGE_KEY = '@hermes/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') setModeState(val);
    });
  }, []);

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DARK : LIGHT, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
