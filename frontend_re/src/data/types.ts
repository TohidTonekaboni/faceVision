export type CameraStatus = "online" | "degraded" | "offline";

export interface Camera {
  id: string;
  name: string;
  nameFa: string;
  zone: string;
  zoneFa: string;
  status: CameraStatus;
  inferenceOn: boolean;
  fps: string;
  host: string;
  path: string;
  secured: boolean;
}

export interface Person {
  id: string;
  name: string;
  nameFa: string;
  color: string;
}

export interface DetectionEvent {
  person: string;
  personFa: string;
  unknown: boolean;
  cameraId: string;
  seen: string;
  confidence: string;
}

export interface ReportRow {
  date: string;
  personId: string;
  cameraId: string;
  first: string;
  last: string;
  count: number;
}

export type UserRole = "super_admin" | "level_1" | "level_2" | "level_3";

export interface AppUser {
  name: string;
  nameFa: string;
  handle: string;
  role: UserRole;
  lastSignIn: string;
  active: boolean;
}

export interface DetectionBox {
  label: string;
  labelFa: string;
  confidence: string;
  color: string;
  left: string;
  top: string;
  width: string;
  height: string;
}
