import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import type { TrackPoint, SportType } from '@/lib/types';
import { trackDistance, trackElevationGain, encodePolyline } from '@/lib/utils';

const LOCATION_TASK = 'hermes-location-task';
// Points with a gap larger than this are treated as a new track segment
const SEGMENT_GAP_SECONDS = 10;

// Module-level: called by the background task for every location update.
// Using a module-level ref means the background task can deliver points even
// when the screen is off, without needing the React component to be active.
let _locationHandler: ((loc: LocationObject) => void) | null = null;

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, ({ data, error }: any) => {
    if (error || !data) return;
    const { locations } = data as { locations: LocationObject[] };
    for (const loc of locations) {
      _locationHandler?.(loc);
    }
  });
}

export interface RecordingStats {
  durationSeconds: number;
  distanceMeters: number;
  currentSpeedMps: number;
  elevationGainMeters: number;
  avgSpeedMps: number;
  avgPace: number;
}

interface UseActivityRecordingResult {
  isRecording: boolean;
  isPaused: boolean;
  stats: RecordingStats;
  track: TrackPoint[];
  sportType: SportType;
  setSportType: (s: SportType) => void;
  startRecording: () => Promise<boolean>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => RecordingData | null;
  locationPermission: boolean | null;
}

export interface RecordingData {
  track: TrackPoint[];
  distanceMeters: number;
  elapsedSeconds: number;
  movingSeconds: number;
  elevationGainMeters: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  startAt: string;
  polyline: string;
  latlng: [number, number][];
  altitude: number[];
  velocity: number[];
  timeStream: number[];
}

export function useActivityRecording(): UseActivityRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [stats, setStats] = useState<RecordingStats>({
    durationSeconds: 0,
    distanceMeters: 0,
    currentSpeedMps: 0,
    elevationGainMeters: 0,
    avgSpeedMps: 0,
    avgPace: 0,
  });
  const [sportType, setSportType] = useState<SportType>('run');
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const trackRef = useRef<TrackPoint[]>([]);
  const startAtRef = useRef<string>('');
  const maxSpeedRef = useRef(0);
  const isPausedRef = useRef(false);
  // Kept for the foreground-only fallback when background permission is denied
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status === 'granted');
    });
    return () => {
      // Safety cleanup if the component unmounts mid-recording
      _locationHandler = null;
      locationSubscription.current?.remove();
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
        .then((started) => { if (started) Location.stopLocationUpdatesAsync(LOCATION_TASK); })
        .catch(() => {});
    };
  }, []);

  function updateStats(currentTrack: TrackPoint[]) {
    if (!startTimeRef.current) return;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current - pausedDurationRef.current) / 1000;
    const distance = trackDistance(currentTrack);
    const elevGain = trackElevationGain(currentTrack);
    const lastPoint = currentTrack[currentTrack.length - 1];
    const currentSpeed = lastPoint?.speed ?? 0;
    const avgSpeed = elapsed > 0 ? distance / elapsed : 0;
    const avgPace = avgSpeed > 0 ? 1000 / avgSpeed : 0;

    if (currentSpeed > maxSpeedRef.current) {
      maxSpeedRef.current = currentSpeed;
    }

    setStats({ durationSeconds: elapsed, distanceMeters: distance, currentSpeedMps: currentSpeed, elevationGainMeters: elevGain, avgSpeedMps: avgSpeed, avgPace });
  }

  function makeLocationHandler() {
    return (loc: LocationObject) => {
      if (isPausedRef.current) return;

      const prev = trackRef.current[trackRef.current.length - 1];
      const gapSeconds = prev ? (loc.timestamp - prev.timestamp) / 1000 : 0;

      const point: TrackPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        speed: loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed : null,
        timestamp: loc.timestamp,
        newSegment: prev !== undefined && gapSeconds > SEGMENT_GAP_SECONDS,
      };

      trackRef.current = [...trackRef.current, point];
      setTrack([...trackRef.current]);
    };
  }

  async function startRecording(): Promise<boolean> {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(fgStatus === 'granted');
    if (fgStatus !== 'granted') return false;

    trackRef.current = [];
    maxSpeedRef.current = 0;
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    startAtRef.current = new Date().toISOString();
    setTrack([]);
    setIsRecording(true);
    setIsPaused(false);

    timerRef.current = setInterval(() => { updateStats(trackRef.current); }, 1000);

    const handler = makeLocationHandler();

    // Request background permission — if granted, use the background task so
    // tracking continues when the screen is off. Fall back to foreground-only.
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));

    if (bgStatus === 'granted') {
      // Stop any leftover task from a previous session
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
      if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

      _locationHandler = handler;
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Hermes',
          notificationBody: 'Recording your activity',
          notificationColor: '#2563EB',
        },
        pausesUpdatesAutomatically: false,
      });
    } else {
      // Foreground-only fallback — screen-off gaps will still be detected by
      // the SEGMENT_GAP_SECONDS check and won't draw straight lines.
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
        handler,
      );
    }

    return true;
  }

  function pauseRecording() {
    isPausedRef.current = true;
    setIsPaused(true);
    pauseStartRef.current = Date.now();
  }

  function resumeRecording() {
    isPausedRef.current = false;
    setIsPaused(false);
    if (pauseStartRef.current) {
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }

  function stopRecording(): RecordingData | null {
    if (!startTimeRef.current) return null;

    _locationHandler = null;
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const finalTrack = trackRef.current;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current - pausedDurationRef.current) / 1000;
    const distance = trackDistance(finalTrack);
    const elevGain = trackElevationGain(finalTrack);
    const avgSpeed = elapsed > 0 ? distance / elapsed : 0;

    const latlng: [number, number][] = finalTrack.map((p) => [p.latitude, p.longitude]);
    const altitude: number[] = finalTrack.map((p) => p.altitude ?? 0);
    const velocity: number[] = finalTrack.map((p) => p.speed ?? 0);
    const timeStream: number[] = finalTrack.map((p, i) =>
      i === 0 ? 0 : Math.round((p.timestamp - finalTrack[0].timestamp) / 1000)
    );
    const polyline = encodePolyline(latlng);

    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;

    return {
      track: finalTrack,
      distanceMeters: distance,
      elapsedSeconds: elapsed,
      movingSeconds: elapsed - pausedDurationRef.current / 1000,
      elevationGainMeters: elevGain,
      avgSpeedMps: avgSpeed,
      maxSpeedMps: maxSpeedRef.current,
      startAt: startAtRef.current,
      polyline,
      latlng,
      altitude,
      velocity,
      timeStream,
    };
  }

  return {
    isRecording, isPaused, stats, track, sportType, setSportType,
    startRecording, pauseRecording, resumeRecording, stopRecording, locationPermission,
  };
}
