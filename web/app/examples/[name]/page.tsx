import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { listExamples, loadExample } from "@/lib/examples";
import { currentUser } from "@/lib/auth";
import { getExampleState } from "@/lib/progress";
import { areaName, topicName } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ExampleViewer from "./ExampleViewer";
import SaveButton from "./SaveButton";

const href = (name: string) => `/examples/${encodeURIComponent(name)}`;

export default async function ExamplePage({ params }: PageProps<"/examples/[name]">) {
    const { name: raw } = await params;
    const name = decodeURIComponent(raw);
    const [example, all, user] = await Promise.all([loadExample(name), listExamples(), currentUser()]);
    if (!example) notFound();
    const state = user ? await getExampleState(user.id, name) : null;

    // position within the exercise's unit (its main topic), for previous / next
    const topic = example.public.concepts[0] ?? "";
    const unit = all.filter((e) => e.topic === topic);
    const at = unit.findIndex((e) => e.name === name);
    const prev = at > 0 ? unit[at - 1] : null;
    const next = at >= 0 && at < unit.length - 1 ? unit[at + 1] : null;
    const related = example.public.concepts.slice(1);

    return (
        <div className="flex min-h-0 flex-1 flex-col text-sm">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
                <Link href="/examples" className="flex items-center gap-1 text-muted-foreground hover:text-foreground" aria-label="All exercises">
                    <ArrowLeft className="size-4" />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-muted-foreground">
                        {topic && `${areaName(topic)} › ${topicName(topic)}`}
                        {at >= 0 && unit.length > 1 && ` · ${at + 1} of ${unit.length}`}
                    </div>
                    <h1 className="truncate text-base font-semibold" title={example.public.title}>
                        {example.public.name ?? example.public.title}
                    </h1>
                </div>
                <div className="hidden items-center gap-1.5 lg:flex">
                    {related.slice(0, 3).map((c) => (
                        <span key={c} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{topicName(c)}</span>
                    ))}
                    {related.length > 3 && <span className="text-xs text-muted-foreground">+{related.length - 3}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{example.public.language} · ~{example.public.durationMinutes} min</span>
                <SaveButton exampleName={name} initiallySaved={state?.saved ?? false} signedIn={user !== null} />
                <nav className="flex items-center gap-1" aria-label="Exercises in this unit">
                    <Link
                        href={prev ? href(prev.name) : "#"}
                        aria-disabled={!prev}
                        title={prev?.shortName}
                        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), !prev && "pointer-events-none opacity-40")}
                    >
                        <ChevronLeft />
                    </Link>
                    <Link
                        href={next ? href(next.name) : "/examples"}
                        title={next ? next.shortName : "Back to all exercises"}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        {next ? "Next" : "Done"} <ChevronRight />
                    </Link>
                </nav>
            </header>
            {/* key: a different user (or none) gets a fresh viewer, not the previous user's answers */}
            <ExampleViewer key={user?.id ?? "anon"} example={example} signedIn={user !== null} resume={state?.attempt ?? null} />
        </div>
    );
}
