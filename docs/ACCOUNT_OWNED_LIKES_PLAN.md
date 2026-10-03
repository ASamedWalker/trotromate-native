# Account-owned likes (and posts) — plan

Status (2026-10-03):
- Phase 1 DONE: migration 085 applied in production (dry run passed with a real account). Backfill owned 0 rows: only 1 account was linked, and it had no likes.
- Phase 2 on the PREVIEW OTA (f59659e; iOS group 94ad3a1e, Android group 709fd4ea), awaiting the owner's device test.
- Owner decision: signed-out users KEEP liking, commenting and posting (no sign-in gate). The "Sign in to like" sheet below is dropped.
- The web has no rider sign-in, so it stays device-based.
Context: migrations 083 (signed-in users can write) and 084 (signed-in
parity for unlike/delete) are interim fixes. This plan is the real model.

## Problem today
Likes/reactions, comments and Pulse posts are owned by a **device_id**
(per phone), not the account:
- `tale_reactions` UNIQUE(post_id, device_id, emoji) → one person on two phones = two likes; reinstall = new device_id = can like again.
- `link_auth_to_device` (055) links an account to its FIRST device only, so ownership checks by device fail after a new phone/reinstall (seen 2026-10-02: like saved, unlike matched 0 rows).
- Anon policies allow DELETE/UPDATE with USING (true): anyone with the public key can remove any like or edit/delete any post.

## Target (Facebook / X / TikTok model)
- A like belongs to the **signed-in account**: one per account per post per emoji, the same on every phone.
- Your likes show as liked on any phone you sign in on; you can unlike anywhere.
- Only you can unlike your likes and edit/delete your posts — enforced in the database.
- Signed-out users can browse Pulse; tapping like/comment/post opens "Sign in to like" (phone OTP already exists).

## Phase 1 — database (migration 085, dry run + PGlite test like 080–084)
1. Add `auth_user_id uuid` (nullable) to `tale_reactions`, `tale_comments`, `tale_posts`.
2. BEFORE INSERT trigger on each: `NEW.auth_user_id := auth.uid()` (ignores any client value, so it can't be spoofed; null when signed out).
3. Backfill: `auth_user_id` from `contributor_profiles` (device_id → auth_user_id) where linked.
4. De-duplicate reactions per (post_id, auth_user_id, emoji), keeping the earliest; the existing `update_post_reaction_summary` trigger recomputes counts (counts may drop slightly — that's the honest number).
5. Partial unique indexes: (post_id, auth_user_id, emoji) and (comment_id, auth_user_id, emoji) WHERE auth_user_id IS NOT NULL.
6. Signed-in policies: DELETE/UPDATE `USING (auth_user_id = auth.uid())`; INSERT unchanged (the trigger fills ownership).
7. Anon policies stay for now so production (old app build) keeps working.

## Phase 2 — app + web (preview OTA, then web push)
- `lib/services/tales.ts` `addReaction` / `removeReaction` / `fetchUserReactions`: when signed in, read and delete by `auth_user_id`; the insert needs no change (trigger). `app/reel.tsx` and `lib/hooks/useTales.ts` follow.
- Signed out: like / comment / post buttons open a "Sign in to like" sheet instead of writing.
- Web: `app/api/tales/[postId]/reactions/route.ts` and the `/tales` page mirror the same rules.
- Verify on the iOS simulator with Maestro (like, unlike, second device id, signed out).

## Phase 3 — tighten (part of the PRODUCTION release, after wallet payments)
Only once the production app has Phase 2:
- Drop anon INSERT/DELETE on `tale_reactions`, anon INSERT on `tale_comments`, anon INSERT/UPDATE/DELETE on `tale_posts`.
- Re-run the RLS checks as anon (must fail) and as a signed-in non-owner (0 rows).

## Effort and risk
- About 2 days: Phase 1 half a day, Phase 2 one day, Phase 3 an hour plus checks.
- Risks:
  - Like counts drop after de-duplication (expected).
  - Old app builds need sign-in for likes after Phase 3. Phase 3 is gated on the production release for that reason.
