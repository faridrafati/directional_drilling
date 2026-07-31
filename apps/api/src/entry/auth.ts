/**
 * Authentication for the rig-side report-entry module.
 *
 * The rest of the API is unauthenticated (single-user desktop replacement); only
 * the /entry/* routes are guarded, because those are what the company men on the
 * rigs log into and write with.
 *
 * Deliberately dependency-free — everything below is `node:crypto`:
 *   • passwords  → scrypt (N=16384), stored as "salt:derivedKey" hex, compared
 *                  with timingSafeEqual;
 *   • sessions   → a compact JWT-shaped token "payload.signature", signed
 *                  HMAC-SHA256 with ENTRY_TOKEN_SECRET. Stateless: no session
 *                  table, and changing the secret invalidates every token.
 *
 * On-prem deployments must set ENTRY_TOKEN_SECRET in apps/api/.env; without it a
 * per-process random secret is used, so tokens die with a server restart (safe
 * default — never a hardcoded secret).
 */
import {
  scryptSync, randomBytes, timingSafeEqual, createHmac,
} from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

const KEYLEN = 64;

/** scrypt hash of a plaintext password → "salt:key" (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, KEYLEN).toString("hex")}`;
}

/** Constant-time check of a plaintext password against a stored "salt:key". */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── tokens ──────────────────────────────────────────────────────────────────
const SECRET = process.env.ENTRY_TOKEN_SECRET || randomBytes(32).toString("hex");
if (!process.env.ENTRY_TOKEN_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[entry] ENTRY_TOKEN_SECRET not set — using a random per-process secret; logins won't survive a restart.");
}
/** Token lifetime (seconds). A rig shift is 12 h; a week keeps re-logins rare. */
const TTL = Number(process.env.ENTRY_TOKEN_TTL ?? 7 * 24 * 3600);

export interface TokenPayload {
  sub: string;      // user id
  username: string;
  role: string;
  exp: number;      // unix seconds
}

const b64url = (b: Buffer) => b.toString("base64url");
const sign = (data: string) => b64url(createHmac("sha256", SECRET).update(data).digest());

export function issueToken(user: { id: string; username: string; role: string }): { token: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload: TokenPayload = { sub: user.id, username: user.username, role: user.role, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return { token: `${body}.${sign(body)}`, expiresAt: exp };
}

export function readToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot), sig = token.slice(dot + 1);
  const expect = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

// ── request guards ──────────────────────────────────────────────────────────
declare module "fastify" {
  interface FastifyRequest {
    entryUser?: TokenPayload;
  }
}

/** preHandler: 401 unless the Bearer token is valid. Attaches req.entryUser. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization ?? "";
  const p = readToken(header.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!p) return reply.code(401).send({ error: "not signed in" });
  req.entryUser = p;
}

/** preHandler: as requireUser, plus an admin-role check. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const done = await requireUser(req, reply);
  if (reply.sent) return done;
  if (req.entryUser?.role !== "admin") return reply.code(403).send({ error: "admin only" });
}

/**
 * First-run bootstrap: with no users at all, create the admin from
 * ENTRY_ADMIN_USER / ENTRY_ADMIN_PASSWORD (default admin/admin) and force a
 * password change at first login. Never touches an existing user table.
 */
export async function seedAdmin(prisma: PrismaClient, log: (msg: string) => void): Promise<void> {
  if (await prisma.entryUser.count()) return;
  const username = process.env.ENTRY_ADMIN_USER || "admin";
  const password = process.env.ENTRY_ADMIN_PASSWORD || "admin";
  await prisma.entryUser.create({
    data: {
      username, fullName: "Administrator", role: "admin",
      passwordHash: hashPassword(password),
      mustChangePassword: !process.env.ENTRY_ADMIN_PASSWORD,
    },
  });
  log(`[entry] seeded admin account "${username}"${process.env.ENTRY_ADMIN_PASSWORD ? "" : ' with password "admin" — change it at first login'}`);
}
