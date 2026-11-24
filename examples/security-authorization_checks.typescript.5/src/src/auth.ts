import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type Role = "viewer" | "support" | "billing_admin";

export interface AuthContext {
  userId: string;
  accountId: string;
  roles: Role[];
  scopes: string[];
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

export function authenticate(publicKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "missing_token" });
    }
    try {
      const claims = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
      req.auth = {
        userId: String(claims.sub),
        accountId: String(claims.account_id),
        roles: (claims.roles ?? []) as Role[],
        scopes: String(claims.scope ?? "").split(" ").filter(Boolean),
      };
      return next();
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }
  };
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: "unauthenticated" });
    }
    if (!req.auth.roles.some((r) => allowed.includes(r))) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.scopes.includes(scope)) {
      return res.status(403).json({ error: "insufficient_scope" });
    }
    return next();
  };
}
