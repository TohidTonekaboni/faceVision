import type { Camera } from "./types";

export const CAMERAS: Camera[] = [
  { id: "c1", name: "Lobby — Main entrance", nameFa: "لابی — ورودی اصلی", zone: "Ground", zoneFa: "همکف", status: "online", inferenceOn: true, fps: "25 fps", host: "10.0.4.11", path: "/stream1", secured: true },
  { id: "c2", name: "Reception desk", nameFa: "میز پذیرش", zone: "Ground", zoneFa: "همکف", status: "online", inferenceOn: true, fps: "25 fps", host: "10.0.4.12", path: "/stream1", secured: true },
  { id: "c3", name: "Corridor B — East", nameFa: "راهرو B — شرق", zone: "Floor 2", zoneFa: "طبقه ۲", status: "online", inferenceOn: true, fps: "20 fps", host: "10.0.4.13", path: "/h264", secured: false },
  { id: "c4", name: "Server room door", nameFa: "درب اتاق سرور", zone: "Basement", zoneFa: "زیرزمین", status: "online", inferenceOn: true, fps: "25 fps", host: "10.0.4.21", path: "/stream1", secured: true },
  { id: "c5", name: "Parking ramp", nameFa: "رمپ پارکینگ", zone: "Exterior", zoneFa: "محوطه", status: "degraded", inferenceOn: false, fps: "11 fps", host: "10.0.4.31", path: "/stream2", secured: false },
  { id: "c6", name: "Loading bay", nameFa: "بارگیری", zone: "Exterior", zoneFa: "محوطه", status: "online", inferenceOn: true, fps: "25 fps", host: "10.0.4.32", path: "/stream1", secured: true },
  { id: "c7", name: "Cafeteria", nameFa: "سلف سرویس", zone: "Floor 1", zoneFa: "طبقه ۱", status: "offline", inferenceOn: false, fps: "—", host: "10.0.4.41", path: "/stream1", secured: false },
  { id: "c8", name: "Roof access", nameFa: "دسترسی پشت‌بام", zone: "Roof", zoneFa: "پشت‌بام", status: "online", inferenceOn: true, fps: "15 fps", host: "10.0.4.51", path: "/h264", secured: true },
  { id: "c9", name: "Stairwell C", nameFa: "راه‌پله C", zone: "Floor 3", zoneFa: "طبقه ۳", status: "online", inferenceOn: true, fps: "20 fps", host: "10.0.4.61", path: "/stream1", secured: false },
];

export function cameraById(id: string): Camera {
  return CAMERAS.find((c) => c.id === id) ?? CAMERAS[0];
}
