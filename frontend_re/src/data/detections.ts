import type { DetectionBox, DetectionEvent, ReportRow } from "./types";

/** Dashboard live detection feed (dashVals().feed in the source). */
export const FEED_ROWS: DetectionEvent[] = [
  { person: "Ali Rezaei", personFa: "علی رضایی", cameraId: "c1", seen: "14:32:04", confidence: "98.6%", unknown: false },
  { person: "Unknown", personFa: "ناشناس", cameraId: "c5", seen: "14:31:48", confidence: "71.2%", unknown: true },
  { person: "Maryam Karimi", personFa: "مریم کریمی", cameraId: "c3", seen: "14:30:11", confidence: "96.1%", unknown: false },
  { person: "Hossein Ahmadi", personFa: "حسین احمدی", cameraId: "c4", seen: "14:28:57", confidence: "94.8%", unknown: false },
  { person: "Unknown", personFa: "ناشناس", cameraId: "c6", seen: "14:27:30", confidence: "64.5%", unknown: true },
  { person: "Nasrin Tabrizi", personFa: "نسرین تبریزی", cameraId: "c2", seen: "14:26:02", confidence: "97.4%", unknown: false },
  { person: "Ali Rezaei", personFa: "علی رضایی", cameraId: "c8", seen: "14:24:41", confidence: "95.0%", unknown: false },
];

export const NOTIFICATIONS = [
  { slot: "fv-n0", person: "Ali Rezaei", personFa: "علی رضایی", camera: "Lobby — Main entrance", cameraFa: "لابی — ورودی اصلی", ago: "12s" },
  { slot: "fv-n1", person: "Unknown", personFa: "ناشناس", camera: "Parking ramp", cameraFa: "رمپ پارکینگ", ago: "48s" },
  { slot: "fv-n2", person: "Maryam Karimi", personFa: "مریم کریمی", camera: "Corridor B — East", cameraFa: "راهرو B — شرق", ago: "2m" },
  { slot: "fv-n3", person: "Hossein Ahmadi", personFa: "حسین احمدی", camera: "Server room door", cameraFa: "درب اتاق سرور", ago: "4m" },
];

export const SYSTEM_HEALTH = [
  { label: "RTSP streams", labelFa: "جریان‌های RTSP", value: "11 / 12", status: "online" as const },
  { label: "Inference worker", labelFa: "کارگر استنتاج", value: "running", valueFa: "فعال", status: "online" as const },
  { label: "Processing latency", labelFa: "تأخیر پردازش", value: "142 ms", status: "online" as const },
  { label: "Snapshot queue", labelFa: "صف عکس‌ها", value: "42", status: "degraded" as const },
  { label: "Storage", labelFa: "فضای ذخیره", value: "68%", status: "online" as const },
];

export const TOP_PEOPLE = [
  { slot: "fv-top-0", name: "Ali Rezaei", nameFa: "علی رضایی", count: "412", pct: 100 },
  { slot: "fv-top-1", name: "Maryam Karimi", nameFa: "مریم کریمی", count: "388", pct: 94 },
  { slot: "fv-top-2", name: "Hossein Ahmadi", nameFa: "حسین احمدی", count: "241", pct: 58 },
  { slot: "fv-top-3", name: "Nasrin Tabrizi", nameFa: "نسرین تبریزی", count: "176", pct: 42 },
];

export const DASH_STATS = [
  { label: "Cameras online", labelFa: "دوربین‌های فعال", value: "11", unit: "/ 12", delta: "+1", up: true, pct: 92 },
  { label: "Detections today", labelFa: "شناسایی امروز", value: "1,284", unit: "events", unitFa: "رویداد", delta: "+18%", up: true, pct: 74 },
  { label: "Distinct people", labelFa: "افراد متمایز", value: "37", unit: "people", unitFa: "نفر", delta: "+4", up: true, pct: 48 },
  { label: "Unrecognised", labelFa: "ناشناس", value: "9%", unit: "of detections", unitFa: "از شناسایی‌ها", delta: "-2%", up: false, pct: 9 },
];

export function focusBoxes(): DetectionBox[] {
  return [
    { label: "Ali Rezaei", labelFa: "علی رضایی", confidence: "98.6%", color: "#14B8A6", left: "18%", top: "26%", width: "13%", height: "34%" },
    { label: "Maryam Karimi", labelFa: "مریم کریمی", confidence: "96.1%", color: "#6366F1", left: "52%", top: "30%", width: "12%", height: "30%" },
    { label: "Unknown", labelFa: "ناشناس", confidence: "68.3%", color: "#F59E0B", left: "76%", top: "44%", width: "10%", height: "24%" },
  ];
}

export const CAM_RECENT = [
  { slot: "fv-cr-0", person: "Ali Rezaei", personFa: "علی رضایی", seen: "14:32:04" },
  { slot: "fv-cr-1", person: "Maryam Karimi", personFa: "مریم کریمی", seen: "14:30:11" },
  { slot: "fv-cr-2", person: "Unknown", personFa: "ناشناس", seen: "14:22:58" },
  { slot: "fv-cr-3", person: "Nasrin Tabrizi", personFa: "نسرین تبریزی", seen: "14:18:40" },
];

/** Reporting screen source data (repVals().DATA): date, personId, cameraId, first, last, count. */
export const REPORT_DAYS = [
  "2025-10-06",
  "2025-10-07",
  "2025-10-08",
  "2025-10-09",
  "2025-10-10",
  "2025-10-11",
  "2025-10-12",
];

export const REPORT_DATA: ReportRow[] = [
  { date: "2025-10-12", personId: "p1", cameraId: "c1", first: "08:12:40", last: "17:48:02", count: 412 },
  { date: "2025-10-12", personId: "p2", cameraId: "c3", first: "08:31:15", last: "17:12:44", count: 388 },
  { date: "2025-10-12", personId: "p0", cameraId: "c5", first: "09:02:08", last: "16:55:31", count: 142 },
  { date: "2025-10-12", personId: "p3", cameraId: "c4", first: "07:58:22", last: "18:04:19", count: 241 },
  { date: "2025-10-12", personId: "p4", cameraId: "c2", first: "08:44:57", last: "17:30:06", count: 176 },
  { date: "2025-10-11", personId: "p5", cameraId: "c6", first: "10:11:03", last: "15:22:48", count: 98 },
  { date: "2025-10-11", personId: "p0", cameraId: "c8", first: "11:20:44", last: "14:58:12", count: 74 },
  { date: "2025-10-11", personId: "p1", cameraId: "c3", first: "12:05:31", last: "16:40:29", count: 61 },
  { date: "2025-10-10", personId: "p2", cameraId: "c1", first: "08:19:02", last: "17:02:55", count: 301 },
  { date: "2025-10-10", personId: "p3", cameraId: "c9", first: "09:41:18", last: "16:12:07", count: 154 },
  { date: "2025-10-09", personId: "p1", cameraId: "c4", first: "08:04:44", last: "18:20:31", count: 366 },
  { date: "2025-10-09", personId: "p0", cameraId: "c5", first: "13:38:26", last: "14:02:09", count: 38 },
  { date: "2025-10-08", personId: "p4", cameraId: "c6", first: "08:52:13", last: "17:44:50", count: 212 },
  { date: "2025-10-08", personId: "p5", cameraId: "c2", first: "09:15:40", last: "15:58:22", count: 127 },
  { date: "2025-10-07", personId: "p2", cameraId: "c8", first: "08:27:31", last: "17:19:04", count: 289 },
  { date: "2025-10-07", personId: "p0", cameraId: "c7", first: "12:44:02", last: "13:10:55", count: 22 },
  { date: "2025-10-06", personId: "p1", cameraId: "c1", first: "08:09:58", last: "17:52:41", count: 404 },
  { date: "2025-10-06", personId: "p3", cameraId: "c3", first: "09:33:07", last: "16:48:19", count: 198 },
];
