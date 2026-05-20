# Campulse - Architecture & Feature Map

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CAMPULSE PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐         ┌────────────────────┐   │
│  │   Frontend Layer     │         │  Backend Layer     │   │
│  │   (Next.js + React)  │         │ (NestJS + Express) │   │
│  ├──────────────────────┤         ├────────────────────┤   │
│  │                      │         │                    │   │
│  │ 📱 UI Components     │         │ 🛠️ Services       │   │
│  │  - Dashboard         │         │  - BadgeService    │   │
│  │  - Profile           │◄─────►│  - PrivacyService  │   │
│  │  - Settings          │  REST  │  - EmailLinking    │   │
│  │  - Identity Card     │  API   │  - MaterialsService│   │
│  │                      │         │                    │   │
│  │ ⚙️ Hooks             │         │ 🔐 Guards          │   │
│  │  - usePrivacySettings│         │  - SupabaseAuth    │   │
│  │  - useBadges         │         │  - Department      │   │
│  │  - useStorageManage  │         │  - Tenant          │   │
│  │  - useDynamicLevel   │         │                    │   │
│  │                      │         │ 🎯 Controllers     │   │
│  │ 💾 Storage           │         │  - SettingsCtrl    │   │
│  │  - IndexedDB         │         │  - AuthCtrl        │   │
│  │  - React Query       │         │  - MaterialsCtrl   │   │
│  └──────────────────────┘         └────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Database Layer (PostgreSQL)                  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ User, UserEmail, UserPrivacy, UserProfile           │   │
│  │ Badge, UserBadge (Gamification)                      │   │
│  │ College, Department, Course, Topic                  │   │
│  │ Material, Lesson, RSVP (Courses & Content)          │   │
│  │ Post, Comment (Public Pulse)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    External Services                                 │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 🔐 Supabase Auth (JWT-based)                         │   │
│  │ 📄 File Storage (Cloud)                              │   │
│  │ 🎯 WebSocket Gateway (Real-time)                    │   │
│  │ 🤖 Python Microservice (OCR/Document Processing)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Feature Map

```
CAMPULSE
│
├── 👥 AUTHENTICATION & PROFILES
│   ├── Supabase JWT Login
│   ├── Multi-Email Support
│   ├── Dual-Email Architecture
│   └── Digital Academic Identity Card
│
├── 📢 PUBLIC PULSE (Community)
│   ├── Post Creation & Sharing
│   ├── Topic-Based Organization
│   ├── Comments & Engagement
│   ├── Real-time Feed
│   ├── Stealth Mode (Anonymous)
│   └── Search & Filtering
│
├── 🔒 PRIVATE VAULT (Personal Storage)
│   ├── Upload & Organize PDFs
│   ├── Offline Access (IndexedDB)
│   ├── Storage Management Dashboard
│   ├── Cache Control
│   └── Search & Retrieval
│
├── 📚 LESSONS & SESSIONS (Peer Teaching)
│   ├── Host Revision Sessions
│   ├── Join Study Groups
│   ├── RSVP Management
│   ├── Real-time Updates (WebSocket)
│   ├── Level-Based Filtering
│   └── Gamification for Hosts
│
├── 🎮 GAMIFICATION SYSTEM
│   ├── Badge Earning (4 rarity levels)
│   ├── Contribution Score Tracking
│   ├── Leaderboard Rankings
│   ├── Achievement Badges
│   ├── Public Recognition
│   └── Motivation & Engagement
│
├── 🔐 PRIVACY & SECURITY
│   ├── Stealth Mode (Anonymous Posting)
│   ├── Granular Privacy Settings
│   ├── Profile Visibility Control
│   ├── Email Privacy Toggle
│   ├── Department Visibility Control
│   └── Contributions Visibility Toggle
│
├── ⚙️ USER SETTINGS
│   ├── Linked Accounts Management
│   │   ├── Add Multiple Emails
│   │   ├── Switch Primary Email
│   │   ├── Email Verification
│   │   └── Email Removal
│   │
│   ├── Storage Management
│   │   ├── View Usage Statistics
│   │   ├── Remove Individual Items
│   │   ├── Clear All Cache
│   │   └── Storage Quota Alerts
│   │
│   └── Privacy Settings
│       ├── Stealth Mode Toggle
│       ├── Profile Visibility
│       ├── Email Visibility
│       └── Department Visibility
│
├── 🏛️ ACADEMIC HIERARCHY
│   ├── Colleges (COLCOM, COLENG, COLPHYS)
│   ├── Departments (10+)
│   ├── Courses (by Level & Dept)
│   ├── Topics (Sub-topics)
│   ├── Materials (PDFs & Resources)
│   └── Lessons (Study Sessions)
│
└── 📊 ANALYTICS & ADMIN
    ├── Leaderboards
    ├── Contribution Tracking
    ├── Badge Management
    ├── User Activity
    └── Content Moderation (Future)
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────┐
│   User Action   │
│  (e.g., upload  │
│   material)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Frontend (React Component)         │
│  - Validates input                  │
│  - Shows loading state              │
│  - Handles errors                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   API Call (HTTP POST/GET/PUT)      │
│  - Includes JWT token               │
│  - Sends data payload               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   NestJS Controller                 │
│  - Routes request                   │
│  - Parses parameters                │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Guards (Authentication)           │
│  - SupabaseAuthGuard validates JWT  │
│  - Loads user context               │
│  - Checks permissions               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Business Logic (Service)          │
│  - BadgeService                     │
│  - PrivacyService                   │
│  - MaterialsService                 │
│  - Performs operations              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Prisma ORM Query                  │
│  - Generates SQL                    │
│  - Validates schema                 │
│  - Executes on PostgreSQL           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Database (PostgreSQL)             │
│  - Updates/reads data               │
│  - Maintains constraints            │
│  - Returns result                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Response Formatting               │
│  - JSON serialization               │
│  - Error handling                   │
│  - Status codes (200, 404, 500)     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Frontend (React Component)        │
│  - Receives response                │
│  - Updates state                    │
│  - Shows success/error              │
│  - Renders UI update                │
└─────────────────────────────────────┘
```

---

## 🎯 Feature Priority Matrix

```
          High Impact
               │
          ┌────┼────┐
          │    │    │
Badges ◄──┼─ X │ X ┼──► Stealth Mode
Gamif.    │    │    │   (Low effort)
(High     ├────┼────┤
effort)   │    │    │
          │ X  │ X  │
          └────┼────┘
               │
          Low Impact
          
X = Implemented feature
Quick wins (top-right): Stealth Mode, Privacy Controls
Major efforts (top-left): Badges, Gamification
Maintenance (bottom-left): Admin tools
Nice-to-haves (bottom-right): Analytics
```

---

## 🔐 Authentication Flow

```
┌─────────────┐
│   Student   │
│  Sign Up    │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│   Supabase Auth      │
│  (Email + Password)  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  JWT Token Created   │
│  (Access + Refresh)  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  User Record in PostgreSQL       │
│  - id, email, entryYear, etc     │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  UserEmail Record Created        │
│  - Institutional email linked    │
│  - Marked as primary             │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Dashboard Access Granted        │
│  - Can browse Public Pulse       │
│  - Can upload to Vault           │
│  - Profile auto-created          │
└──────────────────────────────────┘
```

---

## 🎓 Student Lifecycle

```
Year 1 (100L)                Year 2 (200L)
    │                             │
    │ Enrolls                      │ Progresses
    ▼                             ▼
┌─────────────┐             ┌─────────────┐
│  STUDENT    │ ──────────► │  STUDENT    │
│  100L       │  Aug 1      │  200L       │
│  Active     │             │  Active     │
└─────────────┘             └─────────────┘
    │                             │
    │ (Repeat)                    │ (Repeat)
    ▼                             ▼
┌─────────────┐             ┌─────────────┐
│  STUDENT    │ ──────────► │  STUDENT    │
│  300L       │  Aug 1      │  400L       │
│  Active     │             │  Active     │
└─────────────┘             └─────────────┘
    │                             │
    │ (Repeat)                    │ (Final Year)
    ▼                             ▼
                            ┌─────────────┐
                            │  STUDENT    │
                            │  500L       │
                            │  Active     │
                            └──────┬──────┘
                                   │
                                   │ Graduates
                                   ▼
                            ┌─────────────┐
                            │   ALUMNI    │
                            │  No level   │
                            │  Inactive*  │
                            └─────────────┘
                            
*Can still access Vault & contributions
**Vault access uses fallback/personal email
```

---

## 📱 Screen Flow

```
                    ┌──────────────┐
                    │   Login      │
                    └────────┬─────┘
                             │
                    ┌────────▼─────────┐
                    │   Dashboard      │
                    │   (Hub)          │
                    └───┬────┬────┬────┘
                        │    │    │
            ┌───────────┘    │    └──────────┐
            │                │               │
            ▼                ▼               ▼
        ┌────────┐      ┌────────┐      ┌────────┐
        │ Public │      │Private │      │Lessons │
        │ Pulse  │      │ Vault  │      │        │
        └────┬───┘      └────┬───┘      └────┬───┘
             │               │               │
      ┌──────┘               │               │
      │              ┌───────┴────────┐      │
      │              │                │      │
      ▼              ▼                ▼      ▼
   Browse    Storage Mgmt        Join     Profile
   Posts     Settings            Session   ↓
   ↓         Cache Clear         ↓         ID Card
   New       Download PDF        RSVP      Badges
   Post                          Attend    Leaderboard
   ↓
┌──────────────┐
│   Settings   │
├──────────────┤
│ Linked       │
│ Accounts     │
│ Privacy      │
│ Storage      │
└──────────────┘
```

---

## 🔄 Leaderboard Update Flow

```
Badge Awarded to User
    │
    ├─► Add UserBadge record
    │
    ├─► Calculate score bonus
    │   (COMMON: +10, RARE: +25, EPIC: +50, LEGENDARY: +100)
    │
    ├─► Increment User.contributionScore
    │
    ├─► Query top 50 by score
    │
    ├─► Rank with medals (🥇🥈🥉)
    │
    └─► Send to frontend (all subscribers via WebSocket)
        ↓
    Students see real-time leaderboard update
    (Position change, score increase, new badges)
```

---

## 💾 Storage Architecture

```
┌─────────────────────────────────────────┐
│        CLIENT DEVICE STORAGE            │
├─────────────────────────────────────────┤
│                                         │
│  IndexedDB: campulse-vault              │
│  └─ Object Store: vaultItems           │
│     ├─ id: string (PK)                 │
│     ├─ title: string                   │
│     ├─ blob/file: Blob                 │
│     ├─ size: number (bytes)            │
│     └─ savedAt: DateTime               │
│                                         │
│  Limit: ~50MB per app (browser)         │
│  Persists: Until cache cleared/uninstall│
│  Synced: NO (offline only)              │
│                                         │
├─────────────────────────────────────────┤
│  Storage API (navigator.storage)        │
│  └─ estimate(): {usage, quota}          │
│     Shows available & used quota        │
│                                         │
└─────────────────────────────────────────┘

        NOT stored in backend DB
        (Device-side only, end-to-end concept)
```

---

## 🌐 Network Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    INTERNET                                   │
└────┬─────────────────────────────────────────┬────────────────┘
     │                                         │
     ▼                                         ▼
┌──────────────────────┐         ┌──────────────────────┐
│   Frontend App       │         │  External Services  │
│   (next.js)          │         │  - Supabase Auth    │
│   Port: 3000         │         │  - File Storage     │
│   HTTP/HTTPS         │         │  - WebSocket        │
└──────┬───────────────┘         └──────────┬──────────┘
       │                                    │
       │              ┌────────────────────┘
       │              │
       ▼              ▼
┌──────────────────────────────────────────────┐
│         Backend API (NestJS/Express)         │
│         Port: 3001 or similar                │
│         REST + WebSocket                     │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│         PostgreSQL Database                  │
│         (Dockerized or Cloud)                │
└──────────────────────────────────────────────┘
```

---

## 🚀 Deployment Pipeline

```
Code Push to GitHub
    │
    ▼
GitHub Actions (CI/CD)
├─ Run TypeScript check
├─ Run ESLint
├─ Run tests
├─ Build Docker images
└─ Push to registry
    │
    ▼
Staging Environment
├─ Deploy containers
├─ Run integration tests
├─ Manual QA testing
└─ Smoke tests
    │
    ▼
Production Environment
├─ Blue-green deployment
├─ Database migrations
├─ Health checks
└─ Monitor logs
    │
    ▼
Success: App Live! 🎉
```

---

## 📈 Scaling Considerations

### Current State
- Single PostgreSQL instance
- Single NestJS backend
- Single Next.js frontend
- Suitable for ~5,000-10,000 concurrent users

### Future Scaling
```
Multiple Regions
    ├─ API Load Balancer
    ├─ Read Replicas (PostgreSQL)
    ├─ Redis Cache (leaderboard, sessions)
    ├─ CDN (static assets)
    ├─ Microservices (Python OCR service)
    └─ WebSocket servers (real-time scaling)
```

---

## 📋 Summary Table

| Aspect | Details |
|--------|---------|
| **Platform** | Academic Community Hub |
| **Users** | FUNAAB Students |
| **Core Features** | 11 major features |
| **Tech Stack** | NestJS, Next.js, PostgreSQL, Supabase |
| **Database** | PostgreSQL with Prisma ORM |
| **Authentication** | JWT via Supabase |
| **Real-time** | WebSocket Telemetry |
| **Storage** | IndexedDB (offline) + Cloud |
| **Gamification** | Badge system with 4 rarity levels |
| **Privacy** | Stealth mode + granular controls |
| **Current Users** | ~5,000+ (estimated) |
| **Load Capacity** | 10,000+ concurrent sessions |
| **Uptime Target** | 99.9% SLA |
| **Release Cycle** | Bi-weekly sprints |

---

## 🎓 Learning Paths for New Developers

### Frontend Developer
1. Learn React 18+ patterns
2. Study Next.js 13+ app router
3. Understand Tailwind CSS
4. Practice custom hooks
5. Integrate Supabase Auth

### Backend Developer
1. Master NestJS dependency injection
2. Learn Prisma ORM
3. Understand PostgreSQL queries
4. Study REST API design
5. Implement authentication guards

### Full-Stack Developer
1. Combine both paths
2. Practice data modeling
3. Build complete features (backend + frontend)
4. Understand deployment
5. Monitor production issues

---

This document provides a **complete mental model** of how Campulse works as a system. Use it as a reference for understanding architecture, data flow, and feature relationships.
