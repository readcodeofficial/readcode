"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExampleSummary } from "@/lib/examples";
import { areaOf, areaTitle, pct, topicName } from "@/lib/format";
import { useToggleSet } from "@/lib/useToggleSet";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DataTable, ExpandChevron, FilterBar, RowArrow } from "@/components/data-table";
import { LanguageBadge } from "@/components/language-badge";
import { ExerciseKindTag, questionsLabel } from "@/components/exercise-kind-tag";

// A one-line description per module (top-level area). Modules are listed alphabetically (no implied sequence).
const BLURBS: Record<string, string> = {
    api: "Contracts with callers: validation, idempotency, versioning and status codes.",
    caching: "Freshness, expiry and stampedes when you keep copies of data.",
    concurrency: "Races, locks and async pitfalls when work overlaps.",
    config: "Settings, flags and environments that change behaviour without a deploy.",
    data: "Transactions, queries and schemas, where correctness and money live.",
    design: "Interfaces, layering and coupling: whether code is shaped to change safely.",
    distributed: "Sharding, replication and consistency across services.",
    errors: "How failures travel: propagation, context, cleanup, and errors that vanish.",
    integrations: "Talking to systems you don't own: adapters and webhooks.",
    messaging: "Queues and consumers: delivery guarantees, ordering and backpressure.",
    observability: "Logs, metrics and traces that let you see what happened.",
    performance: "Finding the hot path and the work that doesn't need doing.",
    realtime: "Fan-out to many live connections.",
    resilience: "Timeouts, retries and limits that keep failures contained.",
    resources: "Memory, handles, buffers and cancellation: what leaks under load.",
    security: "Who can do what: auth, injection, secrets and tenant isolation.",
    testing: "What a test proves, what it misses, and why it flakes.",
};

// A role the curriculum can be narrowed to: its plan's topics with their weights.
export type RoleOption = { id: string; label: string; topics: { label: string; weight: number }[] };

// Comprehension exercises take ~10–16 min; bug-fix exercises (more code, plus running tests) ~18–22.
const LENGTHS = [
    { id: "", label: "Any length", test: () => true },
    { id: "short", label: "Short · up to 12 min", test: (m: number) => m <= 12 },
    { id: "medium", label: "Medium · 13–16 min", test: (m: number) => m >= 13 && m <= 16 },
    { id: "long", label: "Long · 17 min or more", test: (m: number) => m >= 17 },
];

// Shared column layout for every row of the table: [toggle] [topic] [match] [exercises] [time] [action]
const ROW = "grid grid-cols-[1rem_minmax(0,1fr)_3.5rem_4.5rem_4rem_2rem] items-center gap-x-3 px-4";

// The exercise bank as a table: modules (top-level areas) as group rows, units (topics) as rows, exercises
// nested under units. Filters prune it: modules and units with no matches are hidden.
export default function ExampleBrowser({ examples, roles }: { examples: ExampleSummary[]; roles: RoleOption[] }) {
    const [query, setQuery] = useState("");
    const [moduleFilter, setModuleFilter] = useState("");
    const [roleId, setRoleId] = useState("");
    const [length, setLength] = useState("");
    const [language, setLanguage] = useState("");
    // modules start open; units start closed, but open while filtering (a click flips that default)
    const [collapsedModules, toggleModule] = useToggleSet();
    const [flippedUnits, toggleUnit] = useToggleSet();

    // grouping and search keys depend only on the bank, not on filters or open/closed state
    const tree = useMemo(
        () =>
            [...Map.groupBy(examples, (e) => areaOf(e.topic)).entries()]
                .sort(([a], [b]) => areaTitle(a).localeCompare(areaTitle(b)))
                .map(([area, all]) => ({ area, all, units: [...Map.groupBy(all, (e) => e.topic).entries()] })),
        [examples],
    );
    const searchKey = useMemo(
        () => new Map(examples.map((e) => [e.name, `${e.shortName} ${e.title} ${topicName(e.topic)} ${areaOf(e.topic)} ${e.language}`.toLowerCase()])),
        [examples],
    );
    // languages in the bank, most examples first
    const languages = useMemo(
        () => [...Map.groupBy(examples, (e) => e.language).entries()].sort((a, b) => b[1].length - a[1].length).map(([l, list]) => ({ l, n: list.length })),
        [examples],
    );

    const role = roles.find((r) => r.id === roleId);
    const roleWeight = new Map(role?.topics.map((t) => [t.label, t.weight]));
    const lengthOpt = LENGTHS.find((l) => l.id === length)!;
    const q = query.trim().toLowerCase();
    const matches = (e: ExampleSummary) =>
        (!q || searchKey.get(e.name)!.includes(q)) &&
        (!moduleFilter || areaOf(e.topic) === moduleFilter) &&
        (!role || roleWeight.has(e.topic)) &&
        (!language || e.language === language) &&
        lengthOpt.test(e.durationMinutes);

    const modules = tree
        .map((m) => {
            // with a role, units follow the role's weights; otherwise the biggest units come first
            const units = m.units
                .map(([topic, list]) => ({ topic, list, shown: list.filter(matches) }))
                .sort((a, b) => (role ? (roleWeight.get(b.topic) ?? 0) - (roleWeight.get(a.topic) ?? 0) : 0) || b.list.length - a.list.length);
            return { ...m, units, shown: units.reduce((s, x) => s + x.shown.length, 0) };
        })
        .filter((m) => m.shown > 0);
    const total = modules.reduce((s, m) => s + m.shown, 0);

    const active = [
        q && { key: "q", label: `"${query.trim()}"`, clear: () => setQuery("") },
        moduleFilter && { key: "m", label: areaTitle(moduleFilter), clear: () => setModuleFilter("") },
        role && { key: "r", label: role.label, clear: () => setRoleId("") },
        language && { key: "lang", label: language, clear: () => setLanguage("") },
        length && { key: "l", label: lengthOpt.label, clear: () => setLength("") },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
    const unitOpen = (topic: string) => (active.length > 0) !== flippedUnits.has(topic);

    return (
        <div>
            <FilterBar
                query={query}
                onQuery={setQuery}
                placeholder="Search exercises or topics"
                shown={total}
                total={examples.length}
                noun="exercises"
                footer={
                    active.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {active.map((f) => (
                                <Button key={f.key} variant="outline" size="xs" onClick={f.clear} className="max-w-72 rounded-full">
                                    <span className="truncate">{f.label}</span> <X data-icon="inline-end" />
                                </Button>
                            ))}
                            <Button variant="link" size="xs" onClick={() => active.forEach((f) => f.clear())} className="text-muted-foreground">
                                Clear all
                            </Button>
                        </div>
                    )
                }
            >
                <NativeSelect aria-label="Module" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                    <NativeSelectOption value="">All modules</NativeSelectOption>
                    {tree.map((m) => <NativeSelectOption key={m.area} value={m.area}>{areaTitle(m.area)}</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <NativeSelectOption value="">All languages</NativeSelectOption>
                    {languages.map(({ l, n }) => <NativeSelectOption key={l} value={l}>{l} ({n})</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className="max-w-60">
                    <NativeSelectOption value="">Any role</NativeSelectOption>
                    {roles.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.label}</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect aria-label="Length" value={length} onChange={(e) => setLength(e.target.value)}>
                    {LENGTHS.map((l) => <NativeSelectOption key={l.id} value={l.id}>{l.label}</NativeSelectOption>)}
                </NativeSelect>
            </FilterBar>

            {modules.length === 0 ? (
                <p className="mt-16 text-center text-muted-foreground">No exercises match these filters.</p>
            ) : (
                <DataTable
                    label="Exercises"
                    cols={ROW}
                    headers={
                        <>
                            <span />
                            <span role="columnheader">Topic</span>
                            <span role="columnheader" className="text-right">{role ? "Match" : ""}</span>
                            <span role="columnheader" className="text-right">Exercises</span>
                            <span role="columnheader" className="text-right">Time</span>
                            <span />
                        </>
                    }
                >
                    {modules.map((m) => {
                        const open = !collapsedModules.has(m.area);
                        const minutes = m.all.reduce((s, e) => s + e.durationMinutes, 0);
                        return (
                            <div key={m.area} role="rowgroup">
                                {/* module: a shaded group row */}
                                <button
                                    type="button"
                                    role="row"
                                    onClick={() => toggleModule(m.area)}
                                    aria-expanded={open}
                                    className={cn(ROW, "group w-full border-b bg-muted/50 py-3 text-left hover:bg-muted/70")}
                                >
                                    <ExpandChevron open={open} />
                                    <span className="min-w-0">
                                        <span className="block font-semibold">{areaTitle(m.area)}</span>
                                        {BLURBS[m.area] && <span className="block truncate text-xs text-muted-foreground">{BLURBS[m.area]}</span>}
                                    </span>
                                    <span />
                                    <span className="text-right text-sm tabular-nums">{m.shown < m.all.length ? `${m.shown} / ${m.all.length}` : m.all.length}</span>
                                    <span className="text-right text-sm text-muted-foreground tabular-nums">~{Math.max(1, Math.round(minutes / 60))} h</span>
                                    <span />
                                </button>

                                {open &&
                                    m.units
                                        .filter((x) => x.shown.length > 0)
                                        .map(({ topic, list, shown }) => {
                                            const unitIsOpen = unitOpen(topic);
                                            return (
                                                <div key={topic} role="rowgroup">
                                                    {/* unit row */}
                                                    <button
                                                        type="button"
                                                        role="row"
                                                        onClick={() => toggleUnit(topic)}
                                                        aria-expanded={unitIsOpen}
                                                        className={cn(ROW, "group w-full border-b py-2 text-left text-sm hover:bg-muted/30")}
                                                    >
                                                        <span />
                                                        <span className="flex min-w-0 items-center gap-2 pl-1">
                                                            <ExpandChevron open={unitIsOpen} className="size-3.5 group-hover:text-muted-foreground" />
                                                            <span className="truncate">{topicName(topic)}</span>
                                                        </span>
                                                        <span className="text-right text-xs text-muted-foreground tabular-nums">
                                                            {role && roleWeight.has(topic) ? pct(roleWeight.get(topic)!) : ""}
                                                        </span>
                                                        <span className="text-right tabular-nums">{shown.length < list.length ? `${shown.length} / ${list.length}` : list.length}</span>
                                                        <span className="text-right text-muted-foreground tabular-nums">{list.reduce((s, e) => s + e.durationMinutes, 0)} min</span>
                                                        <span />
                                                    </button>
                                                    {/* exercise rows */}
                                                    {unitIsOpen && shown.map((e) => <ExampleRow key={e.name} example={e} />)}
                                                </div>
                                            );
                                        })}
                            </div>
                        );
                    })}
                </DataTable>
            )}
        </div>
    );
}

function ExampleRow({ example: e }: { example: ExampleSummary }) {
    return (
        <Link
            href={`/examples/${encodeURIComponent(e.name)}`}
            title={e.title}
            role="row"
            className={cn(ROW, "group/row border-b bg-muted/10 py-1.5 text-sm last:border-b-0 hover:bg-muted/40")}
        >
            <span />
            <span className="flex min-w-0 items-center gap-2 pl-7">
                <FileSearch className="size-4 shrink-0 text-muted-foreground group-hover/row:text-foreground" />
                <span className="truncate">{e.shortName}</span>
                <LanguageBadge language={e.language} />
                <ExerciseKindTag kind={e.kind} />
            </span>
            <span />
            <span className="text-right text-xs text-muted-foreground tabular-nums">{questionsLabel(e.questionCount)}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{e.durationMinutes} min</span>
            <RowArrow />
        </Link>
    );
}
