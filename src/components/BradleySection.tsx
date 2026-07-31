import { Activity, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useBradley, type BradleyPoint } from "@/lib/queries";

function formatDMY(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function computeTurns(points: BradleyPoint[]): BradleyPoint[] {
  const turns: BradleyPoint[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].value;
    const cur = points[i].value;
    const next = points[i + 1].value;
    if ((cur > prev && cur > next) || (cur < prev && cur < next)) {
      turns.push(points[i]);
    }
  }
  return turns;
}

export function BradleySection() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useBradley();

  const points = data?.points ?? [];
  const today = data?.today ?? "";
  const isEmpty = !isLoading && !isError && points.length === 0;

  const values = points.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = (max - min) * 0.12 || 1;

  const turns = computeTurns(points);
  const todayPoint = points.find((p) => p.date === today) ?? null;

  const config = {
    value: { label: t("sections.bradley.seriesLabel"), color: "var(--accent)" },
  } satisfies ChartConfig;

  const fmtFullDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "short",
    }).format(new Date(iso + "T00:00:00"));

  return (
    <Card className="rounded-2xl p-0">
      <CardHeader className="gap-1 space-y-0 p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <Activity size={15} className="text-accent" aria-hidden="true" />
          </span>
          <CardTitle className="text-base font-semibold leading-tight">
            {t("sections.bradley.title")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">{t("sections.bradley.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{t("sections.bradley.loadError")}</p>
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">{t("sections.bradley.empty")}</p>
        ) : (
          <ChartContainer config={config} className="aspect-[16/9] w-full">
            <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={formatDMY}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                domain={[min - pad, max + pad]}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) => {
                      const p = payload as Array<{ payload: BradleyPoint }>;
                      return p && p.length ? fmtFullDate(String(p[0].payload.date)) : "";
                    }}
                    formatter={(value) => Number(value as number).toFixed(2)}
                  />
                }
              />
              {todayPoint ? (
                <ReferenceLine
                  x={today}
                  stroke="var(--accent)"
                  strokeDasharray="4 3"
                  strokeOpacity={0.7}
                  label={{
                    value: t("sections.bradley.today"),
                    position: "insideTopRight",
                    fill: "var(--accent)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {turns.map((p) => (
                <ReferenceDot
                  key={p.date}
                  x={p.date}
                  y={p.value}
                  r={3}
                  fill="var(--accent)"
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              ))}
              {todayPoint ? (
                <ReferenceDot
                  x={todayPoint.date}
                  y={todayPoint.value}
                  r={4.5}
                  fill="var(--accent)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              ) : null}
            </LineChart>
          </ChartContainer>
        )}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={13}
              className="transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
            {t("sections.bradley.howTitle")}
          </summary>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {t("sections.bradley.howBody")}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
