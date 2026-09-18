import { useQuery } from "@tanstack/react-query";
import { delay } from "../data/mockApi";
import { computeTimeline, summarize, type ReportFilters } from "../data/reportEngine";
import type { Lang } from "../i18n";
import { formatDigits } from "../i18n";

export function useReportData(filters: ReportFilters, lang: Lang) {
  return useQuery({
    queryKey: ["report", filters, lang],
    queryFn: () => {
      const summary = summarize(filters);
      const timeline = computeTimeline(summary, filters, (v) => formatDigits(lang, v));
      return delay({ summary, timeline });
    },
    placeholderData: (prev) => prev,
  });
}
