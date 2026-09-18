import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useAppStore } from "../../store/appStore";
import { t } from "../../i18n";

const STORAGE_PREFIX = "facevision-image-slot:";

function readSlot(id: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id);
  } catch {
    return null;
  }
}

function writeSlot(id: string, dataUrl: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, dataUrl);
  } catch {
    // storage full or unavailable — the slot still shows the image for this session
  }
}

export type ImageSlotShape = "rect" | "rounded" | "circle";

interface ImageSlotProps {
  id: string;
  shape?: ImageSlotShape;
  radius?: number;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  /** Fires whenever the slot's filled state changes — lets a parent reveal overlays only once an image has landed. */
  onFilledChange?: (filled: boolean) => void;
}

/**
 * Drop target that shows a filled image once one lands, persisted to localStorage
 * by id so it survives reloads — a lightweight stand-in for the design prototype's
 * server-backed image-slot custom element, since this app is frontend-only.
 */
export function ImageSlot({ id, shape = "rect", radius, placeholder, className, style, onFilledChange }: ImageSlotProps) {
  const lang = useAppStore((s) => s.lang);
  const [src, setSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSrc(readSlot(id));
  }, [id]);

  useEffect(() => {
    onFilledChange?.(!!src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        writeSlot(id, dataUrl);
        setSrc(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [id],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const borderRadius = shape === "circle" ? "50%" : shape === "rounded" ? `${radius ?? 8}px` : 0;

  return (
    <div
      className={className}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius,
        overflow: "hidden",
        cursor: "pointer",
        backgroundColor: "#05080F",
        backgroundImage: src ? `url("${src}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
      {!src && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 8,
            fontSize: 10.5,
            lineHeight: 1.4,
            color: "var(--fv-faint)",
            border: dragging ? "1.5px dashed #818CF8" : "1.5px dashed rgba(148,163,184,.28)",
            background: dragging ? "rgba(99,102,241,.08)" : "transparent",
            borderRadius,
          }}
        >
          {placeholder}
        </div>
      )}
      {src && dragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10.5,
            color: "#fff",
            background: "rgba(4,7,14,.55)",
          }}
        >
          {t(lang).drop_replace}
        </div>
      )}
    </div>
  );
}
