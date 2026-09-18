import type { AppUser } from "./types";

export const USERS: AppUser[] = [
  { name: "Sara Nasiri", nameFa: "سارا نصیری", handle: "operator.nasiri", role: "super_admin", lastSignIn: "14:02 today", active: true },
  { name: "Ali Rezaei", nameFa: "علی رضایی", handle: "a.rezaei", role: "level_1", lastSignIn: "11:48 today", active: true },
  { name: "Maryam Karimi", nameFa: "مریم کریمی", handle: "m.karimi", role: "level_2", lastSignIn: "Yesterday 17:20", active: true },
  { name: "Hossein Ahmadi", nameFa: "حسین احمدی", handle: "h.ahmadi", role: "level_2", lastSignIn: "3 days ago", active: false },
  { name: "Reza Moradi", nameFa: "رضا مرادی", handle: "r.moradi", role: "level_3", lastSignIn: "2 weeks ago", active: false },
];

export const ROLE_COLORS: Record<AppUser["role"], string> = {
  super_admin: "#6366F1",
  level_1: "#14B8A6",
  level_2: "#0EA5E9",
  level_3: "#7C89A0",
};
