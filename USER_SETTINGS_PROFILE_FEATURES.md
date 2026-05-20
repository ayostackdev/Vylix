# User Settings & Profile Enhancements

This document outlines the five major feature additions to Campulse for enhanced user settings and profile management:
1. Dual-Identity Management (Settings)
2. Offline Storage & Cache Control (Settings)
3. Gamified Academic Contributions (Profile)
4. Privacy and Stealth Mode (Settings)
5. Dynamic Academic Identity (Profile)

---

## 1. Dual-Identity Management (Settings)

### Overview
Users can now manage multiple email addresses linked to their account, with a dedicated "Linked Accounts" settings section. This ensures students have a fallback email to maintain vault access after graduation.

### Database Schema
```prisma
model UserEmail {
  id        String   @id @default(uuid())
  email     String   @unique
  userId    String
  isPrimary Boolean  @default(false)
  isVerified Boolean @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Frontend Components

#### `LinkedAccountsSettings.tsx`
- **Location**: `apps/web/components/settings/LinkedAccountsSettings.tsx`
- **Features**:
  - Display all linked emails
  - Show primary/verified status
  - Add new email via form
  - Set primary email with one click
  - Remove emails (with safety checks)

#### `useEmailLinking.ts` Hook
- Already implemented in previous step
- Handles API calls for email management

### API Endpoints (from previous implementation)
```
POST   /auth/link-email              - Link new email
GET    /auth/emails/:userId          - Get all linked emails
PUT    /auth/primary-email/:userId   - Set primary email
POST   /auth/verify-email/:userId    - Mark email verified
DELETE /auth/emails/:userId/:email   - Remove email
```

### User Flow
1. Student logs in with institutional email
2. Navigates to Settings → Linked Accounts
3. Sees current institutional email marked as primary
4. Clicks "Add Another Email"
5. Enters Gmail address
6. System links via Supabase OAuth
7. Email becomes available as fallback
8. After graduation, alumni system switches primary to personal email

---

## 2. Offline Storage & Cache Control (Settings)

### Overview
Students using Private Vault to save PDFs for offline reading need to manage local device storage. This feature shows exact storage usage and provides cache clearing options.

### Frontend Implementation

#### `useStorageManagement.ts` Hook
- **Location**: `apps/web/hooks/useStorageManagement.ts`
- **Key Functions**:
  - `calculateStorageUsage()` - Uses Storage API + IndexedDB queries
  - `clearLocalCache()` - Clears all cached PDFs
  - `removeVaultItem()` - Delete individual PDFs
  - `formatStorageSize()` - Convert bytes to readable format

#### `StorageManagementSettings.tsx`
- **Location**: `apps/web/components/settings/StorageManagementSettings.tsx`
- **Features**:
  - Visual storage progress bar
  - Storage usage percentage
  - List of saved PDFs with individual sizes
  - Remove button for each item
  - "Clear All" button with confirmation
  - Storage limit warnings (50MB assumed limit)

### Storage Flow
```typescript
// Get storage stats
const { storageStats, formatStorageSize } = useStorageManagement();

// Display
- Total storage: 32 MB of 50 MB (64% used)
- Items: 12 saved PDFs
- List with individual sizes and dates

// Actions
- Remove individual PDF: 2 MB freed
- Clear all: 32 MB freed
```

### Technical Details
- Uses **Storage API** (`navigator.storage.estimate()`) for accurate quota
- Falls back to **IndexedDB** manual counting
- Limit: ~50MB per app (device-dependent)
- Storage persists until:
  - User clears cache manually
  - User uninstalls app
  - Browser clears app data

### Database Note
- No backend storage tracking (device-side only)
- Vault items remain in backend database
- Only IndexedDB cache is cleared

---

## 3. Gamified Academic Contributions (Profile)

### Overview
Encourage student participation by displaying badges, contribution scores, and leaderboards on their public profile.

### Database Schema
```prisma
model Badge {
  id          String      @id @default(uuid())
  code        String      @unique     // e.g., "top-contributor"
  name        String
  description String
  icon        String      // URL/emoji
  rarity      BadgeRarity @default(COMMON)
  criteria    String
  users       UserBadge[]
}

model UserBadge {
  id       String   @id @default(uuid())
  userId   String
  badgeId  String
  earnedAt DateTime @default(now())
  awardedBy String?
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  @@unique([userId, badgeId])
}

enum BadgeRarity {
  COMMON      // 10 points
  RARE        // 25 points
  EPIC        // 50 points
  LEGENDARY   // 100 points
}
```

### Backend Services

#### `BadgeService`
- **Location**: `apps/api/src/core/services/badge.service.ts`
- **Methods**:
  - `createBadge()` - Create new badge template
  - `awardBadge()` - Award badge to user (admin)
  - `getUserBadges()` - Fetch user's badges + score
  - `removeBadge()` - Remove badge from user
  - `getContributionLeaderboard()` - Top 50 contributors
  - `getAllBadges()` - Get all badge templates

### Badge Examples

| Badge | Code | Rarity | Points | Criteria |
|-------|------|--------|--------|----------|
| Top Contributor | top-contributor | EPIC | 50 | 50+ materials uploaded |
| COLENG Scholar | coleng-scholar | RARE | 25 | Active in engineering dept |
| Question Master | question-master | RARE | 25 | 20+ questions answered |
| Study Group Host | study-group-host | EPIC | 50 | 10+ lessons hosted |
| Legendary Mentor | legendary-mentor | LEGENDARY | 100 | 100+ contributions + mentor |

### Frontend Components

#### `ContributionDisplay.tsx`
- **Location**: `apps/web/components/profile/ContributionDisplay.tsx`
- **Features**:
  - Score display with trophy emoji
  - Badge grid with hover tooltips
  - Rarity color coding
  - Earned date for each badge
  - Badge info legend (point values)

#### `ContributionLeaderboard.tsx`
- **Location**: `apps/web/components/profile/ContributionDisplay.tsx` (same file)
- **Features**:
  - Top 50 students ranked
  - Rank medals (🥇 🥈 🥉)
  - Avatar, name, college
  - Score and badge count
  - Hover effects

#### `useBadges.ts` Hook
- **Location**: `apps/web/hooks/usePrivacySettings.ts` (included)
- **Methods**:
  - `getUserBadges()` - Fetch user's badges
  - `getLeaderboard()` - Fetch top contributors
  - `getAllBadges()` - Fetch all available badges

### Score Calculation
```typescript
// When badge is awarded
const scoreBonus = {
  COMMON: 10,
  RARE: 25,
  EPIC: 50,
  LEGENDARY: 100
};

user.contributionScore += scoreBonus[badge.rarity];
```

### API Endpoints
```
GET    /settings/badges/:userId       - Get user's badges + score
POST   /settings/badges/:userId       - Award badge (admin)
DELETE /settings/badges/:userId/:code - Remove badge
GET    /settings/badges/all           - Get all badges
GET    /settings/leaderboard          - Get top 50 contributors
```

### User Flow
1. Student uploads material → triggers `AwardBadge()` service
2. Badge added → user score updated
3. Profile component shows badge in grid
4. Leaderboard updates in real-time
5. Other students see badges and scores
6. Encourages more participation

---

## 4. Privacy and "Stealth Mode" (Settings)

### Overview
Students can enable "Stealth Mode" to post anonymously in the Public Pulse without revealing their identity, lowering the barrier to participation.

### Database Schema
```prisma
model UserPrivacy {
  id              String   @id @default(uuid())
  userId          String   @unique
  isStealthMode   Boolean  @default(false)
  showContributions Boolean @default(true)
  showEmail       Boolean  @default(false)
  showDepartment  Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  // ... existing fields
  privacy UserPrivacy?
}
```

### Backend Services

#### `PrivacyService`
- **Location**: `apps/api/src/core/services/privacy.service.ts`
- **Methods**:
  - `getPrivacySettings()` - Fetch or create defaults
  - `updatePrivacySettings()` - Update multiple settings
  - `toggleStealthMode()` - Toggle anonymous mode
  - `getPublicDisplayName()` - Get name for display (respects stealth mode)
  - `getPublicUserProfile()` - Sanitized profile based on privacy

### Frontend Components

#### `PrivacySettingsComponent.tsx`
- **Location**: `apps/web/components/settings/PrivacySettingsComponent.tsx`
- **Features**:
  - Stealth Mode toggle (prominent UI)
  - Checkbox for "Show Badges"
  - Checkbox for "Show Department"
  - Checkbox for "Show Email"
  - Profile preview section
  - Best practices info box

#### `usePrivacySettings.ts` Hook
- **Location**: `apps/web/hooks/usePrivacySettings.ts`
- **Methods**:
  - `getPrivacySettings()` - Fetch current settings
  - `updatePrivacySettings()` - Update settings
  - `toggleStealthMode()` - Toggle with confirmation

### Stealth Mode Logic

**When enabled:**
- Posts show "Anonymous Student" instead of real name
- Avatar shows generic icon
- Department/college info hidden
- Badges still visible (shows contributions)
- Profile still unique (by ID)

**Advantages:**
- Ask embarrassing questions
- Share struggles without judgment
- Participate in discussions freely
- Fear-free learning environment

**How it works:**
```typescript
// In Post creation
const displayName = await privacyService.getPublicDisplayName(userId);
// Returns: "Anonymous Student" if stealth mode ON
// Returns: user.fullName if stealth mode OFF

post.authorName = displayName;
```

### API Endpoints
```
GET    /settings/privacy/:userId              - Get privacy settings
PUT    /settings/privacy/:userId              - Update settings
POST   /settings/stealth-mode/:userId         - Toggle stealth mode
GET    /settings/public-profile/:userId       - Get sanitized profile
```

### Privacy Settings Controls
1. **Stealth Mode**: Posts appear as "Anonymous Student"
2. **Show Contributions**: Display badges and score
3. **Show Department**: Display college/department info
4. **Show Email**: Make email publicly visible (warning!)

---

## 5. Dynamic Academic Identity (Profile)

### Overview
The user profile displays a digital ID card showing college, department, and level, which updates automatically without manual intervention.

### Frontend Implementation

#### `useDynamicAcademicLevel.ts` Hook
- **Location**: `apps/web/hooks/useDynamicAcademicLevel.ts`
- **Logic**:
  - Calculates current level based on entry year
  - Accounts for academic session start (August)
  - Returns level, display string, elapsed years, etc.

```typescript
// Academic session calculation
const currentSession = currentMonth >= 7 ? currentYear : currentYear - 1;
const yearsElapsed = currentSession - entryYear;
const level = Math.max(100, Math.min(500, (yearsElapsed + 1) * 100));

// Example: Entry 2021, Current 2024
// Current session: 2024 (if after Aug)
// Elapsed: 3 years
// Level: 400L
```

#### Academic Levels
| Level | Year | Name |
|-------|------|------|
| 100L | 1st | Freshman |
| 200L | 2nd | Sophomore |
| 300L | 3rd | Junior |
| 400L | 4th | Senior |
| 500L | 5th | Final Year |

#### Helper Functions
- `formatAcademicLevel()` - Convert 300 to "300L (Junior)"
- `getAcademicLevelName()` - Get level name
- `getLevelColor()` - Return color for badge

#### `AcademicIdentityCard.tsx`
- **Location**: `apps/web/components/profile/AcademicIdentityCard.tsx`
- **Display**:
  - Gradient card design (looks like ID)
  - Profile picture in circle
  - Full name and matric number
  - Current level badge (auto-updated)
  - Entry year
  - College code and name
  - Department code and name
  - Status badge (STUDENT/ALUMNI/GRADUATED)
  - Footer explaining auto-update

### Database
```prisma
model User {
  id           String @id @default(uuid())
  fullName     String
  matricNumber String @unique
  entryYear    Int
  currentLevel String?  // Can be calculated but stored for efficiency
  collegeId    String
  departmentId String
}
```

### Features
✅ Automatic level progression (no manual updates)
✅ Correct accounting for academic sessions
✅ Visual ID card format
✅ Shows all key info at a glance
✅ Updates without user action
✅ Respects graduation date

### User Flow
1. Student views profile
2. `AcademicIdentityCard` renders with:
   - Entry year: 2021
   - Current session: 2024
   - Calculated level: 400L (Senior)
3. At start of next session (Aug 1):
   - Level auto-updates to 500L (if still in school)
4. After graduation:
   - Status changes to ALUMNI
   - Card displays graduation date

---

## Database Migrations

### Migration 1: Add User Settings & Gamification
- **File**: `apps/api/prisma/migrations/add_user_settings_gamification/migration.sql`
- **Changes**:
  - Adds `bio`, `avatarUrl`, `contributionScore`, `updatedAt` to User
  - Creates `UserPrivacy` table
  - Creates `UserProfile` table
  - Creates `Badge` table
  - Creates `UserBadge` junction table
  - Adds `BadgeRarity` enum

### Running Migrations
```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

---

## API Summary

### Settings Controller
- **Location**: `apps/api/src/settings/settings.controller.ts`
- **Module**: `SettingsModule` (added to `AppModule`)

#### Endpoints
```
# Privacy
GET    /settings/privacy/:userId
PUT    /settings/privacy/:userId
POST   /settings/stealth-mode/:userId
GET    /settings/public-profile/:userId

# Badges
GET    /settings/badges/:userId
POST   /settings/badges/:userId
DELETE /settings/badges/:userId/:badgeCode
GET    /settings/badges/all
GET    /settings/leaderboard
```

---

## Usage Examples

### Award Badge to User
```typescript
// Backend
await badgeService.awardBadge({
  userId: 'student-123',
  badgeCode: 'top-contributor',
  awardedBy: 'admin-id'
});
```

### Get User's Badges
```typescript
// Frontend
const { getUserBadges } = useBadges();
const badgeData = await getUserBadges(userId);
// Returns: { contributionScore, badges, totalBadges }
```

### Toggle Stealth Mode
```typescript
// Frontend
const { toggleStealthMode } = usePrivacySettings();
const result = await toggleStealthMode(userId);
// Returns: { success, isStealthMode, message }
```

### Calculate Academic Level
```typescript
// Frontend
const levelInfo = useDynamicAcademicLevel(2021); // entry year
// Returns: { level: 400, levelDisplay: '400L', yearsElapsed: 3, ... }
```

### Manage Storage
```typescript
// Frontend
const { storageStats, clearLocalCache, formatStorageSize } = useStorageManagement();

// Show stats
console.log(formatStorageSize(storageStats.totalSize)); // "32.5 MB"

// Clear all
await clearLocalCache();
```

---

## Deployment Checklist

### Backend
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Regenerate Prisma: `npx prisma generate`
- [ ] Add `SettingsModule` to `AppModule` ✅
- [ ] Export `BadgeService` and `PrivacyService` ✅
- [ ] Test badge endpoints
- [ ] Test privacy toggle
- [ ] Test stealth mode display name lookup

### Frontend
- [ ] Test Academic ID card renders
- [ ] Test dynamic level calculation
- [ ] Test linked accounts UI
- [ ] Test storage management
- [ ] Test privacy settings toggles
- [ ] Test stealth mode toggle
- [ ] Test badge display
- [ ] Test leaderboard

### Database
- [ ] Backup production database
- [ ] Deploy migration
- [ ] Verify tables created
- [ ] Check foreign key constraints
- [ ] Verify indexes

---

## Testing Guide

### Test Scenario 1: Dynamic Academic Level
1. Create student with entry year 2021
2. Check profile → Should show 400L (if current session is 2024)
3. Verify color coding
4. Check that level auto-updates without action

### Test Scenario 2: Stealth Mode
1. Enable stealth mode in settings
2. Create post in Public Pulse
3. Post should show "Anonymous Student"
4. Disable stealth mode
5. New post should show real name

### Test Scenario 3: Badge Awarding
1. Admin awards "Top Contributor" badge to user
2. User opens profile
3. Badge appears in grid with rarity color
4. Contribution score increased by 50 points
5. User appears on leaderboard

### Test Scenario 4: Storage Management
1. Save 3 PDFs to vault (10MB, 15MB, 8MB = 33MB total)
2. Open storage settings
3. Shows 33MB used, 65% of 50MB limit
4. Shows 3 items in list
5. Remove one item → 23MB remaining
6. Clear all → 0MB, empty list

### Test Scenario 5: Linked Accounts
1. Student has institutional email
2. Navigate to Linked Accounts
3. Shows institutional email as Primary/Verified
4. Click "Add Email", enter Gmail
5. Verify via OAuth
6. Now shows 2 emails
7. Can set either as primary

---

## Notes for Developers

### Score Calculation
- Awarded on badge creation
- Removed on badge deletion
- Automatically triggers leaderboard update
- Used for gamification and recognition

### Stealth Mode Scope
- Only affects Public Pulse posts
- Does NOT hide from admins
- Does NOT change user's actual permissions
- Profile still shows ID number (for followers)
- Badges still visible (for motivation)

### Storage Limits
- ~50MB per app (device/browser dependent)
- User-controlled clearing
- NOT synced to backend
- Cleared on app uninstall

### Privacy Settings
- Fully user-controlled
- Can be changed anytime
- Affects profile visibility only
- Never affects data security
- Stored in `UserPrivacy` table

---

## Files Created/Modified

### Created
- `apps/api/src/core/services/badge.service.ts`
- `apps/api/src/core/services/privacy.service.ts`
- `apps/api/src/settings/settings.controller.ts`
- `apps/api/src/settings/settings.module.ts`
- `apps/api/prisma/migrations/add_user_settings_gamification/migration.sql`
- `apps/web/hooks/useStorageManagement.ts`
- `apps/web/hooks/usePrivacySettings.ts`
- `apps/web/hooks/useDynamicAcademicLevel.ts`
- `apps/web/components/profile/AcademicIdentityCard.tsx`
- `apps/web/components/profile/ContributionDisplay.tsx`
- `apps/web/components/settings/LinkedAccountsSettings.tsx`
- `apps/web/components/settings/StorageManagementSettings.tsx`
- `apps/web/components/settings/PrivacySettingsComponent.tsx`

### Modified
- `apps/api/prisma/schema.prisma` (User, UserPrivacy, UserProfile, Badge, UserBadge models + BadgeRarity enum)
- `apps/api/src/app.module.ts` (Added SettingsModule)
