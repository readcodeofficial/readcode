import { scryptSync, timingSafeEqual } from "node:crypto";
import { parseCookies, sessionCookie } from "./ids.js";

export function hashPassword(password, salt) {
    return scryptSync(password, salt, 32, { N: 1024 });
}

export function createPortal({ sessions, users }) {
    function verify(email, password) {
        const user = users.get(email);
        if (!user) return null;
        const candidate = hashPassword(password, user.salt);
        return timingSafeEqual(candidate, user.hash) ? user : null;
    }

    return {
        // GET /intake: anonymous visitors get a session so the intake form can keep a draft
        intake(req) {
            const cookies = parseCookies(req.headers.cookie);
            let id = cookies.sid;
            if (!sessions.resolve(id)) id = sessions.start();
            sessions.resolve(id).data.draft = req.query?.draft ?? null;
            return { status: 200, headers: { "set-cookie": sessionCookie(id, 900) }, body: { sid: id } };
        },

        // POST /login
        login(req) {
            const user = verify(req.body.email, req.body.password);
            if (!user) return { status: 401, body: { error: "invalid credentials" } };
            const id = sessions.login(parseCookies(req.headers.cookie).sid, user.id);
            return { status: 200, headers: { "set-cookie": sessionCookie(id, 900) }, body: { userId: user.id } };
        },

        // GET /me
        me(req) {
            const session = sessions.resolve(parseCookies(req.headers.cookie).sid);
            if (!session || !session.userId) return { status: 401, body: { error: "not signed in" } };
            return { status: 200, body: { userId: session.userId, draft: session.data.draft ?? null } };
        },

        logout(req) {
            sessions.logout(parseCookies(req.headers.cookie).sid);
            return { status: 204, headers: { "set-cookie": sessionCookie("", 0) } };
        },
    };
}
