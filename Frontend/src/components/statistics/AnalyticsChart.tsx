"use client";

import { useMemo } from "react";
import { useT } from "@/i18n";
import type { PostStatisticsItem } from "@/types/statistics";

type AnalyticsChartProps = {
  posts: PostStatisticsItem[];
};

type Point = { x: number; y: number };

function buildPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

/**
 * Dual-series engagement chart from per-post save/share counts
 * (API has no time-series; posts are the available series axis).
 */
export default function AnalyticsChart({ posts }: AnalyticsChartProps) {
  const t = useT();

  const series = useMemo(() => {
    const source = posts.slice(0, 8);
    if (source.length === 0) return null;

    const width = 640;
    const height = 240;
    const padX = 28;
    const padTop = 24;
    const padBottom = 36;
    const plotW = width - padX * 2;
    const plotH = height - padTop - padBottom;
    const maxValue = Math.max(
      1,
      ...source.map((p) => Math.max(p.saveCount, p.shareCount)),
    );

    const toPoints = (values: number[]): Point[] =>
      values.map((value, index) => {
        const x =
          source.length === 1
            ? padX + plotW / 2
            : padX + (index / (source.length - 1)) * plotW;
        const y = padTop + plotH - (value / maxValue) * plotH;
        return { x, y };
      });

    const savePoints = toPoints(source.map((p) => p.saveCount));
    const sharePoints = toPoints(source.map((p) => p.shareCount));

    return {
      width,
      height,
      padTop,
      padBottom,
      padX,
      plotH,
      source,
      savePath: buildPath(savePoints),
      sharePath: buildPath(sharePoints),
      savePoints,
      sharePoints,
      maxValue,
    };
  }, [posts]);

  return (
    <section
      className="rounded-[1.25rem] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_0.5rem_1.5rem_rgba(90,55,45,0.05)] sm:p-5"
      data-testid="analytics-chart"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[var(--wesal-text)]">
          {t("statistics.chart.title")}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--wesal-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#e8a0a4]" aria-hidden="true" />
            {t("statistics.chart.saves")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--wesal-maroon-dark)]" aria-hidden="true" />
            {t("statistics.chart.shares")}
          </span>
        </div>
      </div>

      {!series ? (
        <p className="mt-8 text-center text-sm text-[var(--wesal-muted)]">
          {t("statistics.chart.empty")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${series.width} ${series.height}`}
            className="h-[14rem] w-full min-w-0 sm:min-w-[18rem]"
            role="img"
            aria-label={t("statistics.chart.title")}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = series.padTop + series.plotH * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={series.padX}
                  x2={series.width - series.padX}
                  y1={y}
                  y2={y}
                  stroke="rgba(140,100,90,0.12)"
                  strokeWidth="1"
                />
              );
            })}

            <path
              d={series.savePath}
              fill="none"
              stroke="#e8a0a4"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d={series.sharePath}
              fill="none"
              stroke="var(--wesal-maroon-dark)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {series.savePoints.map((point, index) => (
              <circle
                key={`save-${index}`}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="#e8a0a4"
              />
            ))}
            {series.sharePoints.map((point, index) => (
              <circle
                key={`share-${index}`}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="var(--wesal-maroon-dark)"
              />
            ))}

            {series.source.map((post, index) => {
              const x =
                series.source.length === 1
                  ? series.padX + (series.width - series.padX * 2) / 2
                  : series.padX +
                    (index / (series.source.length - 1)) *
                      (series.width - series.padX * 2);
              const label =
                post.content?.trim().slice(0, 10) ||
                t("statistics.chart.postLabel", { n: index + 1 });
              return (
                <text
                  key={post.postId}
                  x={x}
                  y={series.height - 10}
                  textAnchor="middle"
                  className="fill-[var(--wesal-muted)]"
                  style={{ fontSize: "0.7rem" }}
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
