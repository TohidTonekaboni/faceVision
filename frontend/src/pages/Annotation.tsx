import { useEffect, useState } from "react";
import { Button, TextField, Chip, IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  useSnapshots,
  useLabels,
  useCreateLabel,
  useDeleteLabel,
  useAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useDeleteSnapshot,
  useCompleteSnapshot,
  useSnapshotImageUrl,
  Snapshot,
  Label,
} from "../api/queries";
import { useLocale } from "../i18n/LocaleContext";

const LABEL_PALETTE = ["#4F46E5", "#0D9488", "#D97706", "#DC2626", "#7C3AED", "#0891B2"];

export default function Annotation() {
  const { data: snapshots } = useSnapshots(undefined, false);
  const { data: labels } = useLabels();
  const createLabel = useCreateLabel();
  const deleteLabel = useDeleteLabel();
  const [newLabel, setNewLabel] = useState("");
  const [labelDeleteError, setLabelDeleteError] = useState<string | null>(null);
  // Holds the full snapshot, not just an id looked up in `snapshots` — that
  // list is filtered to unannotated ones, and creating the *first*
  // annotation on the active snapshot flips it to annotated server-side,
  // dropping it out of this list. Keying off a live lookup made the image
  // vanish after drawing exactly one box, breaking multi-object annotation.
  // Keeping the selected snapshot as its own state means it stays visible
  // and annotatable until the user deliberately picks a different one.
  const [active, setActive] = useState<Snapshot | null>(null);
  const { t } = useLocale();

  const SNAPSHOTS_PER_PAGE = 20;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil((snapshots?.length ?? 0) / SNAPSHOTS_PER_PAGE));
  const pagedSnapshots = snapshots?.slice(
    page * SNAPSHOTS_PER_PAGE,
    page * SNAPSHOTS_PER_PAGE + SNAPSHOTS_PER_PAGE
  );

  // Clamp back onto a valid page whenever the list shrinks (e.g. a snapshot
  // is deleted or completed off the last page).
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  // Only auto-picks a snapshot when nothing is selected yet (initial load,
  // or after the active snapshot was deleted) — never overrides a
  // deliberate/in-progress selection just because it left this filtered list.
  useEffect(() => {
    if (!active && snapshots && snapshots.length > 0) {
      setActive(snapshots[0]);
    }
  }, [snapshots, active]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">{t("annotation")}</h1>
      <p className="text-sm text-inkDim mb-6">{t("annotationDescription")}</p>

      <div className="mb-1 flex flex-wrap items-center gap-2 bg-surface border border-border rounded-xl p-4">
        <span className="text-xs font-semibold text-inkDim tracking-wide mx-1">{t("labels")}</span>
        {labels?.map((l) => (
          <Chip
            key={l.id}
            label={l.name}
            sx={{ bgcolor: l.color, color: "#fff", "& .MuiChip-deleteIcon": { color: "#fff" } }}
            onDelete={() => {
              setLabelDeleteError(null);
              deleteLabel.mutate(l.id, {
                onError: () => setLabelDeleteError(t("labelInUseError")),
              });
            }}
          />
        ))}
        <div className="flex items-center gap-2 mx-2">
          <TextField
            size="small"
            placeholder={t("newLabelName")}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={!newLabel}
            onClick={() => {
              const color = LABEL_PALETTE[(labels?.length ?? 0) % LABEL_PALETTE.length];
              createLabel.mutate({ name: newLabel, color });
              setNewLabel("");
            }}
          >
            {t("addLabel")}
          </Button>
        </div>
      </div>
      <div className="mb-6 mx-1 min-h-[1rem]">
        {labelDeleteError && <p className="text-xs text-danger">{labelDeleteError}</p>}
      </div>

      <div className="flex gap-6 items-start">
        <aside className="w-72 shrink-0 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">
              {t("unannotatedSnapshots")} {snapshots ? `(${snapshots.length})` : ""}
            </h2>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
            {pagedSnapshots?.map((s) => (
              <SnapshotListItem
                key={s.id}
                snapshot={s}
                active={s.id === active?.id}
                onClick={() => setActive(s)}
                onDeleted={() => {
                  if (active?.id === s.id) setActive(null);
                }}
              />
            ))}
            {snapshots?.length === 0 && <p className="p-4 text-sm text-inkDim">{t("noSnapshots")}</p>}
          </div>
          {snapshots && snapshots.length > SNAPSHOTS_PER_PAGE && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border">
              <IconButton
                size="small"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeftRoundedIcon fontSize="small" />
              </IconButton>
              <span className="text-xs text-inkDim">{t("pageOf", { page: String(page + 1), total: String(pageCount) })}</span>
              <IconButton
                size="small"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRightRoundedIcon fontSize="small" />
              </IconButton>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0">
          {active ? (
            <AnnotationCanvas snapshot={active} labels={labels ?? []} onSaved={() => setActive(null)} />
          ) : (
            <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl text-sm text-inkDim">
              {t("selectSnapshotPrompt")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SnapshotListItem({
  snapshot,
  active,
  onClick,
  onDeleted,
}: {
  snapshot: Snapshot;
  active: boolean;
  onClick: () => void;
  onDeleted: () => void;
}) {
  const imageUrl = useSnapshotImageUrl(snapshot.id);
  const deleteSnapshot = useDeleteSnapshot();
  const { t } = useLocale();
  return (
    <div
      className={`group w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
        active ? "bg-primary/10" : "hover:bg-subtle"
      }`}
    >
      <button onClick={onClick} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="w-16 h-12 shrink-0 rounded-md overflow-hidden bg-subtle border border-border">
          {imageUrl && <img src={imageUrl} className="w-full h-full object-cover" alt={t("snapshot")} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{snapshot.camera_name}</p>
          <p className="text-xs text-inkDim truncate">
            {new Date(snapshot.created_at).toLocaleString()}
            {snapshot.image_width && snapshot.image_height
              ? ` · ${snapshot.image_width}×${snapshot.image_height}`
              : ""}
          </p>
        </div>
      </button>
      <IconButton
        size="small"
        aria-label={t("deleteSnapshot")}
        onClick={(e) => {
          e.stopPropagation();
          deleteSnapshot.mutate(snapshot.id, { onSuccess: onDeleted });
        }}
        className="opacity-0 group-hover:opacity-100 text-danger"
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </div>
  );
}

function AnnotationCanvas({
  snapshot,
  labels,
  onSaved,
}: {
  snapshot: Snapshot;
  labels: Label[];
  onSaved: () => void;
}) {
  const { data: annotations } = useAnnotations(snapshot.id);
  const createAnnotation = useCreateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const completeSnapshot = useCompleteSnapshot();
  const [selectedLabel, setSelectedLabel] = useState(labels[0]?.id ?? "");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imageUrl = useSnapshotImageUrl(snapshot.id);
  const { t } = useLocale();

  useEffect(() => {
    if (!selectedLabel && labels[0]) setSelectedLabel(labels[0].id);
  }, [labels, selectedLabel]);

  useEffect(() => {
    setSaveError(null);
  }, [snapshot.id]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDrawStart({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setDrawRect({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      w: Math.abs(x - drawStart.x),
      h: Math.abs(y - drawStart.y),
    });
  };

  const handleMouseUp = () => {
    if (drawRect && selectedLabel && drawRect.w > 0.01 && drawRect.h > 0.01) {
      createAnnotation.mutate({
        snapshot_id: snapshot.id,
        label_id: selectedLabel,
        x: drawRect.x,
        y: drawRect.y,
        width: drawRect.w,
        height: drawRect.h,
      });
    }
    setDrawStart(null);
    setDrawRect(null);
  };

  const labelById = (id: string) => labels.find((l) => l.id === id);
  const drawingLabel = labelById(selectedLabel);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-sm text-inkDim">{t("label")}</span>
        {labels.map((l) => (
          <Chip
            key={l.id}
            label={l.name}
            onClick={() => setSelectedLabel(l.id)}
            variant={selectedLabel === l.id ? "filled" : "outlined"}
            sx={{
              bgcolor: selectedLabel === l.id ? l.color : "transparent",
              color: selectedLabel === l.id ? "#fff" : l.color,
              borderColor: l.color,
            }}
          />
        ))}
        {labels.length === 0 && <span className="text-sm text-inkDim">{t("createLabelFirst")}</span>}
      </div>

      <div
        className="relative max-w-3xl select-none cursor-crosshair border border-border rounded-xl overflow-hidden bg-subtle"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            className="w-full block pointer-events-none"
            alt={t("snapshotToAnnotate")}
            draggable={false}
          />
        )}
        {drawRect && (
          <div
            className="absolute border-2"
            style={{
              left: `${drawRect.x * 100}%`,
              top: `${drawRect.y * 100}%`,
              width: `${drawRect.w * 100}%`,
              height: `${drawRect.h * 100}%`,
              borderColor: drawingLabel?.color ?? "#4F46E5",
              backgroundColor: `${drawingLabel?.color ?? "#4F46E5"}1a`,
            }}
          >
            {drawingLabel && (
              <span
                className="absolute -top-5 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm text-white whitespace-nowrap"
                style={{ backgroundColor: drawingLabel.color }}
              >
                {drawingLabel.name}
              </span>
            )}
          </div>
        )}
        {annotations?.map((a) => {
          const label = labelById(a.label_id);
          return (
            <div
              key={a.id}
              className="absolute border-2 group"
              style={{
                left: `${a.x * 100}%`,
                top: `${a.y * 100}%`,
                width: `${a.width * 100}%`,
                height: `${a.height * 100}%`,
                borderColor: label?.color ?? "#4F46E5",
              }}
            >
              <span
                className="absolute -top-5 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm text-white"
                style={{ backgroundColor: label?.color ?? "#4F46E5" }}
              >
                {label?.name ?? t("fallbackLabel")}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAnnotation.mutate(a.id);
                }}
                className="absolute -top-5 right-0 text-white bg-danger rounded-sm opacity-0 group-hover:opacity-100 p-0.5"
              >
                <CloseRoundedIcon sx={{ fontSize: 12 }} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <p className="text-xs text-inkDim">{t("drawHelp")}</p>
        <div className="flex-1" />
        <Button
          variant="contained"
          size="small"
          disabled={!annotations?.length || completeSnapshot.isPending}
          onClick={() => {
            setSaveError(null);
            completeSnapshot.mutate(snapshot.id, {
              onSuccess: onSaved,
              onError: () => setSaveError(t("saveSnapshotError")),
            });
          }}
        >
          {completeSnapshot.isPending ? t("saving") : t("saveAnnotations")}
        </Button>
      </div>
      {saveError && <p className="text-xs text-danger mt-1">{saveError}</p>}
    </div>
  );
}
