import { useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { Button } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import { useAuthStore } from "../store/authStore";
import { useCameraStreamUrl, useRunInference } from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

const INFERENCE_RESULT_DISPLAY_MS = 10_000;

export function CameraView({ cameraId, onBack }: { cameraId: string; onBack: () => void }) {
  const { user } = useAuthStore();
  const runInference = useRunInference();
  const { direction, t } = useLocale();

  // Base64 data URL of the annotated frame while it's temporarily shown in
  // place of the live stream; null means the live stream is showing.
  const [inferenceImage, setInferenceImage] = useState<string | null>(null);
  const [inferenceDetectionCount, setInferenceDetectionCount] = useState<number | null>(null);
  const [inferenceError, setInferenceError] = useState(false);
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Uses a short-lived, single-camera stream token (minted and re-minted
  // periodically) instead of the long-lived access token, so the token in
  // the <img> src never sits in browser history/logs for long and a
  // long-open live view keeps working past the access token's expiry.
  const { url: streamUrl, reconnect } = useCameraStreamUrl(cameraId);

  // Unknown until the first frame loads, since the camera's native
  // resolution/aspect ratio isn't known ahead of time — the box is sized to
  // match it (via naturalWidth/naturalHeight) instead of assuming 16:9, which
  // otherwise crops or letterboxes footage that isn't actually widescreen.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setAspectRatio(null);
    setInferenceImage(null);
    setInferenceDetectionCount(null);
    setInferenceError(false);
    clearTimeout(restoreTimeoutRef.current);
  }, [cameraId]);

  useEffect(
    () => () => {
      clearTimeout(restoreTimeoutRef.current);
    },
    []
  );

  const handleStreamLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setAspectRatio(naturalWidth / naturalHeight);
    }
  };

  const handleStreamError = (_event: SyntheticEvent<HTMLImageElement>) => {
    reconnect();
  };

  const handleInference = () => {
    setInferenceError(false);
    runInference.mutate(cameraId, {
      onSuccess: (data) => {
        setInferenceImage(`data:image/jpeg;base64,${data.image}`);
        setInferenceDetectionCount(data.detections.length);
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = setTimeout(() => {
          setInferenceImage(null);
          setInferenceDetectionCount(null);
        }, INFERENCE_RESULT_DISPLAY_MS);
      },
      onError: () => {
        setInferenceImage(null);
        setInferenceDetectionCount(null);
        setInferenceError(true);
      },
    });
  };

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
            {inferenceImage ? t("inferenceResult") : <><span className="live-dot" /> {t("live")}</>}
          </span>
          {inferenceImage ? (
            <img src={inferenceImage} alt={t("inferenceResult")} className="w-full h-full object-contain" />
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

        {user?.role === "super_admin" && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="contained"
              startIcon={<CropFreeRoundedIcon />}
              onClick={handleInference}
              disabled={runInference.isPending}
            >
              {runInference.isPending ? t("runningInference") : t("runInference")}
            </Button>
            {inferenceDetectionCount !== null && (
              <span className="text-xs text-success font-medium">{t("detectionsFound", { count: String(inferenceDetectionCount) })}</span>
            )}
            {inferenceError && <span className="text-xs text-danger font-medium">{t("inferenceFailed")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
