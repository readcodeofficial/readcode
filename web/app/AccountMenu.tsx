"use client";

import { useRouter } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, UserPlus, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Account button for the top right of the nav. Reads the session in the browser, so the nav
// itself can still be prerendered.
export default function AccountMenu() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const user = session?.user;

    const signOut = async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Avatar>
                    <AvatarFallback>
                        {user ? (
                            <span className="text-xs font-medium">{initials(user.name || user.email)}</span>
                        ) : (
                            <UserRound className="size-4 text-muted-foreground" />
                        )}
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">
                        {isPending ? "…" : user ? user.email : "Not signed in"}
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {user ? (
                    <>
                        <DropdownMenuItem onClick={() => router.push("/me")}>
                            <LayoutDashboard /> My progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={signOut}>
                            <LogOut /> Sign out
                        </DropdownMenuItem>
                    </>
                ) : (
                    <>
                        <DropdownMenuItem disabled={isPending} onClick={() => router.push("/sign-in")}>
                            <LogIn /> Sign in
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isPending} onClick={() => router.push("/sign-up")}>
                            <UserPlus /> Create account
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// "Ada Lovelace" -> "AL", "ada@example.com" -> "A"
function initials(nameOrEmail: string): string {
    const words = nameOrEmail.split("@")[0].split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
