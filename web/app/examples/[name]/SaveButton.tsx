"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { setSaved } from "@/app/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bookmark toggle for an exercise. Signed out, it links to sign-in instead.
export default function SaveButton({ exampleName, initiallySaved, signedIn }: {
    exampleName: string;
    initiallySaved: boolean;
    signedIn: boolean;
}) {
    const [saved, setSavedState] = useState(initiallySaved);
    const [pending, startTransition] = useTransition();
    const label = saved ? "Saved" : "Save";
    const icon = saved ? <BookmarkCheck /> : <Bookmark />;

    if (!signedIn) {
        const next = `/examples/${encodeURIComponent(exampleName)}`;
        return (
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`} title="Sign in to save exercises" className={buttonVariants({ variant: "outline", size: "sm" })}>
                {icon} {label}
            </Link>
        );
    }
    return (
        <button
            type="button"
            aria-pressed={saved}
            disabled={pending}
            onClick={() => {
                const want = !saved;
                setSavedState(want);
                startTransition(async () => {
                    const res = await setSaved(exampleName, want);
                    if (!res.ok) setSavedState(!want);
                });
            }}
            className={cn(buttonVariants({ variant: saved ? "secondary" : "outline", size: "sm" }))}
        >
            {icon} {label}
        </button>
    );
}
