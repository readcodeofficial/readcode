"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FileSearch } from "lucide-react";
import type { JobMatch } from "@/lib/jobs";
import { areaName as areaLabel, jobTitle, topicName } from "@/lib/format";
import { LanguageBadge } from "@/components/language-badge";
import { ExerciseKindTag, questionsLabel } from "@/components/exercise-kind-tag";

const PREVIEW = 3;

// Distinct hues for a role's top topics; the rest are grey.
const TOPIC_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]; // theme tokens (globals.css)
const GREY = "color-mix(in oklch, var(--muted-foreground) 45%, transparent)";

// Chart heights are weight^PROFILE_POWER, scaled so the top concept is full height: raising to a power
// spreads out the upper range so the role's main topics stand clear of the trace ones.
const PROFILE_POWER = 3;

// A role in a company tile: its concept chart, its topic mix, and a few exercises.
// Hovering a topic (in the mix bar or legend) previews that topic's exercises and highlights it in the chart;
// clicking pins it until clicked again.
export default function RoleCard({ job }: { job: JobMatch }) {
    const [hovered, setHovered] = useState<string | null>(null);
    const [pinned, setPinned] = useState<string | null>(null);
    const [probe, setProbe] = useState<string | null>(null); // concept under the pointer in the chart
    const active = hovered ?? pinned;

    const withExamples = job.topics.filter((t) => t.examples.length > 0);
    const colored = withExamples.slice(0, PREVIEW).map((t) => t.label);
    const colorOf = (label: string) => (colored.includes(label) ? TOPIC_COLORS[colored.indexOf(label)] : GREY);
    const all = withExamples.flatMap((t) => t.examples);
    const minutes = all.reduce((s, e) => s + e.durationMinutes, 0);

    // default preview: one exercise from each of the top topics; with a topic active, that topic's exercises
    const activeTopic = job.topics.find((t) => t.label === active);
    const preview = activeTopic
        ? activeTopic.examples.slice(0, PREVIEW).map((e) => ({ ...e, topic: activeTopic.label }))
        : withExamples.slice(0, PREVIEW).map((t) => ({ ...t.examples[0], topic: t.label }));

    // topic mix widths come from the posting's weights (cubed like the chart), not from plan counts
    const size = (t: { weight: number }) => t.weight ** PROFILE_POWER;
    const total = job.topics.reduce((s, t) => s + size(t), 0) || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    const rest = job.topics.filter((t) => !colored.includes(t.label));
    const top = Math.max(...job.profile.map((p) => p.weight ** PROFILE_POWER)) || 1;
    const probed = job.profile.find((p) => p.label === probe);
    const inPlan = (label: string) => job.topics.some((t) => t.label === label);

    // shared handlers for anything that represents a topic
    const topicProps = (label: string) => ({
        onMouseEnter: () => setHovered(label),
        onMouseLeave: () => setHovered(null),
        onClick: () => setPinned((p) => (p === label ? null : label)),
    });
    const dim = (label: string) => active !== null && active !== label;

    return (
        <div className="rounded-lg border p-3">
            <Link href={`/jobs/${job.id}`} className="group block">
                <div className="truncate font-medium group-hover:underline" title={job.title}>{jobTitle(job.title)}</div>
                <div className="text-xs text-muted-foreground">
                    {job.location ? `${job.location} · ` : ""}{all.length} exercises · ~{Math.round(minutes / 60)} h
                </div>
            </Link>
            {job.languages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {job.languages.map((l) => <LanguageBadge key={l} language={l} />)}
                </div>
            )}

            {/* concept chart: every taxonomy concept, in taxonomy order; hover to read a bar */}
            <div className="mt-3 flex h-8 items-end gap-px" onMouseLeave={() => { setProbe(null); setHovered(null); }}>
                {job.profile.map((p) => (
                    <span
                        key={p.label}
                        onMouseEnter={() => { setProbe(p.label); setHovered(inPlan(p.label) ? p.label : null); }}
                        className="flex h-full min-w-0 flex-1 cursor-default items-end"
                    >
                        <span
                            className="block w-full rounded-t-[1px] transition-opacity duration-200"
                            style={{
                                height: p.weight > 0 ? `${Math.max(((p.weight ** PROFILE_POWER) / top) * 100, 3)}%` : "1px",
                                background: (p.label === active || p.label === probe) && !colored.includes(p.label) ? "var(--foreground)" : colored.includes(p.label) ? colorOf(p.label) : "var(--muted-foreground)",
                                opacity: probe ? (p.label === probe ? 1 : 0.25) : active ? (p.label === active ? 1 : 0.15) : colored.includes(p.label) ? 1 : p.weight > 0 ? 0.45 : 0.2,
                            }}
                        />
                    </span>
                ))}
            </div>
            <div className="mt-1 h-4 truncate text-[11px] text-muted-foreground">
                {probed
                    ? <>{areaLabel(probed.label)} › <span className="text-foreground">{topicName(probed.label)}</span> · {Math.round(probed.weight * 100)}%{inPlan(probed.label) ? " · in plan" : ""}</>
                    : null}
            </div>

            {/* topic mix: each segment is a topic's share of the plan */}
            <div className="mt-2 flex h-2 gap-0.5">
                {job.topics.map((t) => (
                    <button
                        key={t.label}
                        type="button"
                        aria-label={`${topicName(t.label)}: ${pct(size(t))}%`}
                        title={`${topicName(t.label)}: ${pct(size(t))}%`}
                        {...topicProps(t.label)}
                        className="cursor-pointer transition-all duration-200 first:rounded-l-full last:rounded-r-full"
                        style={{
                            width: `${(size(t) / total) * 100}%`,
                            background: t.label === active && !colored.includes(t.label) ? "var(--foreground)" : colorOf(t.label),
                            opacity: dim(t.label) ? 0.3 : 1,
                            transform: t.label === active ? "scaleY(1.75)" : undefined,
                        }}
                    />
                ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {colored.map((label) => (
                    <li key={label}>
                        <button
                            type="button"
                            {...topicProps(label)}
                            className={`flex cursor-pointer items-center gap-1.5 transition-opacity ${dim(label) ? "opacity-40" : ""} ${pinned === label ? "underline underline-offset-4" : ""}`}
                        >
                            <span className="size-2 rounded-full" style={{ background: colorOf(label) }} />
                            <span className="text-foreground">{topicName(label)}</span>
                            {pct(size(job.topics.find((t) => t.label === label)!))}%
                        </button>
                    </li>
                ))}
                {rest.length > 0 && (
                    <li className={`flex items-center gap-1.5 ${active && colored.includes(active) ? "opacity-40" : ""}`} title={rest.map((t) => topicName(t.label)).join(", ")}>
                        <span className="size-2 rounded-full" style={{ background: GREY }} />
                        {rest.length} more topics {pct(rest.reduce((s, t) => s + size(t), 0))}%
                    </li>
                )}
            </ul>

            {/* exercises: the active topic's, or one from each top topic */}
            <div className="mt-3 h-4 text-xs text-muted-foreground">
                {activeTopic && `${topicName(activeTopic.label)} · ${activeTopic.examples.length} exercises${pinned ? " · click again to clear" : ""}`}
            </div>
            <ul className="text-sm">
                {preview.map((e) => (
                    <li key={e.name}>
                        <Link
                            href={`/examples/${encodeURIComponent(e.name)}`}
                            title={e.title}
                            className="group/row -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                            <FileSearch className="size-5 shrink-0 text-muted-foreground group-hover/row:text-foreground" />
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate">{e.shortName}</span>
                                    <LanguageBadge language={e.language} />
                                    <ExerciseKindTag kind={e.kind} />
                                </span>
                                <span className="block text-xs text-muted-foreground">{questionsLabel(e.questionCount)} · {e.durationMinutes} min</span>
                            </span>
                            <span className="size-2 shrink-0 rounded-full" style={{ background: activeTopic && !colored.includes(e.topic) ? "var(--foreground)" : colorOf(e.topic) }} title={topicName(e.topic)} />
                            {/* a round chevron that widens into "Practice" on hover */}
                            <span className="flex h-7 shrink-0 items-center rounded-full border px-1.5 text-foreground transition-all duration-200 group-hover/row:border-foreground/40 group-hover/row:pl-3">
                                <span className="max-w-0 overflow-hidden text-xs font-medium whitespace-nowrap opacity-0 transition-all duration-200 group-hover/row:mr-1 group-hover/row:max-w-20 group-hover/row:opacity-100">
                                    Practice
                                </span>
                                <ChevronRight className="size-4" />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            {all.length > PREVIEW && (
                <Link href={`/jobs/${job.id}`} className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground">
                    +{all.length - PREVIEW} more exercises →
                </Link>
            )}
        </div>
    );
}
