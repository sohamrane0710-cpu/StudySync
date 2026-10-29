# StudySync Security Architecture and Threat Model

## 1. Threat Model & Mitigations

| Threat | Attack Vector | Mitigation in StudySync |
|---|---|---|
| **Identity Spoofing** | Client sends arbitrary `userId` in body or header | User identity is strictly derived from verified JWT `sub` claim. Client-supplied IDs are never trusted as identity. |
| **Tampered / Stale JWTs** | Forged signature or expired tokens | Validated with cryptographic signature verification (RS256/ES256 via JWKS or HS256 via Supabase secret). Expired tokens are rejected. |
| **Horizontal Privilege Escalation** | User A tries to edit or delete User B's categories, labels, timers, or study sessions | Prisma queries explicitly enforce `WHERE id = :id AND userId = :currentUserId`. Composite foreign keys and cross-tenant checks. |
| **Room Role Escalation** | Regular room member tries to change room settings, start timers, or revoke invites | Enforced via `RoomRoleGuard` checking membership role (`OWNER` or `MODERATOR`). |
| **Invitation Token Leak / Enumeration** | Attacker accesses database dump or brute-forces token IDs | Tokens are 256-bit cryptographically secure random values (`crypto.randomBytes(32)`). Stored exclusively as SHA-256 hashes in the database. Raw tokens are never stored and returned only once at creation time. |
| **Capacity Bypass & Race Conditions** | Concurrent join requests exceeding room `maxParticipants` or invite `maxUses` | Managed inside PostgreSQL serializable/atomic transactions using conditional updates: `WHERE uses_count < max_uses` and count checks with row locking. |
| **Timer Cheating / Double Crediting** | Client manipulates local clock to fake 25-minute Pomodoro, or spams `/complete` endpoint | Authoritative server timestamps determine duration. Idempotency guarantees prevent duplicate study session rows. |
| **Chat Impersonation & Manipulation** | Editing message sender ID or moving message across rooms | DTO rejects sender/room changes. Queries enforce `WHERE id = :id AND senderId = :currentUserId AND roomId = :roomId`. |
| **Sensitive Data Exposure in Logs** | Secrets, JWTs, or passwords written to stdout | Global logging interceptor with recursive field sanitizer redacting `authorization`, `token`, `password`, `secret`, `key`. |

---

## 2. Authentication Boundary & Supabase Integration

### 2.1 Token Verification Workflow

```
[ Request with Header: Authorization: Bearer <token> ]
                          |
                          v
         [ AuthGuard (JwtAuthStrategy) ]
                          |
             +------------+------------+
             |                         |
    [ Production Mode ]        [ Dev/Test Mode ]
             |                         |
   Verify against Supabase     Verify against local
   JWT Secret or JWKS          dev secret or mock
             |                         |
             +------------+------------+
                          |
                   [ Verified JWT ]
                          |
         Extract: sub (UUID), email (string)
                          |
                          v
  Auto-provision Profile & Preferences if first request
                          |
                          v
               Attach to Request: req.user
```

### 2.2 Dev/Test Authentication Guardrail
To enable friction-free local development and automated CI testing without live Supabase credentials:
- When running locally or in tests, `AUTH_MODE=dev` or standard symmetric JWT validation using `SUPABASE_JWT_SECRET` (configured with a local test secret) can be used.
- In production (`NODE_ENV === 'production'`), any dev mock bypass **fails closed** immediately if misconfigured.

---

## 3. Cryptographic Invitation Handling

Invitation links for private study rooms must be tamper-proof and resist enumeration:
1. **Token Generation**:
   ```typescript
   const rawToken = crypto.randomBytes(32).toString('hex'); // 64 hex characters (256-bit entropy)
   const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
   ```
2. **Storage**:
   Only `tokenHash` is saved in the `room_invites` table.
3. **Redemption**:
   When a user submits a raw token, the server computes `crypto.createHash('sha256').update(token).digest('hex')` and executes a transactional validation query checking:
   - `tokenHash = computedHash`
   - `isRevoked = FALSE`
   - `expiresAt IS NULL OR expiresAt > NOW()`
   - `maxUses IS NULL OR usesCount < maxUses`
4. **Atomic Consumption**:
   The `usesCount` is incremented atomically inside the same transaction that inserts the new `room_members` record.

---

## 4. Row Level Security (RLS) Strategy for Supabase

When deployed to Supabase, direct client queries via Supabase Client (`supabase-js`) can be secured using RLS policies. Below are the canonical policies:

```sql
-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are readable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their preferences"
ON user_preferences FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on timer_sessions
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own timer sessions"
ON timer_sessions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on study_sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own study sessions"
ON study_sessions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on categories and labels
ALTER TABLE session_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categories" ON session_categories FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE session_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labels" ON session_labels FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable RLS on rooms and members
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public rooms or member rooms are visible"
ON rooms FOR SELECT
TO authenticated
USING (
  is_private = false OR 
  EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = rooms.id AND room_members.user_id = auth.uid())
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view room member lists"
ON room_members FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid())
);

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = messages.room_id AND room_members.user_id = auth.uid())
);

CREATE POLICY "Room members can insert messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = messages.room_id AND room_members.user_id = auth.uid())
);
```
