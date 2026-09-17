import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useAuthStore } from "../store/authStore";
import { useCameraStreamUrl, useInferenceStreamUrl } from "../api/queries";
import { useLiveInferenceSessionStore } from "../store/liveInferenceSessionStore";
import { useLocale } from "../i18n/LocaleContext";

export function CameraView({ cameraId, onBack }: { cameraId: string; onBack: () => void }) {
  const { user } = useAuthStore();
  const { direction, t } = useLocale();

  // Live inference is started/stopped for all cameras at once from the
  // cameras page (see CameraList), not per camera — this view just reflects
  // whether the current camera is part of that running session. Only admins
  // can mint inference-stream tokens on the backend, so non-admins always
  // fall back to the plain live feed even if a session happens to be running.
  const isInferenceSessionRunning = useLiveInferenceSessionStore((s) => s.isRunning);
  const inferenceCameraIds = useLiveInferenceSessionStore((s) => s.cameraIds);
  const liveInferenceEnabled =
    user?.role === "super_admin" && isInferenceSessionRunning && inferenceCameraIds.includes(cameraId);

  const [inferenceStreamError, setInferenceStreamError] = useState(false);

  // Uses a short-lived, single-camera stream token (minted and re-minted
  // periodically) instead of the long-lived access token, so the token in
  // the <img> src never sits in browser history/logs for long and a
  // long-open live view keeps working past the access token's expiry.
  const { url: streamUrl, reconnect } = useCameraStreamUrl(cameraId);
  const inferenceStreamUrl = useInferenceStreamUrl(cameraId, liveInferenceEnabled);

  // Unknown until the first frame loads, since the camera's native
  // resolution/aspect ratio isn't known ahead of time — the box is sized to
  // match it (via naturalWidth/naturalHeight) instead of assuming 16:9, which
  // otherwise crops or letterboxes footage that isn't actually widescreen.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setAspectRatio(null);
    setInferenceStreamError(false);
  }, [cameraId]);

  const handleStreamLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setAspectRatio(naturalWidth / naturalHeight);
    }
  };

  const handleStreamError = (_event: SyntheticEvent<HTMLImageElement>) => {
    reconnect();
  };

  const handleInferenceStreamError = (_event: SyntheticEvent<HTMLImageElement>) => {
    setInferenceStreamError(true);
  };

  const showInference = liveInferenceEnabled && !inferenceStreamError && !!inferenceStreamUrl;

  return (
    <div className="p-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-inkDim hover:text-ink mb-4">
        <ArrowBackRoundedIcon className={direction === "rtl" ? "rotate-180" : ""} fontSize="small" /> {t("backToCameras")}
      </button>

      <div className="max-w-4xl">
        <div
          className={`relative rounded-xl overflow-hidden border border-border bg-black transition-shadow ${
            aspectRatio ? "" : "aspect-video"
          }`}
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          <span className={`absolute top-3 ${direction === "rtl" ? "right-3" : "left-3"} z-10 flex items-center gap-1.5 text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded-md`}>
            {showInference ? t("liveInference") : <><span className="live-dot" /> {t("live")}</>}
          </span>
          {showInference ? (
            <img
              src={inferenceStreamUrl!}
              alt={t("liveInference")}
              className="w-full h-full object-contain"
              onLoad={handleStreamLoad}
              onError={handleInferenceStreamError}
            />
          ) : streamUrl ? (
            <img
              src={streamUrl}
              alt={t("liveCameraFeed")}
              className="w-full h-full object-contain"
              onLoad={handleStreamLoad}
              onError={handleStreamError}
            />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-sm text-white/50">
              {t("connecting")}
            </div>
          )}
        </div>

        {liveInferenceEnabled && inferenceStreamError && (
          <p className="mt-4 text-xs text-danger font-medium">{t("inferenceFailed")}</p>
        )}
      </div>
    </div>
  );
}
