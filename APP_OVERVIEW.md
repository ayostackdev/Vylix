# Campulse - Complete App Overview

## 🎯 What is Campulse?

Campulse is a **comprehensive academic collaboration and knowledge-sharing platform** designed specifically for **FUNAAB (Federal University of Agriculture, Abeokuta)** students. It's a centralized hub that connects students, facilitates resource sharing, enables peer-to-peer learning, and gamifies academic contributions to create an engaging academic community.

**Core Mission**: Transform how students share knowledge, access learning materials, and collaborate on academic challenges while maintaining privacy and encouraging quality contributions.

---

## 📊 Key Statistics & Architecture

**Tech Stack**:
- **Backend**: NestJS (Node.js framework) + Express
- **Frontend**: Next.js 13+ (React with server-side rendering)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase (JWT-based)
- **Storage**: IndexedDB (client-side offline storage)
- **Real-time**: WebSocket support via Telemetry Gateway

**Deployment Model**: Monorepo with 3 main apps:
- `apps/api` - NestJS REST API backend
- `apps/web` - Next.js frontend application
- `apps/python-service` - Python microservice for document processing/OCR

---

## 🏗️ Core Platform Features

### 1. **Public Pulse** (Community Feeds)
**What It Is**: Public discussion forum where students share questions, insights, and academic resources with the entire university community.

**Features**:
- Post creation with rich text/media support
- Topic-based organization
- Real-time activity feed
- Like/comment system
- Search and filtering by topic/college/department
- Stealth mode (anonymous posting) to encourage questions

**User Flow**:
1. Student creates post with question or resource link
2. Community members see it in their feed (filtered by interests)
3. Other students comment or provide answers
4. Original poster accepts best answer
5. Contributors earn badges for quality contributions

**Data Model**:
```
Post → Topic → College → Department
      ↓
    Comments
      ↓
    Likes/Votes
```

---

### 2. **Private Vault** (Personal Document Repository)
**What It Is**: Secure, encrypted personal storage for academic materials (PDFs, notes, past questions).

**Features**:
- **Upload & Organize**: Upload PDFs and materials organized by topic/course
- **Offline Access**: Download PDFs to device storage for offline reading
- **Storage Management**: View how much device storage is used (IndexedDB tracking)
- **Clear Cache**: Remove offline files to free up device storage
- **Privacy**: Only visible to the user (end-to-end encrypted concept)
- **Search**: Full-text search across materials

**Technical Details**:
- IndexedDB database: `campulse-vault`
- Object store: `vaultItems`
- Storage limit: ~50MB per device (configurable)
- Data persists until user clears cache

**User Flow**:
1. Student uploads PDF or document
2. File stored in Vault
3. Can download for offline reading
4. Storage manager shows usage
5. Can remove individual files or clear all

---

### 3. **Lessons & Revision Sessions** (Peer Teaching)
**What It Is**: Scheduled sessions where students host mini-lessons or revision groups for specific topics.

**Features**:
- **Host Session**: Create revision session for a topic with time, location, max capacity
- **Join Session**: Register for sessions in your department/college
- **RSVP Management**: Track attendees and no-shows
- **Real-time Updates**: WebSocket notifications for session updates
- **Gamification**: Host earns badges for conducting quality sessions
- **Accessibility**: Filter by college, department, academic level

**Data Model**:
```
Lesson {
  id, title, topic, hostId (User), 
  scheduledTime, maxCapacity, collegeId, departmentId,
  RSVPs [] (many-to-many with User)
}
```

**Benefits**:
- Peer-to-peer learning (students teaching students)
- Flexible scheduling around academic calendar
- Builds leadership skills for hosts

---

### 4. **Academic Identity & Level Management** (NEW - Phase 2)
**What It Is**: Auto-updating digital ID card showing student's academic status.

**Features**:
- **Digital ID Card**: 
  - Full name & matric number
  - College & department with codes
  - Current academic level (100L-500L)
  - Entry year & status badge (STUDENT/ALUMNI/GRADUATED)
  - Auto-calculates level based on entry year

- **Smart Level Calculation**:
  - Accounts for academic session start (August)
  - Formula: `level = (currentSession - entryYear + 1) * 100`
  - Example: Entry 2021, Current 2024 → 400L (Senior)
  - No manual intervention needed

- **Alumni Detection**:
  - Cron job runs daily
  - Detects when student graduates
  - Automatically switches primary email to personal
  - Maintains vault access post-graduation

**User Flow**:
1. Student views profile
2. Sees Digital ID card with auto-calculated level
3. At start of next session (Aug 1), level auto-updates
4. After graduation, status changes to ALUMNI

---

### 5. **Gamified Contributions System** (NEW - Phase 2)
**What It Is**: Badge and point system encouraging quality academic contributions.

**Features**:
- **Badge System**:
  - **COMMON** (10 pts) - Green: Getting started
  - **RARE** (25 pts) - Blue: Active contributor
  - **EPIC** (50 pts) - Yellow: Subject expert
  - **LEGENDARY** (100 pts) - Purple: Community leader

- **Badge Examples**:
  - Top Contributor - 50+ materials uploaded
  - COLENG Scholar - Active in engineering dept
  - Question Master - 20+ questions answered
  - Study Group Host - 10+ lessons hosted
  - Legendary Mentor - 100+ contributions + mentorship

- **Contribution Score**:
  - Accumulates based on badge rarity
  - Displayed on profile
  - Used for leaderboards
  - Motivates continued participation

- **Leaderboard**:
  - Top 50 contributors ranked
  - Shows score, badges, college affiliation
  - Real-time updates
  - Filters for STUDENT status only

**Data Model**:
```
Badge {
  code, name, description, icon, rarity, criteria
}

UserBadge {
  userId, badgeId, earnedAt, awardedBy (optional for admin award)
}

User.contributionScore (auto-incremented when badge awarded)
```

**Automation Triggers** (Future):
- Material upload → Top Contributor badge
- Lesson hosting → Study Group Host badge
- Public Pulse activity → Question Master badge
- Consistency over time → Legendary badges

---

### 6. **Privacy & Stealth Mode** (NEW - Phase 2)
**What It Is**: Granular privacy controls and anonymous posting capability.

**Features**:
- **Stealth Mode**: Toggle to post as "Anonymous Student" in Public Pulse
  - Hides name and avatar in public posts
  - Badges still visible (shows contributions)
  - Profile still accessible by ID
  - Lowers barrier to asking questions
  - Useful for sensitive topics

- **Privacy Settings**:
  - `isStealthMode` - Anonymous posting (default: OFF)
  - `showContributions` - Display badges/score (default: ON)
  - `showDepartment` - Display college/dept (default: ON)
  - `showEmail` - Make email public (default: OFF)

- **Profile Sanitization**:
  - Own profile always shows full data
  - Others' profiles respect privacy settings
  - Email hidden by default (security)
  - Department hidden if opted out

**User Flow**:
1. Student navigates to Settings → Privacy
2. Enables Stealth Mode
3. Creates post in Public Pulse
4. Post appears as "Anonymous Student"
5. Can still earn badges and appear on leaderboard

---

### 7. **Dual-Email Architecture** (NEW - Phase 2)
**What It Is**: Support for multiple linked email addresses for account recovery and post-graduation access.

**Features**:
- **Primary & Fallback Emails**:
  - Institutional email (primary on signup)
  - Personal email (fallback for post-graduation)
  - Can switch primary email at any time
  - Only one primary at a time

- **Email Linking**:
  - Link via Supabase OAuth (Google, GitHub)
  - Manual addition for custom emails
  - Verification status tracking
  - Prevents duplicate emails across system

- **Alumni Continuity**:
  - On graduation, primary email switches to personal
  - Vault remains accessible
  - Can still view contributions & badges
  - Maintains academic history

- **Authentication**:
  - Login works with any linked email
  - Guard validates all linked emails
  - No user lockout risk

**Data Model**:
```
UserEmail {
  email (unique), userId, isPrimary, isVerified, createdAt
}

User.emails → UserEmail[] (one-to-many)
```

---

### 8. **Storage Management** (NEW - Phase 2)
**What It Is**: Dashboard for managing local device storage for offline PDF caching.

**Features**:
- **Storage Overview**:
  - Total size used (MB)
  - Percentage of ~50MB limit
  - Color-coded warning when > 80%
  - Item count

- **Storage List**:
  - All cached PDFs with individual sizes
  - Date added
  - Remove button per file
  - View in scrollable list

- **Cache Operations**:
  - **Clear Individual**: Remove one PDF
  - **Clear All**: Bulk delete with confirmation
  - Recalculate storage after deletion
  - Success/error notifications

- **Browser Compatibility**:
  - Uses Storage API for accurate quota
  - Falls back to manual IndexedDB counting
  - Works offline (no backend call needed)

**User Flow**:
1. Navigate to Settings → Storage Management
2. See current usage: "32 MB of 50 MB (64%)"
3. List of 12 saved PDFs
4. Click "Remove" to delete individual PDF
5. Or "Clear All" with confirmation to free up space

---

### 9. **Linked Accounts Management** (NEW - Phase 2)
**What It Is**: Settings interface for managing linked email addresses.

**Features**:
- **Display All Linked Emails**:
  - Email address
  - Primary badge (only one)
  - Verified badge
  - Pending verification status

- **Add New Email**:
  - Form to enter email
  - OAuth linking via Supabase
  - Automatic verification for OAuth
  - Manual email needs verification

- **Make Primary**:
  - Switch primary email to fallback
  - Atomic operation (no loss of access)
  - Useful before graduation

- **Remove Email**:
  - Can't remove if only email left
  - Prevents user lockout
  - Confirmation before delete

**User Flow**:
1. Navigate to Settings → Linked Accounts
2. See institutional email as Primary/Verified
3. Click "Add Another Email"
4. Enter personal email and verify via link
5. Now can "Make Primary" before graduation

---

### 10. **Course & Topic Organization**
**What It Is**: Hierarchical organization of academic content.

**Features**:
- **Colleges**: COLCOM (Commerce), COLENG (Engineering), COLPHYS (Physical Sciences)
- **Departments**: 10+ departments across colleges
- **Courses**: Organized by department and level (100L-500L)
- **Topics**: Sub-topics within courses for material organization
- **Materials**: Individual PDFs/resources linked to topics
- **Lessons**: Study sessions linked to topics

**Hierarchy**:
```
College
  ↓
Department
  ↓
Course (by level)
  ↓
Topic
  ↓
Material/Lesson
```

---

### 11. **Real-time Notifications** (Telemetry)
**What It Is**: WebSocket-based real-time updates for user activity.

**Features**:
- **Activity Streaming**: Live feed of platform activity
- **Session Management**: Track connected users
- **Gateway**: Telemetry gateway for efficient broadcasting
- **Broadcasting**: Notify multiple users of events (lesson updates, new posts, etc.)

**Future Capabilities**:
- Real-time leaderboard updates
- Session availability changes
- Comment notifications
- Badge earning notifications

---

## 🔐 Authentication & Authorization

### Supabase Integration
```
User Signs Up/Logs In
    ↓
Supabase Auth (JWT token)
    ↓
Guards validate JWT + user exists
    ↓
SupabaseAuthGuard loads user with all linked emails
    ↓
User context stored in ClsService
    ↓
API endpoints access user info
```

### Role-Based Access
- **Student**: Default role, can post, upload materials, host lessons
- **Admin**: Award badges, manage content moderation (future)
- **Moderator**: Review flagged content (future)

### Authorization Guards
- `SupabaseAuthGuard`: Validates JWT token
- `DepartmentGuard`: Restricts dept-specific resources
- `TenantMiddleware`: Isolates data by department (college-based)

---

## 📱 User Journey Maps

### New Student Journey
```
1. Sign Up with institutional email (@student.funaab.edu.ng)
   ↓
2. Email verified automatically
   ↓
3. Onboarded to dashboard
   ↓
4. Profile created with auto-calculated level
   ↓
5. Can immediately:
   - Browse Public Pulse
   - Join study sessions
   - Upload materials to Private Vault
   - View academic ID card
```

### Engaged Student Journey
```
1. Regular contributor to Public Pulse
   ↓
2. Earns badges from community engagement
   ↓
3. Score accumulates on profile
   ↓
4. Appears on leaderboard (motivation)
   ↓
5. Links personal email as backup
   ↓
6. Hosts revision sessions (more badges)
   ↓
7. Becomes community leader
```

### Graduating Student Journey
```
1. Reaches 5 years of study
   ↓
2. Alumni detection cron runs
   ↓
3. Status automatically changes to ALUMNI
   ↓
4. Primary email switches to personal
   ↓
5. Can still access vault
   ↓
6. Profile shows ALUMNI badge
   ↓
7. Contributions remain visible in history
```

---

## 🗄️ Database Schema Overview

### Core Models

**User**
```
- id (uuid, PK)
- fullName, matricNumber (unique), entryYear
- status (STUDENT|ALUMNI|GRADUATED)
- collegeId, departmentId (FKs)
- bio, avatarUrl
- contributionScore (default 0)
- Relations: emails, privacy, badges, profile, vault items, posts, lessons
```

**UserEmail**
```
- id, email (unique)
- userId (FK), isPrimary, isVerified
- Used for multi-email login
```

**UserPrivacy**
```
- userId (unique FK)
- isStealthMode, showContributions, showEmail, showDepartment
- Default: not stealth, visible contributions, hidden email, visible dept
```

**UserBadge**
```
- id, userId (FK), badgeId (FK), earnedAt
- Unique: (userId, badgeId) - user can't earn same badge twice
```

**Badge**
```
- id, code (unique), name, description
- icon, rarity (enum), criteria
- Lookup table for badge templates
```

**Topic**
```
- id, title, description
- collegeId, departmentId (FKs)
- authorId (FK to User)
- Organizes materials and lessons
```

**Material**
```
- id, title, fileUrl, fileSize
- topicId (FK), uploadedBy (FK to User)
- Downloads and views tracking
```

**Lesson**
```
- id, title, topic, scheduledTime
- hostId (FK to User), collegeId, departmentId
- maxCapacity, currentRSVPs
- Relations: RSVP (many-to-many with User)
```

**VaultItem**
```
- id, userId (FK), fileUrl, title
- savedAt (stored in IndexedDB, not backend DB)
```

---

## 🔄 Data Flow Examples

### Example 1: Material Upload Flow
```
Student uploads PDF
    ↓
Frontend calls POST /materials
    ↓
SupabaseAuthGuard validates JWT
    ↓
File saved to storage
    ↓
Material record created in DB
    ↓
Indexed for search
    ↓
[Future] TopContributor badge triggered if 50+ uploads
    ↓
Contribution score +50
    ↓
Leaderboard updated
```

### Example 2: Stealth Mode Post Flow
```
Student enables stealth mode (Privacy Settings)
    ↓
Creates post in Public Pulse
    ↓
POST /posts with content
    ↓
Backend calls getPublicDisplayName(userId)
    ↓
PrivacyService checks isStealthMode = true
    ↓
Returns "Anonymous Student" instead of fullName
    ↓
Post saved with authorName = "Anonymous Student"
    ↓
Post appears anonymously in feed
    ↓
Badges still visible on student's profile (public)
```

### Example 3: Academic Level Update
```
Student profile viewed
    ↓
Frontend calls useDynamicAcademicLevel(entryYear)
    ↓
Calculates:
  - Current month >= 7? (Aug onwards)
  - If yes: currentSession = currentYear
  - If no: currentSession = currentYear - 1
  - yearsElapsed = currentSession - entryYear
  - level = (yearsElapsed + 1) * 100
    ↓
Returns level 400 (Senior)
    ↓
ID Card displays: "400L (Senior)"
    ↓
No manual updates ever needed
    ↓
Automatic rollover Aug 1st to next level
```

### Example 4: Alumni Email Switch Flow
```
[Daily] Alumni Detection Cron Job Runs
    ↓
Query users where:
  - status = STUDENT
  - yearsElapsed >= 4 (or >= 5 for 5-year programs)
    ↓
For each graduating student:
  1. Find their personal email (fallback)
  2. Set personal email to isPrimary = true
  3. Set institutional email to isPrimary = false
  4. Update user.status = ALUMNI
  5. Log transition
    ↓
Student can now only login with personal email
    ↓
But vault access maintained (no account deletion)
    ↓
Profile shows ALUMNI badge
    ↓
History preserved for future reference
```

---

## 🎨 Frontend Architecture

### Page Structure
```
/
├── /dashboard
│   ├── StudentDashboard (main hub)
│   ├── PublicPulse (community feed)
│   └── PrivateVault (personal storage)
├── /profile
│   ├── [userId]
│   ├── AcademicIdentityCard (header)
│   └── ContributionDisplay (badges + leaderboard)
├── /settings
│   ├── /linked-accounts (email management)
│   ├── /privacy (stealth mode & privacy)
│   └── /storage (cache management)
├── /lessons
│   └── [lessonId] (session details)
└── /leaderboard
    └── Top 50 contributors
```

### Component Hierarchy
```
App
├── Layout (server-rendered)
│   ├── Navigation
│   └── Sidebar
├── Pages (client components with 'use client')
│   ├── Dashboard
│   │   ├── PublicPulseView
│   │   ├── PrivateVaultView
│   │   └── StudentDashboard
│   ├── Profile
│   │   ├── AcademicIdentityCard
│   │   ├── ContributionDisplay
│   │   └── ContributionLeaderboard
│   └── Settings
│       ├── LinkedAccountsSettings
│       ├── PrivacySettingsComponent
│       └── StorageManagementSettings
└── Providers
    └── QueryProvider (React Query)
```

### State Management
- **React Query**: Server state (API data)
- **Custom Hooks**: Business logic (usePrivacySettings, useBadges)
- **React State**: UI state (isLoading, error, form inputs)
- **IndexedDB**: Offline storage (vault items)

---

## 🔌 API Endpoints Summary

### Settings Endpoints
```
GET    /settings/privacy/:userId              → Fetch privacy settings
PUT    /settings/privacy/:userId              → Update privacy settings
POST   /settings/stealth-mode/:userId         → Toggle stealth mode
GET    /settings/public-profile/:userId       → Get sanitized profile

GET    /settings/badges/:userId               → Get user's badges + score
POST   /settings/badges/:userId               → Award badge (admin)
DELETE /settings/badges/:userId/:badgeCode    → Remove badge
GET    /settings/badges/all                   → Get all badge templates
GET    /settings/leaderboard                  → Get top 50 contributors
```

### Authentication Endpoints (Phase 1)
```
POST   /auth/link-email                       → Link new email
GET    /auth/emails/:userId                   → Get all linked emails
PUT    /auth/primary-email/:userId            → Switch primary email
POST   /auth/verify-email/:userId             → Mark email verified
DELETE /auth/emails/:userId/:email            → Remove email
```

### Other Modules (Existing)
```
GET    /materials                             → List materials by topic
POST   /materials                             → Upload new material
GET    /topics/:topicId/materials             → Materials for topic

GET    /lessons                               → List lessons
POST   /lessons                               → Create lesson
POST   /lessons/:lessonId/rsvp                → RSVP for lesson
```

---

## 📊 Key Metrics & Analytics

**Platform Health**:
- Active users
- Materials uploaded this month
- Lesson sessions hosted
- Average contribution score
- Leaderboard rankings

**User Engagement**:
- Public Pulse posts per day
- Comments/interactions ratio
- Vault items per user (average)
- Lesson attendance rate
- Badge earning frequency

**Academic Impact**:
- Materials by department
- Topics covered
- Lessons by level (100L-500L)
- Cross-college collaboration rate

---

## 🚀 Deployment & DevOps

### Development Workflow
```
1. Code changes on feature branch
2. TypeScript compilation check
3. ESLint/Prettier formatting
4. Build Docker images
5. Run tests
6. Deploy to staging
7. Testing & QA
8. Merge to main
9. Deploy to production
```

### Environment Configuration
```
.env.local:
- DATABASE_URL (PostgreSQL)
- SUPABASE_URL, SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL
- JWT_SECRET
- STORAGE_BUCKET_NAME
```

### Database Migrations
```
Prisma migrations in: apps/api/prisma/migrations/
1. Schema changes
2. Generate migration
3. Review SQL
4. Deploy to staging
5. Run on production
6. Regenerate Prisma Client
```

---

## 🔮 Future Roadmap

### Phase 3 (Coming)
- [ ] AI-powered study recommendations
- [ ] Content moderation system
- [ ] Advanced search with NLP
- [ ] Two-factor authentication
- [ ] Push notifications
- [ ] Mobile app (React Native)

### Phase 4 (Planned)
- [ ] Analytics dashboard
- [ ] Administrative controls
- [ ] Bulk user imports
- [ ] Custom roles & permissions
- [ ] API webhooks for integrations
- [ ] SSO with university portal

### Optimization Goals
- [ ] Leaderboard pagination (large user base)
- [ ] Badge caching strategy
- [ ] CDN for material files
- [ ] Database query optimization
- [ ] Frontend bundle size reduction

---

## 📋 Quick Reference

### For Users
- **Question**: Use stealth mode in Public Pulse
- **Share Notes**: Upload to Private Vault, share link in post
- **Earn Badges**: Contribute materials, host sessions, engage community
- **Privacy**: Check Settings for visibility controls
- **Offline Access**: Save PDFs to device via Vault

### For Developers
- **Backend**: `apps/api/src` - NestJS services & controllers
- **Frontend**: `apps/web/components` & `apps/web/hooks` - React components & custom hooks
- **Schema**: `apps/api/prisma/schema.prisma` - Data model
- **Migrations**: `apps/api/prisma/migrations/` - Version control for DB

### For Admins
- **Award Badges**: POST /settings/badges/:userId
- **View Leaderboard**: GET /settings/leaderboard
- **Manage Users**: (Future admin panel)
- **Moderation**: (Future content review)

---

## ✅ Conclusion

**Campulse** is a **community-driven academic platform** that:

1. **Connects** students across colleges/departments
2. **Facilitates** peer-to-peer learning through multiple channels
3. **Gamifies** contributions to encourage quality engagement
4. **Protects** privacy with granular controls and stealth mode
5. **Enables** offline access with local device storage
6. **Ensures** continuity through dual-email architecture
7. **Automates** academic progression without manual intervention
8. **Scales** with modern web technologies

The platform transforms how FUNAAB students learn together, share resources, and build academic community while respecting privacy and encouraging excellence.
