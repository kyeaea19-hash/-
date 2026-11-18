# Security Specification — 발전소 키우기 (PowerPlant Growth)

## 1. Data Invariants
1. **Owner-Only Isolation (PII Protection)**: A `UserProfile` document at `/users/{userId}` contains `email` (PII) and progression metrics. Only the authenticated verified owner (`request.auth.uid == userId`) can `get`, `create`, or `update` their own profile. Blanket `list` on `/users` is forbidden.
2. **Diary Subcollection Master Gate**: A `DiaryEntry` at `/users/{userId}/diaries/{diaryId}` belongs strictly to `{userId}` whose parent `/users/{userId}` document exists, and `userId` inside the document MUST equal `request.auth.uid`.
3. **Path ID & Date Format Integrity**: `{userId}` must satisfy `isValidId()`, and `{diaryId}` must match `^\\d{4}-\\d{2}-\\d{2}$` and equal `incoming().date`.
4. **Power Plant Bounds**: `level` is strictly bounded `[1, 365]`, `storedKwh` is strictly bounded `[0, 365]`, `studyMinutes` is bounded `[0, 1440]`, `kwhEarned` is bounded `[0, 1]`.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on updates; `updatedAt` must equal `request.time` on every write; `uid` and `signupDate` are immutable after creation.
6. **Anti-Shadow-Field**: All creates enforce exact `keys().hasAll(...)` and `keys().hasOnly(...)`; all updates enforce `affectedKeys().hasOnly(...)` combined with `isValidUserProfile` / `isValidDiaryEntry`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Anonymous request reading `/users/userA`.
2. **Cross-Tenant Profile Read**: `userB` calling `get` on `/users/userA`.
3. **Profile Enumeration**: Any user calling `list` on `/users`.
4. **Unverified Email Spoof**: User with `email_verified: false` attempting `create` on `/users/userA`.
5. **Identity Spoofing on Profile Create**: `userA` creating `/users/userA` with `uid: "userB"`.
6. **Shadow Field Injection on Profile**: `userA` creating `/users/userA` with extra field `isAdmin: true`.
7. **Level Overflow Attack**: `userA` updating `/users/userA` setting `level: 9999` or `storedKwh: 999`.
8. **Immutable Field Tampering**: `userA` updating `/users/userA` changing `signupDate` or `createdAt`.
9. **Client Timestamp Spoofing**: `userA` creating a diary with `createdAt` set to a past timestamp instead of `request.time`.
10. **Orphan / Cross-Tenant Diary Write**: `userB` creating `/users/userA/diaries/2026-11-18`.
11. **ID Poisoning on Diary**: `userA` creating `/users/userA/diaries/2026-11-18_../../etc` or 1MB `retrospective`.
12. **Array Exhaustion on Tags**: `userA` creating a diary with `tags` array containing > 10 items or non-string first element.
