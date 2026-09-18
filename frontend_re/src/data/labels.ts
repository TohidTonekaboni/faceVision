import { CAMERAS } from "./cameras";

export interface AnnotationLabel {
  id: string;
  name: string;
  nameFa: string;
  color: string;
  key: string;
}

export const LABELS: AnnotationLabel[] = [
  { id: "l1", name: "Face", nameFa: "چهره", color: "#6366F1", key: "1" },
  { id: "l2", name: "Masked face", nameFa: "چهره با ماسک", color: "#14B8A6", key: "2" },
  { id: "l3", name: "Profile", nameFa: "نیم‌رخ", color: "#0EA5E9", key: "3" },
  { id: "l4", name: "Uniform", nameFa: "یونیفرم", color: "#A855F7", key: "4" },
  { id: "l5", name: "Ignore", nameFa: "نادیده", color: "#7C89A0", key: "5" },
];

export const ANNOTATION_QUEUE = [0, 1, 2, 3, 4, 5].map((i) => {
  const cam = CAMERAS[i % CAMERAS.length];
  return {
    slot: `fv-q-${i}`,
    cam: cam.name,
    camFa: cam.nameFa,
    meta: `14:0${i}:22 · 1920×1080`,
    active: i === 0,
  };
});

export const ANNOTATION_BOXES = [
  { label: "Face", labelFa: "چهره", color: "#6366F1", left: "14%", top: "7%", width: "15%", height: "26%" },
  { label: "Masked face", labelFa: "چهره با ماسک", color: "#14B8A6", left: "58%", top: "9%", width: "13%", height: "24%" },
];

export const OFFLINE_ROWS = [
  { label: "Ali Rezaei", labelFa: "علی رضایی", confidence: "98.2%", color: "#14B8A6", pct: 98, left: "6%", top: "7%" },
  { label: "Maryam Karimi", labelFa: "مریم کریمی", confidence: "91.7%", color: "#6366F1", pct: 92, left: "38%", top: "5%" },
  { label: "Unknown", labelFa: "ناشناس", confidence: "58.4%", color: "#F59E0B", pct: 58, left: "70%", top: "9%" },
];

export const OFFLINE_HISTORY = [
  { slot: "fv-h-0", file: "entrance_cctv_1412.jpg", meta: "14:12 · 284 ms", faces: 3 },
  { slot: "fv-h-1", file: "gate_b_0904.jpg", meta: "09:04 · 261 ms", faces: 1 },
  { slot: "fv-h-2", file: "visitor_badge.png", meta: "08:41 · 302 ms", faces: 1 },
  { slot: "fv-h-3", file: "lobby_group.jpg", meta: "Yesterday · 355 ms", faces: 6 },
];
