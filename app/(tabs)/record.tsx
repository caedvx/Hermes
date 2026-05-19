import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Linking,
  useColorScheme,
} from 'react-native';
import { PillButton } from '@/components/PillButton';
import { Map as MapLibreMap, Camera, GeoJSONSource, Layer, UserLocation, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivityRecording } from '@/hooks/useActivityRecording';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDuration, formatDistance, formatPace, formatElevation,
  formatSpeed, sportLabel, haversineDistance,
} from '@/lib/utils';
import type { SportType, ActivityStatus, TrackPoint } from '@/lib/types';

const SPORT_TYPES: SportType[] = ['run', 'ride', 'walk', 'hike', 'swim', 'other'];
const SPORT_ICONS: Record<SportType, string> = {
  run: 'flash-outline',
  ride: 'bicycle-outline',
  walk: 'walk-outline',
  hike: 'trail-sign-outline',
  swim: 'water-outline',
  other: 'barbell-outline',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_MIN_HEIGHT = 290; // visible content height above the tab bar
const TAB_BAR_HEIGHT = 72;   // must match _layout.tsx bar height
const CONTENT_HEIGHT_EST = 460;
const HANDLE_HEIGHT = 30;

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function lastSegmentPace(track: TrackPoint[], km: number): string {
  if (track.length < 2) return '--';
  const target = km * 1000;
  let dist = 0;
  let startIdx = 0;
  for (let i = track.length - 1; i > 0; i--) {
    dist += haversineDistance(
      track[i - 1].latitude, track[i - 1].longitude,
      track[i].latitude, track[i].longitude,
    );
    startIdx = i - 1;
    if (dist >= target) break;
  }
  if (dist < target * 0.5) return '--';
  const dt = (track[track.length - 1].timestamp - track[startIdx].timestamp) / 1000;
  if (dt <= 0) return '--';
  const secPerKm = dt / (dist / 1000);
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
}

export default function RecordScreen() {
  const { user } = useAuth();
  const {
    isRecording, isPaused, stats, track, sportType, setSportType,
    startRecording, pauseRecording, resumeRecording, stopRecording,
  } = useActivityRecording();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('public');
  const recordingDataRef = useRef<ReturnType<typeof stopRecording>>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  const C = useColors();
  const colorScheme = useColorScheme();
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();

  // Space the floating tab bar occupies at the bottom of the screen
  const tabBarClearance = TAB_BAR_HEIGHT + Math.max(safeBottom, 8) + 10;
  // Panel tall enough to show PANEL_MIN_HEIGHT of content above the tab bar
  const effectivePanelMinHeight = PANEL_MIN_HEIGHT + tabBarClearance;
  const sportPickerBottom = effectivePanelMinHeight + 12;

  const panelMaxH = SCREEN_HEIGHT - safeTop;
  const collapsedOff = panelMaxH - effectivePanelMinHeight;


  const styles = useMemo(
    () => makeStyles(C, safeTop, panelMaxH, sportPickerBottom),
    [C, safeTop, panelMaxH, sportPickerBottom],
  );

  // Single animated value drives both translateY and the top-segment scale.
  // Both are transform properties → useNativeDriver: true → UI thread only, zero JS overhead.
  const panelTranslate = useRef(new Animated.Value(collapsedOff)).current;
  const panelBase = useRef(collapsedOff);

  // Scale interpolation: 1.0 when collapsed → 1.20 when fully expanded.
  // Derived from panelTranslate so it's automatically native-driver compatible.
  const topSegmentScale = panelTranslate.interpolate({
    inputRange: [0, collapsedOff],
    outputRange: [1.20, 1.0],
    extrapolate: 'clamp',
  });
  const hasCenteredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 2,
      onPanResponderGrant: () => {
        panelTranslate.stopAnimation();
      },
      onPanResponderMove: (_, { dy }) => {
        panelTranslate.setValue(Math.max(0, Math.min(collapsedOff, panelBase.current + dy)));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const released = Math.max(0, Math.min(collapsedOff, panelBase.current + dy));
        const expand = vy < -0.3 || (vy <= 0.3 && released < collapsedOff * 0.2);
        const target = expand ? 0 : collapsedOff;
        panelBase.current = target;
        Animated.timing(panelTranslate, {
          toValue: target,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    async function initMapCenter() {
      try {
        // Try last-known first (instant, no battery cost)
        const last = await Location.getLastKnownPositionAsync({});
        if (last && !hasCenteredRef.current) {
          hasCenteredRef.current = true;
          setInitialCenter([last.coords.longitude, last.coords.latitude]);
          return;
        }
        // Fall back to a fresh fix if no cached position
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && !hasCenteredRef.current) {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          hasCenteredRef.current = true;
          setInitialCenter([current.coords.longitude, current.coords.latitude] as [number, number]);
        }
      } catch {}
    }
    initMapCenter();
  }, []);

  // Split track into segments so gaps don't draw straight lines on the map
  const trackSegments = useMemo(() => {
    if (track.length < 2) return [];
    const segs: [number, number][][] = [];
    let current: [number, number][] = [];
    for (const p of track) {
      if (p.newSegment && current.length >= 1) {
        if (current.length >= 2) segs.push(current);
        current = [[p.longitude, p.latitude]];
      } else {
        current.push([p.longitude, p.latitude]);
      }
    }
    if (current.length >= 2) segs.push(current);
    return segs;
  }, [track]);

  const lastPoint = track[track.length - 1];
  const last1km = lastSegmentPace(track, 1);
  const last5km = lastSegmentPace(track, 5);
  const currentPace = stats.currentSpeedMps > 0.5
    ? formatPace(stats.currentSpeedMps, sportType)
    : '--:--';

  async function handleStart() {
    setActivityTitle(`${sportLabel(sportType)} — ${new Date().toLocaleDateString()}`);
    const granted = await startRecording();
    if (!granted) {
      Alert.alert(
        'Location Permission Required',
        'Please enable location access in your device settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  }

  function handleStop() {
    Alert.alert('Finish Activity?', 'Are you sure you want to stop recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () => {
          const data = stopRecording();
          recordingDataRef.current = data;
          if (data && data.distanceMeters > 10) {
            setShowSaveModal(true);
          } else {
            Alert.alert('Activity too short', 'Move around a bit more before saving!');
          }
        },
      },
    ]);
  }

  async function handleSave() {
    if (!user || !recordingDataRef.current) return;
    const data = recordingDataRef.current;
    setSaving(true);
    try {
      const { data: activity, error: actError } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          title: activityTitle || `${sportLabel(sportType)} Activity`,
          description: activityDescription || null,
          sport_type: sportType,
          status: activityStatus,
          start_at: data.startAt,
          elapsed_time: Math.round(data.elapsedSeconds),
          moving_time: Math.round(data.movingSeconds),
          distance: data.distanceMeters,
          elevation_gain: data.elevationGainMeters,
          avg_speed: data.avgSpeedMps,
          max_speed: data.maxSpeedMps,
          map_polyline: data.polyline,
        })
        .select()
        .single();

      if (actError) throw actError;
      const savedActivity = activity as { id: string };

      if (data.latlng.length > 0) {
        await supabase.from('activity_streams').insert({
          activity_id: savedActivity.id,
          latlng: data.latlng,
          altitude: data.altitude,
          velocity: data.velocity,
          time: data.timeStream,
          heartrate: null, cadence: null, watts: null, distance: null,
        });
      }

      setShowSaveModal(false);
      Alert.alert('Activity Saved!', 'Your activity has been recorded successfully.');
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setShowSaveModal(false);
    recordingDataRef.current = null;
  }

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={styles.map}
        mapStyle={MAP_STYLE}
        attribution={false}
      >
        <Camera
          ref={cameraRef}
          trackUserLocation={isRecording && !isPaused ? 'default' : undefined}
          {...(!isRecording && initialCenter
            ? { center: initialCenter, zoom: 15, duration: 500 }
            : {}
          )}
        />
        <UserLocation />
        {trackSegments.length > 0 && (
          <GeoJSONSource
            id="route"
            data={{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: trackSegments }, properties: {} }}
          >
            <Layer
              id="routeLine"
              type="line"
              paint={{ 'line-color': C.primary, 'line-width': 4 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}
        {lastPoint && (
          <Marker lngLat={[lastPoint.longitude, lastPoint.latitude]}>
            <View style={styles.markerDot} />
          </Marker>
        )}
      </MapLibreMap>

      {!isRecording && (
        <View style={styles.sportPicker}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportList}>
            {SPORT_TYPES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sportChip, sportType === s && styles.sportChipActive]}
                onPress={() => setSportType(s)}
              >
                <Ionicons
                  name={SPORT_ICONS[s] as never}
                  size={16}
                  color={sportType === s ? C.primary : C.textSecondary}
                />
                <Text style={[styles.sportLabel, sportType === s && styles.sportLabelActive]}>
                  {sportLabel(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Animated.View style={[styles.statsPanel, { transform: [{ translateY: panelTranslate }] }]}>
        <View style={styles.panelContent} {...panResponder.panHandlers}>
          <View style={styles.handleRow}>
            <View style={styles.dragHandle} />
          </View>
          <View style={[styles.statsGroup, { paddingBottom: tabBarClearance }]}>

            {/* ── Core unit: centered vertically in the visible panel area ── */}
            <View style={styles.coreUnit}>

              {/* Top two segments scale together — native driver, zero JS */}
              <Animated.View style={{ transform: [{ scale: topSegmentScale }] }}>
                <View style={styles.durationRow}>
                  <Text style={[styles.durationValue, { fontSize: 56, lineHeight: 62 }]}>
                    {formatDuration(stats.durationSeconds)}
                  </Text>
                  <Text style={styles.durationLabel}>DURATION</Text>
                </View>
                <View style={styles.secondaryRow}>
                  <StatPill label="Distance" value={formatDistance(stats.distanceMeters)} />
                  <View style={styles.pillDivider} />
                  <StatPill label="Avg Pace" value={formatPace(stats.avgSpeedMps, sportType)} />
                  <View style={styles.pillDivider} />
                  <StatPill label="Elevation" value={formatElevation(stats.elevationGainMeters)} />
                </View>
              </Animated.View>

              {/* Controls */}
              <View style={styles.controls}>
                {!isRecording ? (
                  <PillButton label="▶   Start run" onPress={handleStart} glow style={{ paddingHorizontal: 40 }} />
                ) : (
                  <View style={styles.activeControls}>
                    <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                      <View style={styles.stopIcon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pauseButton, isPaused && styles.resumeButton]}
                      onPress={isPaused ? resumeRecording : pauseRecording}
                    >
                      {isPaused ? (
                        <Text style={styles.pauseButtonText}>▶</Text>
                      ) : (
                        <View style={styles.pauseIcon}>
                          <View style={styles.pauseBar} />
                          <View style={styles.pauseBar} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {isPaused && (
                <View style={styles.pausedBanner}>
                  <Text style={styles.pausedText}>PAUSED</Text>
                </View>
              )}

            </View>{/* end coreUnit */}

            <View style={styles.extendedSection}>
              <View style={styles.extendedHeaderRow}>
                <View style={styles.extendedLine} />
                <Text style={styles.extendedHeaderText}>PACE BREAKDOWN</Text>
                <View style={styles.extendedLine} />
              </View>
              <View style={styles.cardRow}>
                <StatCard label="Current Pace" value={currentPace} accent />
                <StatCard label="Avg Speed" value={formatSpeed(stats.avgSpeedMps)} />
              </View>
              <View style={styles.cardRow}>
                <StatCard label="Last 1 km" value={last1km} />
                <StatCard label="Last 5 km" value={last5km} />
              </View>
            </View>

          </View>
        </View>
      </Animated.View>

      <Modal visible={showSaveModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleDiscard}>
              <Text style={styles.modalDiscard}>Discard</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Save Activity</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={C.primary} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Ionicons name="resize-outline" size={14} color={C.textMuted} />
                <Text style={styles.modalStatText}>{formatDistance(recordingDataRef.current?.distanceMeters ?? 0)}</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Ionicons name="time-outline" size={14} color={C.textMuted} />
                <Text style={styles.modalStatText}>{formatDuration(recordingDataRef.current?.elapsedSeconds ?? 0)}</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Ionicons name="trending-up-outline" size={14} color={C.textMuted} />
                <Text style={styles.modalStatText}>{formatElevation(recordingDataRef.current?.elevationGainMeters ?? 0)}</Text>
              </View>
            </View>
            <TextInput
              style={styles.titleInput}
              value={activityTitle}
              onChangeText={setActivityTitle}
              placeholder="Activity title"
              placeholderTextColor={C.textMuted}
            />
            <TextInput
              style={[styles.titleInput, styles.descInput]}
              value={activityDescription}
              onChangeText={setActivityDescription}
              placeholder="Description (optional)"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.sectionLabel}>Privacy</Text>
            <View style={styles.statusRow}>
              {(['public', 'followers_only', 'private'] as ActivityStatus[]).map((s) => {
                const active = activityStatus === s;
                const iconName = s === 'public' ? 'globe-outline' : s === 'followers_only' ? 'people-outline' : 'lock-closed-outline';
                const label = s === 'public' ? 'Public' : s === 'followers_only' ? 'Followers' : 'Private';
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                    onPress={() => setActivityStatus(s)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name={iconName as never} size={13} color={active ? C.primary : C.textSecondary} />
                      <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                        {label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 18, fontWeight: '500', color: '#4DD0E1', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 8, color: 'rgba(77,208,225,0.4)', fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.09, marginTop: 3 }}>
        {label}
      </Text>
    </View>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: 'rgba(0,188,212,0.07)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: 'center',
      marginHorizontal: 4,
    }}>
      <Text style={{ fontSize: 22, fontWeight: '500', color: accent ? '#4DD0E1' : '#fff', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 8, color: 'rgba(77,208,225,0.4)', fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.09, marginTop: 5 }}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(C: Colors, safeTop: number, panelMaxH: number, sportPickerBottom: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.surface,
    },
    map: {
      position: 'absolute',
      top: safeTop,
      left: 0,
      right: 0,
      bottom: 0,
    },
    markerDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.primary,
      borderWidth: 3,
      borderColor: '#fff',
    },
    sportPicker: {
      position: 'absolute',
      bottom: sportPickerBottom,
      left: 0,
      right: 0,
    },
    sportList: {
      paddingHorizontal: 12,
      gap: 8,
    },
    sportChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(4,12,18,0.88)',
      borderRadius: 50,
      paddingHorizontal: 12,
      paddingVertical: 7,
      gap: 4,
      borderWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
    },
    sportChipActive: {
      borderColor: 'rgba(0,188,212,0.55)',
      backgroundColor: 'rgba(0,188,212,0.14)',
    },
    sportLabel: { fontSize: 13, fontWeight: '400', color: C.textMuted },
    sportLabelActive: { color: C.primary, fontWeight: '500' },

    statsPanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: panelMaxH,
      backgroundColor: 'rgba(3,10,12,0.97)',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 24,
    },
    panelContent: {
      flex: 1,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 6,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(0,188,212,0.25)',
    },
    statsGroup: {
      flex: 1,
    },
    coreUnit: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    durationRow: {
      alignItems: 'center',
      paddingBottom: 16,
    },
    durationValue: {
      fontWeight: '500',
      color: '#fff',
      letterSpacing: -1.5,
    },
    durationLabel: {
      fontSize: 9,
      fontWeight: '400',
      color: 'rgba(77,208,225,0.45)',
      textTransform: 'uppercase',
      letterSpacing: 0.12,
      marginTop: 4,
    },
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,188,212,0.12)',
      paddingTop: 12,
    },
    pillDivider: {
      width: 1,
      height: 28,
      backgroundColor: 'rgba(0,188,212,0.15)',
    },
    controls: {
      alignItems: 'center',
      paddingVertical: 16,
      paddingBottom: 20,
    },
    startButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    startButtonText: {
      color: C.background,
      fontWeight: '700',
      fontSize: 15,
      letterSpacing: 1.5,
    },
    activeControls: {
      flexDirection: 'row',
      gap: 24,
      alignItems: 'center',
    },
    stopButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.danger,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stopIcon: {
      width: 22,
      height: 22,
      backgroundColor: '#fff',
      borderRadius: 3,
    },
    pauseButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.text,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resumeButton: { backgroundColor: C.success },
    pauseButtonText: { color: '#fff', fontSize: 22 },
    pauseIcon: { flexDirection: 'row', gap: 5 },
    pauseBar: { width: 6, height: 22, backgroundColor: '#fff', borderRadius: 3 },
    pausedBanner: {
      backgroundColor: C.warning,
      paddingVertical: 6,
      alignItems: 'center',
    },
    pausedText: {
      color: '#fff',
      fontWeight: '800',
      letterSpacing: 2,
      fontSize: 13,
    },
    extendedSection: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    extendedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    extendedLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.border,
    },
    extendedHeaderText: {
      fontSize: 10,
      fontWeight: '700',
      color: C.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    cardRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    modalContainer: { flex: 1, backgroundColor: '#030A0C' },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,188,212,0.15)',
    },
    modalTitle: { fontSize: 16, fontWeight: '500', color: C.text, letterSpacing: -0.2 },
    modalDiscard: { color: C.danger, fontSize: 14, fontWeight: '500' },
    modalSave: { color: C.primary, fontSize: 14, fontWeight: '500' },
    modalBody: { flex: 1, padding: 20 },
    modalStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      backgroundColor: 'rgba(0,188,212,0.07)',
    },
    modalStatItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    modalStatText: { fontSize: 13, fontWeight: '500', color: C.primary },
    titleInput: {
      backgroundColor: 'rgba(0,188,212,0.07)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: C.text,
      marginBottom: 12,
    },
    descInput: { height: 80, textAlignVertical: 'top' },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: C.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 4,
    },
    statusRow: { flexDirection: 'row', gap: 8 },
    statusChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: 'rgba(0,188,212,0.18)',
      alignItems: 'center',
      backgroundColor: 'rgba(0,188,212,0.05)',
    },
    statusChipActive: { borderColor: 'rgba(0,188,212,0.50)', backgroundColor: 'rgba(0,188,212,0.15)' },
    statusChipText: { fontSize: 12, fontWeight: '400', color: C.textMuted },
    statusChipTextActive: { color: C.primary, fontWeight: '500' },
  });
}
