export type ActionType = 'timer' | 'visionBoard' | 'customMessage';

// One optional-fields bag rather than a per-type discriminated union: the spec fixes
// this JSON shape, and plans are user-edited across types in plan-form (a union would
// force config resets on every type switch). Type safety for new ActionTypes comes from
// the exhaustive switches in app/execute/[planId].tsx and components/plan-form.tsx.
export interface ActionConfig {
  durationMinutes?: number;
  imageId?: string;
  message?: string;
}

export interface FailurePoint {
  id: string;
  label: string;
  isPreset: boolean;
}

export interface IfThenPlan {
  id: string;
  failurePointId: string;
  triggerDescription: string;
  actionType: ActionType;
  actionConfig: ActionConfig;
  createdAt: string; // ISO 8601 — stored as string because everything round-trips through JSON
}

export type TriggerSource = 'manual' | 'scheduled';
export type TriggerOutcome = 'helped' | 'didNotHelp';

export interface TriggerLog {
  id: string;
  planId: string;
  firedAt: string; // ISO 8601
  source: TriggerSource;
  outcome?: TriggerOutcome | null;
}

export interface VisionBoardImage {
  id: string;
  // Either a file:// URI under the app document directory, or a 'bundled:<key>'
  // sentinel resolved by lib/images.ts#getImageSource to a require()'d asset.
  uri: string;
  caption?: string;
}

export interface CheckInTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

// Every key lib/storage.ts can read/write. Adding a stored collection = add it here.
export type StorageSchema = {
  failurePoints: FailurePoint[];
  plans: IfThenPlan[];
  triggerLogs: TriggerLog[];
  visionBoardImages: VisionBoardImage[];
  checkInTimes: CheckInTime[];
  hasOnboarded: boolean;
};
