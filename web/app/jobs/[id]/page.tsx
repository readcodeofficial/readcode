import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, ExternalLink, FileSearch } from "lucide-react";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle, topicName } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { logoFor } from "@/lib/companies";
import { LanguageBadge } from "@/components/language-badge";
import { ExerciseKindTag, questionsLabel } from "@/components/exercise-kind-tag";

// A role's practice plan: the posting's topics, how central each is, and the exercises for it.
export default function RolePage({ params }: PageProps<"/jobs/[id]">) {
    return (
        <main className="mx-auto w-full max-w-3xl px-6 py-10">
            <Suspense fallback={<p className="text-muted-foreground">loading…</p>}>
                <Role params={params} />
            </Suspense>
        </main>
    );
}

async function Role({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
    const { id } = await params;
    const job = (await listJobMatches()).find((j) => j.id === id);
    if (!job) notFound();
    const logo = logoFor(job.company);
    const topics = job.topics.filter((t) => t.examples.length > 0);
    const examples = topics.flatMap((t) => t.examples);
    const minutes = examples.reduce((s, e) => s + e.durationMinutes, 0);

    return (
        <>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
            {/* header: company logo tile beside company name and title */}
            <div className="mt-6 flex items-center gap-4">
                {logo && (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted/40 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                    </span>
                )}
                <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">{job.company}</div>
                    <h1 className="text-2xl leading-tight font-semibold tracking-tight">{jobTitle(job.title)}</h1>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                {job.location && <span>{job.location}</span>}
                <span>{examples.length} exercises · ~{Math.round(minutes / 60)} h</span>
                {job.languages.length > 0 && (
                    <span className="flex gap-1">{job.languages.map((l) => <LanguageBadge key={l} language={l} />)}</span>
                )}
                {job.url && (
                    <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                        Original posting <ExternalLink className="size-3" />
                    </a>
                )}
            </div>
            {examples[0] && (
                <Link href={`/examples/${encodeURIComponent(examples[0].name)}`} className={buttonVariants({ size: "lg", className: "mt-6" })}>
                    Start practicing
                </Link>
            )}

            <div className="mt-10 space-y-8">
                {topics.map((t) => (
                    <section key={t.label}>
                        <div className="flex items-center gap-3">
                            <h2 className="min-w-0 flex-1 truncate font-medium">{topicName(t.label)}</h2>
                            <span className="flex shrink-0 items-center gap-2" title="How central this topic is to the role">
                                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(t.weight * 100)}%` }} />
                                </span>
                                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(t.weight * 100)}%</span>
                            </span>
                        </div>
                        <ul className="mt-2 text-sm">
                            {t.examples.map((e) => (
                                <li key={e.name}>
                                    <Link
                                        href={`/examples/${encodeURIComponent(e.name)}`}
                                        title={e.title}
                                        className="group/row -mx-2 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted"
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
                    </section>
                ))}
            </div>
        </>
    );
}
