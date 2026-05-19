export type SportType = 'run' | 'ride' | 'swim' | 'hike' | 'walk' | 'other';
export type ActivityStatus = 'public' | 'followers_only' | 'private';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
}

export interface Activity {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  sport_type: SportType;
  status: ActivityStatus;
  start_at: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  elevation_gain: number | null;
  avg_speed: number | null;
  max_speed: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  avg_power: number | null;
  calories: number | null;
  map_polyline: string | null;
  storage_path: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface ActivityStream {
  activity_id: string;
  latlng: [number, number][];
  altitude: number[] | null;
  heartrate: number[] | null;
  cadence: number[] | null;
  watts: number[] | null;
  distance: number[] | null;
  velocity: number[] | null;
  time: number[] | null;
}

export interface Kudo {
  user_id: string;
  activity_id: string;
}

export interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface Follow {
  follower_id: string;
  following_id: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'kudo' | 'comment' | 'follow' | 'segment_pr';
  activity_id: string | null;
  segment_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile;
}

// GPS tracking types for live recording
export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
  newSegment?: boolean; // true when there's a tracking gap before this point
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedDuration: number;
  pauseStart: number | null;
  track: TrackPoint[];
  distance: number;
  currentSpeed: number;
  sportType: SportType;
}

export type GroupPrivacy = 'public' | 'private';
export type GroupRole = 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  sport_type: SportType | null;
  privacy: GroupPrivacy;
  created_by: string;
  created_at: string;
  avatar_url: string | null;
  member_count: number;
  my_membership?: { role: GroupRole } | null;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profiles?: Profile;
}

// Minimal Database type for Supabase client generic
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'id'>; Update: Partial<Profile> };
      activities: { Row: Activity; Insert: Omit<Activity, 'id' | 'created_at'>; Update: Partial<Activity> };
      activity_streams: { Row: ActivityStream; Insert: ActivityStream; Update: Partial<ActivityStream> };
      kudos: { Row: Kudo; Insert: Kudo; Update: Partial<Kudo> };
      comments: { Row: Comment; Insert: Omit<Comment, 'id' | 'created_at'>; Update: Partial<Comment> };
      follows: { Row: Follow; Insert: Follow; Update: Partial<Follow> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> };
      groups: { Row: Group; Insert: Omit<Group, 'id' | 'created_at' | 'member_count' | 'my_membership'>; Update: Partial<Group> };
      group_members: { Row: GroupMember; Insert: Omit<GroupMember, 'joined_at'>; Update: Partial<GroupMember> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
