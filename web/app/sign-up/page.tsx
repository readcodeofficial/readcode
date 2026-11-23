import { Suspense } from "react";
import { githubEnabled } from "@/lib/auth";
import AuthForm from "../sign-in/AuthForm";

export default function SignUpPage() {
    return (
        <main className="flex flex-1 items-center justify-center px-6 py-10">
            <Suspense>
                <AuthForm mode="sign-up" github={githubEnabled} />
            </Suspense>
        </main>
    );
}
