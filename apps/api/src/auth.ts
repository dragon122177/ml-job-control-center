import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import type { Database } from "./db.js";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import type { AuthenticatedRequest, Role, UserIdentity } from "./types.js";

type TokenPayload = UserIdentity & { iat: number; exp: number };

export async function authenticate(
  db: Database,
  email: string,
  password: string
): Promise<{ token: string; user: UserIdentity } | null> {
  const result = await db.query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    role: Role;
  }>("SELECT id, email, name, password_hash, role FROM users WHERE LOWER(email) = LOWER($1)", [email]);

  const record = result.rows[0];
  if (!record || !(await bcrypt.compare(password, record.password_hash))) return null;

  const user: UserIdentity = {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role
  };

  return {
    token: jwt.sign(user, config.jwtSecret, { expiresIn: "8h" }),
    user
  };
}

export function decodeToken(token: string): UserIdentity {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role
    };
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "The authentication token is missing or invalid.");
  }
}

export function requireAuth(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction
): void {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new AppError(401, "AUTH_REQUIRED", "Authentication is required."));
    return;
  }

  try {
    request.user = decodeToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      next(new AppError(403, "FORBIDDEN", "Your role does not allow this operation."));
      return;
    }
    next();
  };
}
