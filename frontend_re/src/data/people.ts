import type { Person } from "./types";

export const PEOPLE: Person[] = [
  { id: "p1", name: "Ali Rezaei", nameFa: "علی رضایی", color: "#6366F1" },
  { id: "p2", name: "Maryam Karimi", nameFa: "مریم کریمی", color: "#14B8A6" },
  { id: "p3", name: "Hossein Ahmadi", nameFa: "حسین احمدی", color: "#0EA5E9" },
  { id: "p4", name: "Nasrin Tabrizi", nameFa: "نسرین تبریزی", color: "#A855F7" },
  { id: "p5", name: "Reza Moradi", nameFa: "رضا مرادی", color: "#F43F5E" },
  { id: "p0", name: "Unknown", nameFa: "ناشناس", color: "#64748B" },
];

export function personById(id: string): Person {
  return PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
}
