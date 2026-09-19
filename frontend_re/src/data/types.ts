/** UI-facing shapes consumed by pages/components. Proper nouns (camera
 * names, person names, usernames, filenames) come straight from the API and
 * are never translated — only fixed UI copy/enum labels get an i18n lookup,
 * sourced from `i18n/en.ts` / `i18n/fa.ts` by a stable key, not stored on
 * the record itself. */
export type CameraStatus = "online" | "offline";

export interface Camera {
  id: string;
  name: string;
  zone: string | null;
  status: CameraStatus;
  secured: boolean;
}

export interface Person {
  id: string;
  name: string;
  isUnknown: boolean;
  color: string;
}

export type UserRole = "super_admin" | "level_1" | "level_2" | "level_3";
