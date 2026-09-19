/** Live MJPEG stream URL hooks — thin re-export of the api/queries.ts
 * implementations so pages import stream helpers from `hooks/` like every
 * other data source in this app. There's no client-side detection-box data
 * to layer on top: the plain stream is the raw feed, and the inference
 * stream has boxes baked in server-side. */
export { useCameraStreamUrl, useInferenceStreamUrl } from "../api/queries";
