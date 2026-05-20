# Dual-Email Architecture Implementation Guide

This document outlines the complete implementation of the dual-email architecture for Campulse, enabling students to maintain vault access after graduation through personal email linking.

## Architecture Overview

The system consists of four integrated components:

1. **Progressive Onboarding** (Next.js) - Non-intrusive modal after institutional auth
2. **Manual Identity Linking** (Supabase) - Secure linking of multiple identities
3. **Relational Email Schema** (Prisma) - Supports multiple emails per user
4. **Alumni Detection** (NestJS) - Automated graduation status updates

---

## Step 1: Progressive Onboarding (Next.js)

### Components Created

#### `EmailLinkingModal.tsx`
- **Location**: `apps/web/components/auth/EmailLinkingModal.tsx`
- **Purpose**: Non-intrusive modal displayed after student authenticates with institutional email
- **Features**:
  - Shows current institutional email
  - Allows input of personal email (Gmail, Yahoo, etc.)
  - Explains post-graduation vault access benefits
  - Provides skip option for later

#### `useEmailLinking.ts` Hook
- **Location**: `apps/web/hooks/useEmailLinking.ts`
- **Purpose**: Manages email linking API calls
- **Methods**:
  - `linkIdentity()` - Links new email via Supabase + backend
  - `setPrimaryEmail()` - Changes primary email
  - `getUserEmails()` - Fetches all linked emails

#### `useEmailLinkingModal.ts` Hook
- **Location**: `apps/web/hooks/useEmailLinkingModal.ts`
- **Purpose**: Manages modal visibility state and email status
- **Logic**:
  - Checks if user has institutional email but no personal email
  - Tracks modal dismissal (session-based)
  - Auto-hides when personal email is linked

#### Updated `StudentDashboard.tsx`
- **Location**: `apps/web/components/dashboard/StudentDashboard.tsx`
- **Changes**: Now displays `EmailLinkingModal` on first login
- **Props**: `isOpen`, `userId`, `currentEmail`, `onClose`, `onSuccess`

### Integration Steps

```typescript
// In your main dashboard layout or app wrapper:
import { EmailLinkingModal } from '@/components/auth/EmailLinkingModal';
import { useEmailLinkingModal } from '@/hooks/useEmailLinkingModal';

export function Dashboard() {
  const { shouldShowModal, primaryEmail, dismissModal, onSuccess } = useEmailLinkingModal();
  const user = useUser(); // from @supabase/auth-helpers-react

  return (
    <>
      <EmailLinkingModal
        isOpen={shouldShowModal}
        userId={user.id}
        currentEmail={user.email || primaryEmail}
        onClose={dismissModal}
        onSuccess={onSuccess}
      />
      {/* Rest of dashboard */}
    </>
  );
}
```

---

## Step 2: Manual Identity Linking (Supabase Auth)

### Supabase Integration Library
- **Location**: `apps/web/lib/supabase-identity.ts`
- **Purpose**: Handles Supabase identity linking for OAuth providers

### Key Functions

#### `linkIdentityManually()`
```typescript
await linkIdentityManually(supabaseClient, {
  provider: 'google', // or 'github'
  email: 'personal@gmail.com'
});
```

**Process**:
1. Verifies active Supabase session
2. For OAuth providers: calls `supabase.auth.linkIdentity()`
3. For email: updates user metadata with `linked_emails` array
4. Supabase binds the second email to existing User ID

#### `getLinkedIdentities()`
- Returns all identities linked to current user
- Combines Supabase identities + metadata

#### `unlinkIdentity()` and `canUnlinkIdentity()`
- Safely removes identities
- Prevents accidental lockout (user must have ≥1 login method)

### Why Manual Linking?

Supabase auto-links identities only if emails match exactly:
- Institutional: `student123@student.funaab.edu.ng`
- Personal: `john.doe@gmail.com`

Since emails differ, manual linking is required using:
```typescript
supabase.auth.linkIdentity({ provider: 'google' })
// or manual metadata update for email-based linking
```

---

## Step 3: Relational Email Schema (Prisma)

### Schema Changes

#### Before
```prisma
model User {
  id    String  @id @default(uuid())
  email String  @unique  // Single email, hard to manage
  // ... other fields
}
```

#### After
```prisma
model User {
  id      String      @id @default(uuid())
  // email field removed - now use UserEmail relation
  emails  UserEmail[]  // One-to-many relationship
  // ... other fields
}

model UserEmail {
  id        String   @id @default(uuid())
  email     String   @unique
  userId    String
  isPrimary Boolean  @default(false)    // Primary email for login
  isVerified Boolean @default(false)    // Email verification status
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([email])
}
```

### Benefits
- ✅ Multiple emails per user
- ✅ Atomic operations with Prisma transactions
- ✅ Cascading delete maintains referential integrity
- ✅ Efficient indexing on `userId` and `email`

### Migration File
- **Location**: `apps/api/prisma/migrations/add_user_email_model/migration.sql`
- **Changes**:
  - Drops `email` unique constraint on User
  - Creates UserEmail table with proper indexes
  - Sets up foreign key with CASCADE delete

### Running the Migration
```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate  # Regenerate Prisma Client
```

---

## Step 4: Alumni Detection & Email Switching (NestJS)

### Alumni Service
- **Location**: `apps/api/src/maintenance/alumni.service.ts`

### How It Works

#### Academic Session Calculation
```typescript
private getCurrentAcademicSession(): number {
  const now = new Date();
  // Sessions start in August (month 7)
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}
```

#### Alumni Status Logic
```typescript
// College duration matrix (NUC-approved)
PROGRAM_DURATIONS = {
  'COLPHYS': 4,  // Physics: 4 years
  'COLCOM': 4,   // Computing: 4 years
  'COLENG': 5,   // Engineering: 5 years
};

// Check if student should graduate
shouldMarkAsAlumni(entryYear: 2020, currentSession: 2024, college: 'COLENG')
// 2024 >= (2020 + 5) = true → Student is ALUMNI
```

#### Cron Job Schedule
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async detectAndProcessAlumni(): Promise<void> {
  // Runs daily, but checks academic session date
  // Only processes students on/after graduation date
}
```

### Alumni Promotion Process

```typescript
private async promoteStudentToAlumni(userId: string): Promise<void> {
  await this.prisma.$transaction(async (prisma) => {
    // Find user's emails
    const userEmails = await prisma.userEmail.findMany({
      where: { userId }
    });

    // Atomically:
    // 1. Set institutional email to non-primary
    // 2. Set personal email to primary
    // 3. Update user status to ALUMNI
    // 4. Set graduatedAt timestamp

    await Promise.all([
      prisma.userEmail.update({
        where: { id: institutionalEmail.id },
        data: { isPrimary: false }
      }),
      prisma.userEmail.update({
        where: { id: personalEmail.id },
        data: { isPrimary: true }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ALUMNI',
          graduatedAt: new Date()
        }
      })
    ]);
  });
}
```

### Key Features
- ✅ Atomic transactions (all-or-nothing)
- ✅ Automatic email switching
- ✅ No manual intervention needed
- ✅ Idempotent (safe to run multiple times)

---

## Step 5: Authentication & Email Resolution (NestJS)

### Guards

#### `DepartmentGuard` (Updated)
- **Location**: `apps/api/src/core/guards/department.guard.ts`
- **Purpose**: Maintains existing functionality, now works with multiple emails

#### `SupabaseAuthGuard` (New)
- **Location**: `apps/api/src/core/guards/auth.guard.ts`
- **Purpose**: Validates JWT and resolves user with all linked emails

### How Auth Guard Works

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  // 1. Extract JWT from Authorization header
  const token = this.extractTokenFromHeader(request);

  // 2. Parse JWT payload (without signature validation for now)
  const payload = this.parseJwtPayload(token);
  const userId = payload.sub;

  // 3. Fetch user with ALL linked emails
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { emails: true }
  });

  // 4. Verify token email is one of user's linked emails
  const hasEmail = user.emails.some(e => e.email === payload.email);

  // 5. Store user context in ClsService for request
  this.cls.set('userId', user.id);
  this.cls.set('emails', user.emails);

  return true;
}
```

### Usage

```typescript
@UseGuards(SupabaseAuthGuard)
@Get('protected-route')
async getProtected(@Request() req) {
  const user = req.user; // Contains all linked emails
}
```

---

## Email Linking Service (NestJS)

### Location
- `apps/api/src/core/services/email-linking.service.ts`

### Methods

#### `linkEmailToUser()`
- Adds new email to user account
- Validates email isn't already in use
- Initially marks as non-primary, not verified

#### `setPrimaryEmail()`
- Atomically switches primary email
- Ensures user has at least one primary email

#### `getUserEmails()`
- Returns all emails linked to user
- Shows verification status and primary flag

#### `verifyEmail()`
- Marks email as verified after validation
- Called after email verification flow

#### `removeEmail()`
- Safely removes email from user
- Prevents removing last email
- Auto-selects new primary if needed

### Error Handling
- `NotFoundException`: Email not found for user
- `ConflictException`: Email already linked to another user
- All operations logged for audit trail

---

## API Endpoints

### Auth Module Controllers
- **Location**: `apps/api/src/auth/auth.controller.ts`

#### Link Email
```
POST /auth/link-email
{
  "userId": "uuid",
  "email": "personal@gmail.com",
  "provider": "google"  // optional
}
Response: { success: true, email, primaryEmail }
```

#### Get User Emails
```
GET /auth/emails/:userId
Headers: Authorization: Bearer <JWT>
Response: {
  userId,
  emails: [
    {
      id,
      email,
      isPrimary,
      isVerified,
      createdAt
    }
  ],
  primaryEmail
}
```

#### Set Primary Email
```
PUT /auth/primary-email/:userId
{ "email": "personal@gmail.com" }
Response: { success: true, primaryEmail }
```

#### Verify Email
```
POST /auth/verify-email/:userId
{ "email": "personal@gmail.com" }
Response: { success: true, email }
```

#### Remove Email
```
DELETE /auth/emails/:userId/:email
Response: { success: true, message }
```

---

## Deployment Checklist

### Backend (NestJS)
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Regenerate Prisma: `npx prisma generate`
- [ ] Export `AuthModule` and `EmailLinkingService` in app.module.ts
- [ ] Enable ScheduleModule for cron jobs
- [ ] Test alumni cron job with `detectAndProcessAlumni()`
- [ ] Verify guards work with multiple emails

### Frontend (Next.js)
- [ ] Install/update Supabase deps: `npm install @supabase/auth-helpers-react`
- [ ] Add `EmailLinkingModal` to main layout
- [ ] Test modal triggers on first login
- [ ] Test email linking form submission
- [ ] Verify localStorage for dismissal works
- [ ] Test with institutional email login
- [ ] Test with personal email login (after linking)

### Environment Variables
```bash
# Backend (.env in apps/api)
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=<your-secret>

# Frontend (.env.local in apps/web)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Testing Guide

### Test Scenario 1: First-Time Login with Institutional Email
1. User logs in with `student@student.funaab.edu.ng`
2. Dashboard renders
3. `EmailLinkingModal` appears after 2 seconds
4. User skips modal (dismissal saved to localStorage)
5. User logs out and back in (modal shouldn't appear)

### Test Scenario 2: Link Personal Email
1. User is in dashboard
2. Opens `EmailLinkingModal`
3. Enters `john.doe@gmail.com`
4. Clicks "Link Email"
5. Backend creates UserEmail record
6. Supabase links identity
7. Modal shows success message
8. Redirects to dashboard

### Test Scenario 3: Alumni Graduation
1. User entry year = 2020, college = COLENG (5-year program)
2. Current academic session = 2025 (August 2025+)
3. Cron job runs
4. `shouldMarkAsAlumni(2020, 2025, 'COLENG')` returns true
5. Alumni promotion executes atomically
6. User status → ALUMNI
7. Institutional email isPrimary → false
8. Personal email isPrimary → true

### Test Scenario 4: Alumni Login with Personal Email
1. User logs in with `john.doe@gmail.com` (personal email)
2. SupabaseAuthGuard validates JWT
3. Fetches user with all emails
4. Confirms email is linked
5. Sets ClsService context
6. User accesses vault with same account ID
7. All saved materials accessible

---

## Troubleshooting

### Issue: "Email already linked to another account"
- **Cause**: Email exists in UserEmail table for different user
- **Solution**: Verify email uniqueness in `UserEmail` table

### Issue: Alumni status not updating
- **Cause**: Cron job not running or academic session calculation wrong
- **Solution**: 
  - Check NestJS ScheduleModule is enabled
  - Verify `getCurrentAcademicSession()` logic
  - Check database for user entry years

### Issue: Modal keeps appearing
- **Cause**: localStorage dismissal cleared or user already has personal email
- **Solution**: Check browser localStorage, verify UserEmail records

### Issue: Can't link second email
- **Cause**: Supabase auth flow incomplete
- **Solution**: Ensure `supabase.auth.linkIdentity()` completes successfully

---

## Security Considerations

✅ **Email Uniqueness**: Each email can only be linked to one user
✅ **Cascading Delete**: Removing user also removes all linked emails
✅ **Atomic Operations**: Email switching is atomic (no partial updates)
✅ **Verification Flow**: Email verification required for certain operations
✅ **Primary Email Logic**: Always maintains exactly one primary email
✅ **JWT Validation**: Guards verify token email matches user's linked emails

---

## Future Enhancements

1. **Email Verification**: Implement email verification tokens
2. **Rate Limiting**: Limit email linking attempts per user
3. **Audit Logging**: Track all email linking/unlinking events
4. **SSO Support**: Add institutional SSO alternatives
5. **Email Recovery**: Allow users to recover deleted emails within 30 days

---

## Files Created/Modified

### Created
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/maintenance/alumni.service.ts`
- `apps/api/src/core/services/email-linking.service.ts`
- `apps/api/src/core/guards/auth.guard.ts`
- `apps/api/prisma/migrations/add_user_email_model/migration.sql`
- `apps/web/components/auth/EmailLinkingModal.tsx`
- `apps/web/hooks/useEmailLinking.ts`
- `apps/web/hooks/useEmailLinkingModal.ts`
- `apps/web/lib/supabase-identity.ts`

### Modified
- `apps/api/prisma/schema.prisma` (User and UserEmail models)
- `apps/api/src/app.module.ts` (Added AuthModule)
- `apps/web/components/dashboard/StudentDashboard.tsx` (Added modal)
