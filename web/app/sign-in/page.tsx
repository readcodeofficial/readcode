import { Suspense } from "react";
import { githubEnabled } from "@/lib/auth";
import AuthForm from "./AuthForm";

export default function SignInPage() {
    return (
        <main className="flex flex-1 items-center justify-center px-6 py-10">
            <Suspense>
                <AuthForm mode="sign-in" github={githubEnabled} />
            </Suspense>
        </main>
    );
}
