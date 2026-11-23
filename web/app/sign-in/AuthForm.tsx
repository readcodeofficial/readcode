"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Where to go after signing in: the ?next= path, if it's a path on this site.
function safeNext(next: string | null): string {
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/me";
}

// Email/password sign-in or sign-up, plus GitHub when it's configured. Reads ?next=, so render it
// inside <Suspense>.
export default function AuthForm({ mode, github }: { mode: "sign-in" | "sign-up"; github: boolean }) {
    const router = useRouter();
    const next = safeNext(useSearchParams().get("next"));
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const other = mode === "sign-in" ? "/sign-up" : "/sign-in";

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const email = String(form.get("email"));
        const password = String(form.get("password"));
        setPending(true);
        setError(null);
        const { error } =
            mode === "sign-in"
                ? await authClient.signIn.email({ email, password })
                : await authClient.signUp.email({ email, password, name: String(form.get("name")) });
        setPending(false);
        if (error) return setError(error.message ?? "Something went wrong. Try again.");
        router.push(next);
        router.refresh();
    };

    return (
        <Card className="w-full max-w-sm gap-4 px-6 py-6">
            <div>
                <h1 className="text-xl font-semibold">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Save your answers, scores and plan.</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
                {mode === "sign-up" && (
                    <label className="block space-y-1 text-sm">
                        <span>Name</span>
                        <Input name="name" required autoComplete="name" />
                    </label>
                )}
                <label className="block space-y-1 text-sm">
                    <span>Email</span>
                    <Input name="email" type="email" required autoComplete="email" />
                </label>
                <label className="block space-y-1 text-sm">
                    <span>Password</span>
                    <Input
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    />
                </label>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
                </Button>
            </form>
            {github && (
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => authClient.signIn.social({ provider: "github", callbackURL: next })}
                >
                    Continue with GitHub
                </Button>
            )}
            <p className="text-center text-sm text-muted-foreground">
                {mode === "sign-in" ? "No account yet? " : "Already have an account? "}
                <Link href={`${other}?next=${encodeURIComponent(next)}`} className="text-foreground underline underline-offset-2">
                    {mode === "sign-in" ? "Create one" : "Sign in"}
                </Link>
            </p>
        </Card>
    );
}
