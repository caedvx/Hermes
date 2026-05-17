import { useState, useRef, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import type { LocationObject } from 'expo-location';
import type { TrackPoint, SportType } from '@/lib/types';
import { haversineDistance, trackDistance, trackElevationGain, encodePolyline } from '@/lib/utils';

export interface RecordingStats {
  durationSeconds: number;
  distanceMeters: number;
  currentSpeedMps: number;
  elevationGainMeters: number;
  avgSpeedMps: number;
  avgPace: number; // sec/km
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

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const trackRef = useRef<TrackPoint[]>([]);
  const startAtRef = useRef<string>('');
  const maxSpeedRef = useRef(0);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status === 'granted');
    });
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

    setStats({
      durationSeconds: elapsed,
      distanceMeters: distance,
      currentSpeedMps: currentSpeed,
      elevationGainMeters: elevGain,
      avgSpeedMps: avgSpeed,
      avgPace,
    });
  }

  async function startRecording(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    if (status !== 'granted') return false;

    trackRef.current = [];
    maxSpeedRef.current = 0;
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    startAtRef.current = new Date().toISOString();
    setTrack([]);
    setIsRecording(true);
    setIsPaused(false);

    // Start timer for duration display
    timerRef.current = setInterval(() => {
      updateStats(trackRef.current);
    }, 1000);

    // Start GPS
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (location: LocationObject) => {
        if (isPausedRef.current) return;

        const point: TrackPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          speed: location.coords.speed && location.coords.speed > 0 ? location.coords.speed : null,
          timestamp: location.timestamp,
        };

        trackRef.current = [...trackRef.current, point];
        setTrack([...trackRef.current]);
      }
    );
    return true;
  }

  const isPausedRef = useRef(false);

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

    // Cleanup
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const finalTrack = trackRef.current;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current - pausedDurationRef.current) / 1000;
    const distance = trackDistance(finalTrack);
    const elevGain = trackElevationGain(finalTrack);
    const avgSpeed = elapsed > 0 ? distance / elapsed : 0;

    // Build streams
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
    isRecording,
    isPaused,
    stats,
    track,
    sportType,
    setSportType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    locationPermission,
  };
}
