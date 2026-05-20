# Email Linking Quick Reference

## Common Tasks

### 1. Link Email Programmatically (Backend)
```typescript
// In your service
constructor(private emailLinkingService: EmailLinkingService) {}

async linkPersonalEmail(userId: string, personalEmail: string) {
  return await this.emailLinkingService.linkEmailToUser({
    userId,
    email: personalEmail,
    provider: 'email'
  });
}
```

### 2. Get All Emails for a User
```typescript
const userEmails = await this.emailLinkingService.getUserEmails(userId);
console.log(userEmails.primaryEmail); // Currently active email
```

### 3. Switch Primary Email on Alumni Graduation
```typescript
// Automatically done by AlumniService cron job
// But can be done manually:
await this.emailLinkingService.setPrimaryEmail(userId, personalEmail);
```

### 4. Link OAuth Identity (Frontend)
```typescript
import { useEmailLinking } from '@/hooks/useEmailLinking';

const { linkIdentity } = useEmailLinking();

const handleGoogleLink = async () => {
  await linkIdentity({
    userId: user.id,
    email: googleEmail,
    provider: 'google'
  });
};
```

### 5. Show Email Linking Modal
```typescript
import { EmailLinkingModal } from '@/components/auth/EmailLinkingModal';
import { useEmailLinkingModal } from '@/hooks/useEmailLinkingModal';

const MyDashboard = () => {
  const { shouldShowModal, primaryEmail, dismissModal, onSuccess } = useEmailLinkingModal();

  return (
    <EmailLinkingModal
      isOpen={shouldShowModal}
      userId={user.id}
      currentEmail={user.email || primaryEmail}
      onClose={dismissModal}
      onSuccess={onSuccess}
    />
  );
};
```

### 6. Check User Alumni Status in Frontend
```typescript
const { data: { user } } = await supabase.auth.getUser();
const response = await fetch(`/api/auth/emails/${user.id}`);
const { emails } = await response.json();

const hasPersonalEmail = emails.some(
  e => !e.email.endsWith('@student.funaab.edu.ng')
);
```

### 7. Manually Trigger Alumni Detection (Testing)
```bash
# SSH into your NestJS server or use admin panel
curl -X POST http://localhost:3000/maintenance/detect-alumni

# Or in NestJS CLI:
nest start --debug
# Then inspect: alumniService.detectAndProcessAlumni()
```

### 8. Query Alumni Users
```typescript
// Get all alumni
const alumni = await prisma.user.findMany({
  where: { status: 'ALUMNI' },
  include: { emails: true }
});

// Get specific alumni with primary email
const alumni = await prisma.user.findMany({
  where: { status: 'ALUMNI' },
  include: {
    emails: {
      where: { isPrimary: true }
    }
  }
});
```

### 9. Handle Email Conflicts
```typescript
try {
  await emailLinkingService.linkEmailToUser({
    userId,
    email: duplicateEmail
  });
} catch (error) {
  if (error.message.includes('already linked')) {
    // Email is already linked to another user
    // Show user a different email
  }
}
```

### 10. Audit User Email Changes
```typescript
// Query all email changes (if logging implemented)
const emailHistory = await prisma.emailAuditLog.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' }
});
```

## Database Queries

### Find users with both institutional and personal emails
```sql
SELECT u.id, u."matricNumber"
FROM "User" u
WHERE EXISTS (
  SELECT 1 FROM "UserEmail" ue1
  WHERE ue1."userId" = u.id
  AND ue1.email LIKE '%@student.funaab.edu.ng%'
)
AND EXISTS (
  SELECT 1 FROM "UserEmail" ue2
  WHERE ue2."userId" = u.id
  AND ue2.email NOT LIKE '%@student.funaab.edu.ng%'
);
```

### Find users missing personal emails (at-risk graduates)
```sql
SELECT u.id, u."matricNumber", u.status
FROM "User" u
WHERE u.status = 'STUDENT'
AND NOT EXISTS (
  SELECT 1 FROM "UserEmail" ue
  WHERE ue."userId" = u.id
  AND ue.email NOT LIKE '%@student.funaab.edu.ng%'
);
```

### Find duplicate emails (should be 0)
```sql
SELECT email, COUNT(*) as count
FROM "UserEmail"
GROUP BY email
HAVING COUNT(*) > 1;
```

### Update primary email for newly graduated student
```sql
UPDATE "UserEmail"
SET "isPrimary" = false
WHERE "userId" = $1
AND email LIKE '%@student.funaab.edu.ng%';

UPDATE "UserEmail"
SET "isPrimary" = true
WHERE "userId" = $1
AND email NOT LIKE '%@student.funaab.edu.ng%'
LIMIT 1;
```

## Environment Setup

### Backend
```bash
# Add to .env in apps/api
SUPABASE_JWT_SECRET=your-secret-here
SUPABASE_URL=https://your-project.supabase.co

# Run migration
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

### Frontend
```bash
# Add to .env.local in apps/web
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Install dependencies
npm install @supabase/auth-helpers-react @supabase/supabase-js
```

## Debugging Tips

### Check if EmailLinkingService is registered
```bash
# In NestJS console, run:
module.get(EmailLinkingService); // Should not throw
```

### Verify Prisma schema change
```bash
# View current schema
npx prisma db pull

# Check migration history
npx prisma migrate status
```

### Test email linking endpoint
```bash
curl -X POST http://localhost:3000/auth/link-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "userId": "user-id",
    "email": "personal@gmail.com",
    "provider": "email"
  }'
```

### Monitor alumni cron job
```typescript
// In AlumniService
private readonly logger = new Logger(AlumniService.name);

// Logs appear in console with [AlumniService] prefix
// grep logs: | grep AlumniService
```

## Troubleshooting

**Issue**: Modal keeps appearing on every login
- **Check**: localStorage - `email-linking-dismissed` should be set to `'true'`
- **Fix**: Clear localStorage between tests: `localStorage.clear()`

**Issue**: Email link fails with "already linked"
- **Check**: Query UserEmail table for duplicate emails
- **Fix**: Use database query above to find and clean up

**Issue**: Alumni not being detected
- **Check**: Academic session calculation - ensure month >= 7
- **Check**: User entryYear and college duration values
- **Fix**: Manually run `detectAndProcessAlumni()` for testing

**Issue**: Can't log in after email linking
- **Check**: Verify SupabaseAuthGuard accepts all linked emails
- **Check**: Ensure JWT email claim matches one of UserEmail records
- **Fix**: Add debug logging to guard to see which emails are being checked
