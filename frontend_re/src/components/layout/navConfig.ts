import type { Dict } from "../../i18n/en";
import type { Lang } from "../../i18n";
import { formatDigits } from "../../i18n";
import type { Role } from "../../store/appStore";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  badge?: string;
  isActive: (pathname: string) => boolean;
}

export interface NavGroup {
  title: string;
  admin: boolean;
  items: NavItem[];
}

export function buildNavGroups(t: Dict, lang: Lang, role: Role, defaultCameraId: string): NavGroup[] {
  const fd = (v: string | number) => formatDigits(lang, v);

  const groups: NavGroup[] = [
    {
      title: t.nav_overview,
      admin: false,
      items: [
        {
          key: "dashboard",
          label: t.nav_dashboard,
          href: "/dashboard",
          isActive: (p) => p === "/dashboard",
        },
      ],
    },
    {
      title: t.nav_live,
      admin: false,
      items: [
        {
          key: "cameras",
          label: t.nav_cams,
          href: "/cameras",
          isActive: (p) => p.startsWith("/cameras"),
        },
        {
          key: "focus",
          label: t.nav_wall,
          href: `/cameras/${defaultCameraId}`,
          isActive: (p) => /^\/cameras\/.+/.test(p),
        },
      ],
    },
    {
      title: t.nav_analysis,
      admin: false,
      items:
        role === "level_3"
          ? [{ key: "annotation", label: t.nav_annotation, href: "/annotation", badge: fd(42), isActive: (p) => p === "/annotation" }]
          : [
              { key: "reporting", label: t.nav_reporting, href: "/reporting", badge: fd(7), isActive: (p) => p === "/reporting" },
              { key: "annotation", label: t.nav_annotation, href: "/annotation", badge: fd(42), isActive: (p) => p === "/annotation" },
              { key: "offline", label: t.nav_offline, href: "/offline", isActive: (p) => p === "/offline" },
            ],
    },
  ];

  if (role === "super_admin") {
    groups.push({
      title: t.nav_admin,
      admin: true,
      items: [
        { key: "camman", label: t.nav_camman, href: "/camera-management", isActive: (p) => p === "/camera-management" },
        { key: "users", label: t.nav_users, href: "/users", isActive: (p) => p === "/users" },
      ],
    });
  }

  return groups;
}

export function crumbFor(t: Dict, pathname: string): string {
  if (pathname === "/dashboard") return t.nav_dashboard;
  if (pathname === "/cameras" || /^\/cameras\/.+/.test(pathname)) return t.nav_cams;
  if (pathname === "/reporting") return t.nav_reporting;
  if (pathname === "/annotation") return t.nav_annotation;
  if (pathname === "/offline") return t.nav_offline;
  if (pathname === "/camera-management") return t.nav_camman;
  if (pathname === "/users") return t.nav_users;
  return "";
}
