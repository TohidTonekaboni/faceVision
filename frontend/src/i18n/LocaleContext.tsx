import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "fa";

const translations = {
  en: {
    language: "Language",
    liveRecognition: "Live recognition & capture",
    cameras: "Cameras",
    annotation: "Annotation",
    cameraManagement: "Camera Management",
    userManagement: "User Management",
    signOut: "Sign out",
    signInDescription: "Sign in to view live camera feeds",
    username: "Username",
    password: "Password",
    signingIn: "Signing in…",
    signIn: "Sign in",
    loginFailed: "Login failed. Check your credentials.",
    loadingCameras: "Loading cameras…",
    selectFeed: "Select a feed to view it live.",
    live: "LIVE",
    online: "online",
    offline: "offline",
    noCamerasConfigured: "No cameras configured yet. Ask an administrator to add one.",
    backToCameras: "Back to cameras",
    connecting: "Connecting…",
    liveCameraFeed: "Live camera feed",
    takeSnapshot: "Snapshot",
    stopSnapshot: "Stop",
    savedForAnnotation: "Saved for annotation.",
    captureFailed: "Could not capture frame.",
    selectCamerasForSnapshot: "Select Cameras for Snapshot",
    selectCamerasForSnapshotDescription: "Choose which cameras should participate. A snapshot is captured from every selected camera once per second.",
    startSnapshotSession: "Start Snapshot",
    noCamerasToSelect: "No cameras registered yet.",
    snapshotSessionRunning: "Snapshot session running ({count} camera(s))",
    runInference: "Inference",
    runningInference: "Running inference…",
    inferenceResult: "Detection result",
    inferenceFailed: "Could not run inference.",
    detectionsFound: "{count} detection(s) found.",
    annotationDescription: "Draw bounding boxes on captured snapshots and tag them with a label.",
    labels: "Labels",
    newLabelName: "New label name",
    addLabel: "Add label",
    noSnapshots: "No unannotated snapshots yet. Capture one from a camera's live view.",
    snapshot: "snapshot",
    backToSnapshots: "Back to snapshots",
    unannotatedSnapshots: "Unannotated Snapshots",
    selectSnapshotPrompt: "Select a snapshot from the sidebar to start annotating.",
    deleteSnapshot: "Delete snapshot",
    labelInUseError: "This label is used by existing annotations and cannot be deleted.",
    saveAnnotations: "Save",
    saving: "Saving...",
    saveSnapshotError: "Could not save annotations. Please try again.",
    label: "Label:",
    createLabelFirst: "Create a label above to start tagging.",
    snapshotToAnnotate: "snapshot to annotate",
    fallbackLabel: "label",
    drawHelp: "Click and drag on the image to draw a box for the selected label.",
    cameraManagementDescription: "Register, edit, and remove RTSP cameras.",
    addCamera: "Add camera",
    name: "Name",
    address: "Address",
    active: "Active",
    secured: "secured",
    noRegisteredCameras: "No cameras registered yet. Click “Add camera” to connect your first RTSP feed.",
    editCamera: "Edit camera",
    hostIp: "Host / IP",
    port: "Port",
    streamPath: "Stream path",
    streamPathHelp: "The part of the RTSP URL after host:port, e.g. /stream1",
    leavePasswordBlank: "Leave blank to keep current",
    activeVisible: "Active (visible to viewers)",
    cancel: "Cancel",
    saveChanges: "Save changes",
    requiredCameraFields: "Name and host/IP are required.",
    saveCameraFailed: "Could not save camera.",
    deleteCamera: "Delete camera?",
    deleteCameraDescription: "This removes {name} permanently. Past snapshots are kept for history but will no longer be linked to a live camera.",
    delete: "Delete",
    userManagementDescription: "Create accounts and control access roles.",
    fullName: "Full name",
    role: "Role",
    addUser: "Add user",
    noUsers: "No users yet.",
    superAdmin: "Super Admin",
    level1: "Level 1",
    level2: "Level 2",
    level3: "Level 3",
    pageOf: "Page {page} of {total}",
    previous: "Previous",
    next: "Next",
  },
  fa: {
    language: "زبان",
    liveRecognition: "تشخیص و ثبت زنده",
    cameras: "دوربین‌ها",
    annotation: "برچسب‌گذاری",
    cameraManagement: "مدیریت دوربین‌ها",
    userManagement: "مدیریت کاربران",
    signOut: "خروج",
    signInDescription: "برای مشاهده زنده دوربین‌ها وارد شوید",
    username: "نام کاربری",
    password: "رمز عبور",
    signingIn: "در حال ورود…",
    signIn: "ورود",
    loginFailed: "ورود ناموفق بود. نام کاربری و رمز عبور را بررسی کنید.",
    loadingCameras: "در حال بارگذاری دوربین‌ها…",
    selectFeed: "برای مشاهده زنده، یک دوربین را انتخاب کنید.",
    live: "زنده",
    online: "آنلاین",
    offline: "آفلاین",
    noCamerasConfigured: "هنوز دوربینی تنظیم نشده است. از مدیر سامانه بخواهید یک دوربین اضافه کند.",
    backToCameras: "بازگشت به دوربین‌ها",
    connecting: "در حال اتصال…",
    liveCameraFeed: "پخش زنده دوربین",
    takeSnapshot: "ثبت تصویر",
    stopSnapshot: "توقف",
    savedForAnnotation: "برای برچسب‌گذاری ذخیره شد.",
    captureFailed: "ثبت تصویر ناموفق بود.",
    selectCamerasForSnapshot: "انتخاب دوربین‌ها برای ثبت تصویر",
    selectCamerasForSnapshotDescription: "دوربین‌هایی که باید مشارکت کنند را انتخاب کنید. از هر دوربین انتخاب‌شده هر یک ثانیه یک تصویر ثبت می‌شود.",
    startSnapshotSession: "شروع ثبت تصویر",
    noCamerasToSelect: "هنوز دوربینی ثبت نشده است.",
    snapshotSessionRunning: "ثبت تصویر در حال اجراست ({count} دوربین)",
    runInference: "تشخیص هوشمند",
    runningInference: "در حال تشخیص…",
    inferenceResult: "نتیجه تشخیص",
    inferenceFailed: "تشخیص هوشمند ناموفق بود.",
    detectionsFound: "{count} مورد شناسایی شد.",
    annotationDescription: "روی تصاویر ثبت‌شده کادر بکشید و برای آن‌ها برچسب تعیین کنید.",
    labels: "برچسب‌ها",
    newLabelName: "نام برچسب جدید",
    addLabel: "افزودن برچسب",
    noSnapshots: "هنوز تصویر بدون برچسبی وجود ندارد. از نمای زنده دوربین یک تصویر ثبت کنید.",
    snapshot: "تصویر ثبت‌شده",
    backToSnapshots: "بازگشت به تصاویر",
    unannotatedSnapshots: "تصاویر بدون برچسب",
    selectSnapshotPrompt: "برای شروع برچسب‌گذاری، یک تصویر را از نوار کناری انتخاب کنید.",
    deleteSnapshot: "حذف تصویر",
    labelInUseError: "این برچسب در حاشیه‌نویسی‌های موجود استفاده شده و قابل حذف نیست.",
    saveAnnotations: "ذخیره",
    saving: "در حال ذخیره...",
    saveSnapshotError: "ذخیره حاشیه‌نویسی‌ها ناموفق بود. دوباره تلاش کنید.",
    label: "برچسب:",
    createLabelFirst: "برای شروع، ابتدا یک برچسب در بالا بسازید.",
    snapshotToAnnotate: "تصویر برای برچسب‌گذاری",
    fallbackLabel: "برچسب",
    drawHelp: "برای رسم کادر برچسب انتخاب‌شده، روی تصویر کلیک کنید و بکشید.",
    cameraManagementDescription: "دوربین‌های RTSP را ثبت، ویرایش یا حذف کنید.",
    addCamera: "افزودن دوربین",
    name: "نام",
    address: "نشانی",
    active: "فعال",
    secured: "محافظت‌شده",
    noRegisteredCameras: "هنوز دوربینی ثبت نشده است. برای اتصال اولین دوربین RTSP روی «افزودن دوربین» بزنید.",
    editCamera: "ویرایش دوربین",
    hostIp: "میزبان / IP",
    port: "درگاه",
    streamPath: "مسیر پخش",
    streamPathHelp: "بخش بعد از host:port در نشانی RTSP، برای نمونه /stream1",
    leavePasswordBlank: "برای حفظ رمز فعلی خالی بگذارید",
    activeVisible: "فعال (قابل مشاهده برای کاربران)",
    cancel: "انصراف",
    saveChanges: "ذخیره تغییرات",
    requiredCameraFields: "نام و میزبان/IP الزامی است.",
    saveCameraFailed: "ذخیره دوربین ناموفق بود.",
    deleteCamera: "دوربین حذف شود؟",
    deleteCameraDescription: "دوربین {name} برای همیشه حذف می‌شود. تصاویر قبلی در تاریخچه می‌مانند، اما دیگر به دوربین زنده متصل نخواهند بود.",
    delete: "حذف",
    userManagementDescription: "حساب‌های کاربری را بسازید و سطح دسترسی آن‌ها را کنترل کنید.",
    fullName: "نام کامل",
    role: "نقش",
    addUser: "افزودن کاربر",
    noUsers: "هنوز کاربری وجود ندارد.",
    superAdmin: "مدیر ارشد",
    level1: "سطح ۱",
    level2: "سطح ۲",
    level3: "سطح ۳",
    pageOf: "صفحه {page} از {total}",
    previous: "قبلی",
    next: "بعدی",
  },
} as const;

type TranslationKey = keyof typeof translations.en;
type LocaleContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: Record<string, string>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem("facevision_locale") === "fa" ? "fa" : "en"
  );
  const direction = locale === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    localStorage.setItem("facevision_locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.title = locale === "fa" ? "فیس‌ویژن" : "FaceVision";
  }, [locale, direction]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction,
      setLocale,
      t: (key, values) => {
        let text: string = translations[locale][key];
        Object.entries(values ?? {}).forEach(([name, value]) => {
          text = text.replace(`{${name}}`, value);
        });
        return text;
      },
    }),
    [locale, direction]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
