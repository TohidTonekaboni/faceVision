import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import { useRunOfflineInference } from "../api/queries";
import type { InferenceDetection } from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

export default function OfflineInference() {
  const { t } = useLocale();
  const runInference = useRunOfflineInference();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<InferenceDetection[] | null>(null);
  const [error, setError] = useState(false);

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResultImage(null);
    setDetections(null);
    setError(false);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const handleRunInference = () => {
    if (!selectedFile) return;
    setError(false);
    runInference.mutate(selectedFile, {
      onSuccess: (data) => {
        setResultImage(`data:image/jpeg;base64,${data.image}`);
        setDetections(data.detections);
      },
      onError: () => {
        setResultImage(null);
        setDetections(null);
        setError(true);
      },
    });
  };

  const displayedImage = resultImage ?? previewUrl;

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold mb-1">{t("offlineInference")}</h1>
      <p className="text-sm text-inkDim mb-6">{t("offlineInferenceDescription")}</p>

      <div className="max-w-4xl">
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video flex items-center justify-center">
          {displayedImage ? (
            <img src={displayedImage} alt={t("offlineInference")} className="w-full h-full object-contain" />
          ) : (
            <span className="text-sm text-white/50">{t("noImageSelected")}</span>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

        <div className="mt-4 flex items-center gap-3">
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={handleChooseFile}>
            {t("chooseImage")}
          </Button>
          <Button
            variant="contained"
            startIcon={<CropFreeRoundedIcon />}
            onClick={handleRunInference}
            disabled={!selectedFile || runInference.isPending}
          >
            {runInference.isPending ? t("runningInference") : t("runInference")}
          </Button>
          {detections !== null && (
            <span className="text-xs text-success font-medium">
              {t("detectionsFound", { count: String(detections.length) })}
            </span>
          )}
          {error && <span className="text-xs text-danger font-medium">{t("inferenceFailed")}</span>}
        </div>

        {selectedFile && <p className="mt-2 text-xs text-inkDim truncate">{selectedFile.name}</p>}

        {detections !== null && detections.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden">
            {detections.map((detection, index) => (
              <li key={index} className="flex items-center justify-between px-4 py-2 text-sm bg-surface">
                <span className="font-medium">{detection.label}</span>
                <span className="text-inkDim">{(detection.confidence * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
