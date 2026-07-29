import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Database } from "../db.js";
import { authenticate } from "../auth.js";
import { AppError } from "../errors.js";
import { writeAudit } from "../audit.js";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(128)
});

export function authRoutes(db: Database): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  router.post("/login", limiter, async (request, response) => {
    const credentials = loginSchema.parse(request.body);
    const session = await authenticate(db, credentials.email, credentials.password);
    if (!session) {
      throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    await writeAudit(db, session.user.id, "USER_SIGNED_IN", "session", session.user.id, {
      email: session.user.email
    });
    response.json(session);
  });

  return router;
}
