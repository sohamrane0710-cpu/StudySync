# StudySync Authentication v1

## Overview

StudySync Auth v1 is an Email and Password-based authentication system built using NestJS, Prisma, and PostgreSQL. It uses opaque server-side session tokens delivered via secure HTTP-only cookies, avoiding stateless JWTs and `localStorage` storage for higher security.

## Core Decisions

1. **Passwords**: Hashed with **Argon2id**. Plaintext passwords are never logged or stored.
2. **Session Storage**: The database stores the session along with a **SHA-256 hash** of the raw token. This guarantees that if the database is leaked, session tokens cannot be stolen and reused directly.
3. **Session Delivery**: The raw session token is sent exclusively via an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. It is never returned in a JSON response body.
4. **Session Expiration**: MVP sessions expire 30 days after login.

## Schema Modifications

During implementation, the following targeted schema changes were applied:

- Added `Credential` model storing `passwordHash` (with a 1:1 relation to `User`).
- Added `Session` model mapping sessions to users.
- `Session.sessionToken` was renamed to `Session.tokenHash` via the `rename_session_token_to_hash` migration to accurately reflect its contents (SHA-256 hash of the token).

## Authentication Flows

### Registration (`POST /auth/register`)

- Accepts `email` and `password`.
- Normalizes `email` (lowercased, trimmed).
- Checks for duplicate email and returns `409 Conflict` if existing.
- Hashes password using Argon2id.
- Creates `User` and `Credential`.
- Returns the public User representation (omitting internal secrets).
- **Note**: Does not log the user in immediately (no session created).

### Login (`POST /auth/login`)

- Accepts `identifier` (username or email) and `password`.
- Matches against the database case-insensitively since both `email` and `username` utilize PostgreSQL `citext`.
- Verifies the given password against `Credential.passwordHash` with Argon2id.
- On failure (wrong identifier or password), returns generic `401 Unauthorized`.
- Generates 32-byte cryptographically secure random secret (`rawToken`).
- Hashes `rawToken` with SHA-256 to create `tokenHash`.
- Stores `tokenHash` in the database.
- Sets the `studysync_session` cookie containing `rawToken`.
- Returns the public User representation.

### Current User (`GET /auth/me`)

- Protected by `AuthGuard`.
- Extracts `rawToken` from the `studysync_session` cookie.
- Hashes `rawToken` (SHA-256) and looks it up in the database.
- Validates the token's expiration date.
- Deletes expired sessions lazily upon access.
- Returns the public User representation.

### Logout (`POST /auth/logout`)

- Safely deletes the specific session from the database.
- Clears the `studysync_session` cookie on the client.
- Operates safely even if the user is already logged out.

## Guards & Decorators

### AuthGuard

`AuthGuard` should be applied to protected endpoints (`@UseGuards(AuthGuard)`). It reads the `HttpOnly` cookie, resolves the token via the `AuthService`, and rejects requests lacking a valid session. 

### @CurrentUser()

A custom NestJS decorator that injects the resolved `User` object directly into route handlers.

```typescript
@Get('me')
@UseGuards(AuthGuard)
getProfile(@CurrentUser() user: User) {
  return user;
}
```
