# User Settings & Profile Features - Quick Reference

## Features at a Glance

### 1. Linked Accounts Management
```typescript
// Show linked emails
<LinkedAccountsSettings userId={user.id} />

// Add email
POST /auth/link-email { userId, email, provider }

// Set primary
PUT /auth/primary-email/:userId { email }

// Get all emails
GET /auth/emails/:userId
```

**Use Cases:**
- Students link personal email for post-graduation access
- Multiple email login options
- Primary email used for communication

---

### 2. Storage Management
```typescript
// Get storage stats
const { storageStats, formatStorageSize } = useStorageManagement();

// Clear cache
await clearLocalCache();

// Remove item
await removeVaultItem(itemId);
```

**Displays:**
- Total local storage used (MB)
- List of saved PDFs
- Individual item sizes
- Clear all button with confirmation

---

### 3. Gamified Contributions
```typescript
// Show contributions on profile
<ContributionDisplay userId={userId} isOwnProfile={true} />

// Show leaderboard
<ContributionLeaderboard />

// Award badge (admin)
POST /settings/badges/:userId { badgeCode }

// Get leaderboard
GET /settings/leaderboard
```

**Badge Types:**
- COMMON (10 pts) - Green
- RARE (25 pts) - Blue
- EPIC (50 pts) - Yellow
- LEGENDARY (100 pts) - Purple

---

### 4. Stealth Mode & Privacy
```typescript
// Toggle stealth mode
const { toggleStealthMode } = usePrivacySettings();
await toggleStealthMode(userId);

// Get privacy settings
const settings = await getPrivacySettings(userId);

// Get public name (respects stealth)
const name = await privacyService.getPublicDisplayName(userId);
```

**Settings:**
- `isStealthMode` - Posts as "Anonymous Student"
- `showContributions` - Visible badges/score
- `showDepartment` - Show college/dept
- `showEmail` - Make email public

---

### 5. Dynamic Academic Level
```typescript
// Calculate level automatically
const levelInfo = useDynamicAcademicLevel(entryYear);
// Returns: { level: 400, levelDisplay: '400L', yearsElapsed: 3 }

// Format for display
const formatted = formatAcademicLevel(300); // "300L (Junior)"

// Show ID card
<AcademicIdentityCard
  fullName={user.fullName}
  matricNumber={user.matricNumber}
  entryYear={user.entryYear}
  // ... other props
/>
```

**Level Logic:**
```
August + onward = session starts
Session starts → Years elapsed = current session - entry year
Level = (years elapsed + 1) * 100

Example:
- Entry 2021, Current 2024 (after Aug)
- Elapsed = 2024 - 2021 = 3 years
- Level = (3 + 1) * 100 = 400L
```

---

## Database Models

### UserPrivacy
```sql
SELECT * FROM "UserPrivacy"
WHERE userId = $1;
```

### Badge
```sql
SELECT * FROM "Badge"
ORDER BY rarity DESC;
```

### UserBadge (Junction)
```sql
SELECT * FROM "UserBadge"
WHERE userId = $1
ORDER BY earnedAt DESC;
```

---

## API Endpoints Quick Map

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/settings/privacy/:userId` | Get privacy settings |
| PUT | `/settings/privacy/:userId` | Update privacy |
| POST | `/settings/stealth-mode/:userId` | Toggle stealth |
| GET | `/settings/public-profile/:userId` | Get sanitized profile |
| GET | `/settings/badges/:userId` | Get user badges + score |
| POST | `/settings/badges/:userId` | Award badge (admin) |
| DELETE | `/settings/badges/:userId/:code` | Remove badge |
| GET | `/settings/badges/all` | Get all badges |
| GET | `/settings/leaderboard` | Get top 50 contributors |

---

## Common Tasks

### Award a Badge
```typescript
// Backend
const result = await badgeService.awardBadge({
  userId: 'student-id',
  badgeCode: 'top-contributor',
  awardedBy: 'admin-id'
});
// user.contributionScore += 50
```

### Get User Contributions
```typescript
// Frontend
const { getUserBadges } = useBadges();
const data = await getUserBadges(userId);
// { userId, contributionScore: 150, badges: [...], totalBadges: 5 }
```

### Check Stealth Mode Status
```typescript
// Backend
const displayName = await privacyService.getPublicDisplayName(userId);
// "Anonymous Student" if stealthMode=true, else real name

// Use in posts
post.authorName = displayName;
```

### Display Academic Level
```typescript
// Frontend
const { level, levelDisplay } = useDynamicAcademicLevel(2021);
return <span className="badge">{levelDisplay}</span>; // "400L"
```

### Calculate Storage
```typescript
// Frontend
const { storageStats, formatStorageSize } = useStorageManagement();
console.log(formatStorageSize(storageStats.totalSize)); // "32.5 MB"
```

---

## Component Import Examples

```typescript
// Profile Components
import { AcademicIdentityCard } from '@/components/profile/AcademicIdentityCard';
import { ContributionDisplay, ContributionLeaderboard } from '@/components/profile/ContributionDisplay';

// Settings Components
import { LinkedAccountsSettings } from '@/components/settings/LinkedAccountsSettings';
import { StorageManagementSettings } from '@/components/settings/StorageManagementSettings';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';

// Hooks
import { useDynamicAcademicLevel } from '@/hooks/useDynamicAcademicLevel';
import { useStorageManagement } from '@/hooks/useStorageManagement';
import { usePrivacySettings, useBadges } from '@/hooks/usePrivacySettings';
```

---

## Settings Page Layout

```jsx
export function SettingsPage() {
  const user = useUser();
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {/* Sidebar Navigation */}
      <nav className="col-span-1">
        <ul>
          <li onClick={() => setActiveTab('account')}>Linked Accounts</li>
          <li onClick={() => setActiveTab('storage')}>Storage</li>
          <li onClick={() => setActiveTab('privacy')}>Privacy</li>
        </ul>
      </nav>

      {/* Settings Content */}
      <div className="col-span-2">
        {activeTab === 'account' && (
          <LinkedAccountsSettings userId={user.id} />
        )}
        {activeTab === 'storage' && (
          <StorageManagementSettings />
        )}
        {activeTab === 'privacy' && (
          <PrivacySettingsComponent userId={user.id} />
        )}
      </div>
    </div>
  );
}
```

---

## Profile Page Layout

```jsx
export function ProfilePage({ userId }) {
  return (
    <div className="space-y-8">
      {/* Header with ID Card */}
      <AcademicIdentityCard
        fullName={user.fullName}
        matricNumber={user.matricNumber}
        entryYear={user.entryYear}
        collegeName={user.college.name}
        departmentName={user.department.name}
        avatarUrl={user.avatarUrl}
        status={user.status}
      />

      {/* Contributions & Badges */}
      <ContributionDisplay userId={userId} />

      {/* Leaderboard */}
      <ContributionLeaderboard />
    </div>
  );
}
```

---

## Database Query Examples

### Find Top Contributors by Score
```sql
SELECT * FROM "User"
WHERE status = 'STUDENT'
ORDER BY "contributionScore" DESC
LIMIT 10;
```

### Get User's All Badges
```sql
SELECT b.*, ub."earnedAt"
FROM "UserBadge" ub
JOIN "Badge" b ON ub."badgeId" = b.id
WHERE ub."userId" = $1
ORDER BY ub."earnedAt" DESC;
```

### Check Stealth Mode
```sql
SELECT "isStealthMode" FROM "UserPrivacy"
WHERE "userId" = $1;
```

### Count Items in Local Storage
```sql
-- Note: This is frontend-side, not backend
// JavaScript IndexedDB
const count = await db.countVaultItems(); // IndexedDB query
```

---

## Troubleshooting

### Issue: Badge not showing in profile
- Check: User has badge in UserBadge table
- Check: useBadges hook is being called
- Fix: Refresh page, clear cache

### Issue: Stealth mode not working
- Check: Post creation uses getPublicDisplayName()
- Check: UserPrivacy.isStealthMode is true
- Fix: Verify PrivacyService is called before post save

### Issue: Storage shows 0
- Check: Browser allows IndexedDB storage
- Check: PDFs are actually cached
- Fix: Try adding new PDF, refresh storage page

### Issue: Academic level not updating
- Check: Entry year is set correctly
- Check: Current date is after Aug 1st (for new session)
- Fix: useDynamicAcademicLevel calculations may need debugging

---

## Environment Setup

```bash
# Backend
cd apps/api
npx prisma migrate deploy
npx prisma generate

# Frontend - no new deps needed
# (uses existing @supabase/auth-helpers-react)
```

---

## Testing Checklist

- [ ] Can link multiple emails
- [ ] Primary email switching works
- [ ] Storage tracking is accurate
- [ ] Can clear cache
- [ ] Individual items removable
- [ ] Badges display with rarity colors
- [ ] Leaderboard ranks correctly
- [ ] Stealth mode hides name
- [ ] Privacy settings persist
- [ ] Academic level auto-calculates
- [ ] ID card displays correctly
