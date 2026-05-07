# Security Specification - Socio-Economic Survival Game

## 1. Data Invariants
- A game slot must belong to the authenticated user (`uid` matches `request.auth.uid`).
- Game stats must be within valid ranges (mostly 0-100, wealth can be negative but needs protection).
- Leaderboard entries must be immutable once created (only admins can modify if needed).
- Users can only read and write their own save slots.
- Anyone signed in can read the leaderboard, but only the creator can add to it.

## 2. The "Dirty Dozen" Payloads
These payloads should be rejected by the security rules.

### Identity Spoofing
1. **P1: Wrong UID in Save Slot**
   - Collection: `users/USER_A/slots/slot1`
   - Data: `{ uid: "USER_B", ... }`
   - Expected: `PERMISSION_DENIED`

2. **P2: Writing to Another User's Slot**
   - Collection: `users/USER_B/slots/slot1`
   - Auth: `USER_A`
   - Expected: `PERMISSION_DENIED`

### Integrity Violations
3. **P3: Invalid Persona**
   - Collection: `users/USER_A/slots/slot1`
   - Data: `{ persona: "Super Hero", ... }`
   - Expected: `PERMISSION_DENIED`

4. **P4: Out of Bounds Stats**
   - Data: `{ stats: { health: 150 }, ... }`
   - Expected: `PERMISSION_DENIED`

5. **P5: Missing Required Fields**
   - Data: `{ day: 1 }` (missing uid, stats, etc.)
   - Expected: `PERMISSION_DENIED`

### Resource Poisoning
6. **P6: Gigantic Document ID**
   - Collection: `users/USER_A/slots/very-long-id-...` (1.5KB)
   - Expected: `PERMISSION_DENIED` (via `isValidId`)

7. **P7: Massive String Field**
   - Data: `{ logs: ["A" * 1,000,000] }`
   - Expected: `PERMISSION_DENIED` (via `.size()` checks)

### Privilege Escalation
8. **P8: Creating an Admin Profile**
   - Collection: `users/USER_A`
   - Data: `{ role: "admin" }`
   - Expected: `PERMISSION_DENIED`

### State Shortcutting
9. **P9: Changing UID after creation**
   - Operation: `update`
   - Data: `{ uid: "NEW_UID" }`
   - Expected: `PERMISSION_DENIED`

10. **P10: Setting excessive Wealth**
    - Data: `{ stats: { wealth: 999999999 } }`
    - Expected: `PERMISSION_DENIED` (if we enforce ranges)

### Relational Sync
11. **P11: Orphaned Leaderboard Entry**
    - Operation: `create`
    - Data: `{ uid: "WRONG_UID" }`
    - Expected: `PERMISSION_DENIED`

12. **P12: Bogus Timestamp**
    - Data: `{ timestamp: "2000-01-01T00:00:00Z" }`
    - Expected: `PERMISSION_DENIED` (must be `request.time`)

## 3. Test Runner
We will use a draft test file for verification logic.
