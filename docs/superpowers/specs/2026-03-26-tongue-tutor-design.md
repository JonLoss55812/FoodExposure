# TongueTutor - Child Food Exposure Tracking App

**Tagline:** "So Your Tongue Can Learn"

## Overview

TongueTutor helps parents track their child's journey with new foods using the research-backed graduated food exposure method. Based on the SOS Approach to Feeding and related methodologies, the app tracks each food through 6 stages of acceptance (Tolerate → Interact → Smell → Touch → Taste → Eat) across 8-15+ exposures.

The app is designed for **two parents/caregivers to share** a child's profile in real-time, works on **iOS, Android, and web**, and functions **offline-first** with cloud sync.

## Target Users

- Parents of picky eaters (ages 1-10)
- Caregivers working with feeding therapists (SOS, OT, SLP)
- Parents who want to systematically expand their child's food repertoire

## Core Methodology

### The 6 Stages of Food Exposure (SOS-based)

| Stage | Icon | Description | Examples |
|-------|------|-------------|----------|
| 1. Tolerate | 👁️ | Food is present nearby | On table, on plate, in room |
| 2. Interact | 🍴 | Physical engagement without body contact | Push with fork, stir, cut |
| 3. Smell | 👃 | Olfactory exploration | Lean in, sniff, describe |
| 4. Touch | ✋ | Tactile contact | Hold, squish, put to lips |
| 5. Taste | 👅 | Oral contact | Lick, place on tongue, spit out OK |
| 6. Eat | 😋 | Consumption | Bite, chew, swallow |

### Key Research Facts
- **8-15 neutral exposures** needed for typical children to accept a food
- Most parents give up after only **3-5 attempts**
- An "exposure" includes ANY sensory interaction, not just tasting
- No pressure is fundamental — the app never frames regression as failure

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React Native + Expo (create-expo-app) | Cross-platform (iOS, Android, Web) |
| Package Manager | Bun | Fast installs |
| Routing | Expo Router v4 | File-based navigation, web support |
| Styling | Unistyles 3.0 | Performant cross-platform styles |
| State (client) | Zustand | Lightweight global state |
| Local DB | expo-sqlite + Drizzle ORM | Offline-first data storage |
| KV Storage | react-native-mmkv | Auth tokens, preferences, onboarding |
| Backend/Sync | Convex | Real-time sync, spouse sharing, auth |
| Data Fetching | TanStack Query | Cache management for Convex queries |
| Lists | FlashList | Performant scrolling lists |
| Forms | React Hook Form + Zod | Validated form inputs |
| Gestures | React Native Gesture Handler | Swipe actions (comes with Expo) |
| Animations | React Native Reanimated | Stage transitions (comes with Expo) |
| Error Tracking | Sentry | Crash/error reporting |
| Analytics | PostHog | Usage analytics, feature flags |
| Email | Sendy | Onboarding emails, weekly digests |
| Build/Deploy | EAS (Expo Application Services) | CI/CD, OTA updates, app store |

## Architecture

### Data Flow

```
[Local SQLite] ←→ [Sync Engine] ←→ [Convex Cloud]
                                        ↕
                              [Other Parent's Device]
```

1. All writes go to local SQLite first (offline-first)
2. Sync engine pushes changes to Convex when online
3. Convex notifies all connected clients of changes
4. TanStack Query manages cache invalidation

### Authentication & Sharing

- **Convex Auth** with email/password and Google OAuth
- **Family unit**: One parent creates account → gets invite code → spouse joins with code
- Both parents see the same children and data in real-time
- Role: both parents are equal (no admin/viewer distinction)

### Offline Strategy

- SQLite is the source of truth on-device
- MMKV stores: auth token, selected child ID, theme preference, onboarding state
- Convex sync happens opportunistically when online
- Conflict resolution: last-write-wins with timestamps

## Data Model

### Tables

#### families
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| name | text | Family name |
| invite_code | text | 6-char code for spouse joining |
| created_at | integer | Unix timestamp |

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| family_id | text | FK to families |
| email | text | Login email |
| display_name | text | Name shown in app |
| avatar_url | text | Optional |
| created_at | integer | Unix timestamp |

#### children
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| family_id | text | FK to families |
| name | text | Child's name |
| date_of_birth | text | ISO date |
| avatar_emoji | text | Emoji avatar |
| notes | text | Allergies, sensitivities, therapy info |
| created_at | integer | Unix timestamp |

#### foods
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| family_id | text | FK to families |
| name | text | Food name |
| category | text | protein/vegetable/fruit/grain/dairy/other |
| default_preparation | text | raw/cooked/steamed/fried/baked/etc |
| image_url | text | Optional photo |
| is_safe_food | integer | Boolean - known accepted food |
| created_at | integer | Unix timestamp |

#### exposures
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| child_id | text | FK to children |
| food_id | text | FK to foods |
| stage | text | tolerate/interact/smell/touch/taste/eat |
| rating | integer | 1-5 acceptance scale |
| preparation | text | How food was prepared this time |
| temperature | text | hot/warm/room/cold |
| texture | text | smooth/crunchy/soft/chewy/mixed |
| meal_type | text | breakfast/lunch/dinner/snack |
| setting | text | home/school/restaurant/therapy |
| notes | text | Free-text observations |
| logged_by | text | FK to users (which parent logged) |
| occurred_at | integer | When the exposure happened |
| created_at | integer | Unix timestamp |
| synced_at | integer | Null until synced to Convex |

#### food_chains
| Column | Type | Description |
|--------|------|-------------|
| id | text (uuid) | Primary key |
| child_id | text | FK to children |
| source_food_id | text | Accepted food |
| target_food_id | text | Target new food |
| similarity_note | text | What connects them |
| created_at | integer | Unix timestamp |

## Screen Architecture (Expo Router)

```
app/
├── _layout.tsx              # Root layout with providers
├── (auth)/
│   ├── _layout.tsx          # Auth flow layout
│   ├── login.tsx            # Email/password + Google
│   ├── register.tsx         # Create account
│   └── join-family.tsx      # Join via invite code
├── (tabs)/
│   ├── _layout.tsx          # Tab bar layout
│   ├── index.tsx            # Dashboard/Home
│   ├── log.tsx              # Quick log exposure
│   ├── foods/
│   │   ├── index.tsx        # Food library (FlashList)
│   │   └── [id].tsx         # Food detail + exposure history
│   ├── progress.tsx         # Charts and insights
│   └── settings.tsx         # Profile, family, preferences
├── child/
│   ├── add.tsx              # Add child profile
│   └── [id].tsx             # Child detail/edit
├── exposure/
│   └── [id].tsx             # Exposure detail/edit
└── onboarding/
    ├── index.tsx            # Welcome + method explanation
    ├── add-child.tsx        # First child setup
    └── safe-foods.tsx       # Initial safe foods
```

## Key Screens

### 1. Dashboard (Home Tab)
- **Child selector** at top (horizontal scroll if multiple children)
- **Today's exposures** summary card
- **Stage distribution** donut chart (how many foods at each stage)
- **Streak counter** ("7 days of consistent exposure!")
- **Quick actions**: Log Exposure, Add Food
- **Recent activity feed** (both parents' logs)

### 2. Log Exposure (Log Tab)
- **Step 1**: Select child (pre-selected if only one)
- **Step 2**: Select or search food (with "Add New" option)
- **Step 3**: Select stage reached (visual 6-stage picker)
- **Step 4**: Rate acceptance (1-5 emoji scale: 😫😕😐🙂😋)
- **Step 5**: Optional details (preparation, temperature, texture, meal, notes)
- **Quick mode**: Steps 1-3 only for fast logging
- Uses React Hook Form + Zod validation

### 3. Food Library (Foods Tab)
- **FlashList** of all foods grouped by category
- **Filter/sort**: by category, stage, exposure count, alphabetical
- **Each food card shows**: name, category icon, current highest stage, exposure count/15 progress bar
- **Swipe actions**: quick-log exposure, mark as safe food
- **Food detail page**: full exposure history timeline, stage progression chart

### 4. Progress (Progress Tab)
- **Food repertoire growth** line chart (accepted foods over time)
- **Stage distribution** bar chart per child
- **Exposure frequency** heatmap (calendar view, like GitHub contributions)
- **Milestone celebrations** ("New food accepted!" animations)
- **Top insights**: "Crunchy textures accepted 2x faster than soft"
- **Food chains** visual (accepted → target connections)

### 5. Settings
- **Family management**: invite code display, family members list
- **Child profiles**: edit, add new
- **Notifications**: reminders to log exposures
- **Data export**: CSV/PDF for therapists
- **Theme**: light/dark/system
- **Account**: email, password, sign out

## Zustand Stores

### useAuthStore
- `user`, `family`, `isAuthenticated`
- `login()`, `register()`, `joinFamily()`, `logout()`

### useChildStore
- `selectedChildId`, `children[]`
- `selectChild()`, `addChild()`, `updateChild()`

### useExposureStore
- `todayExposures[]`, `recentActivity[]`
- `logExposure()`, `updateExposure()`, `deleteExposure()`

### useSettingsStore (persisted to MMKV)
- `theme`, `quickLogMode`, `notificationsEnabled`
- `selectedChildId` (persisted for app restart)

## Unistyles 3.0 Theme

### Design Language
- **Warm, friendly, non-clinical** — this is for parents, not doctors
- **Playful but not childish** — parents are the users
- **Stage colors**: consistent across the app
  - Tolerate: `#94A3B8` (slate)
  - Interact: `#60A5FA` (blue)
  - Smell: `#A78BFA` (purple)
  - Touch: `#FB923C` (orange)
  - Taste: `#F472B6` (pink)
  - Eat: `#34D399` (green)

### Typography
- Headers: System bold (SF Pro / Roboto)
- Body: System regular
- Accent: Rounded/friendly weight for stage labels

### Spacing Scale
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48

## Convex Schema (Cloud)

Mirrors the local SQLite schema with these additions:
- Server-side validation
- Real-time subscriptions per family
- Invite code generation/validation
- User authentication

## Key Interactions

### Logging an Exposure (Primary Flow)
1. Tap "Log" tab or "+" FAB on dashboard
2. Food picker with search (recently used at top)
3. Stage selector: animated horizontal picker with stage icons
4. Acceptance emoji rating (tap to select)
5. Optional expandable section for details
6. "Save" → animated success → return to dashboard
7. Spouse sees update in real-time

### Food Chain Discovery
1. On a food detail page, tap "Find Similar Foods"
2. App suggests foods with similar properties to accepted foods
3. Parent confirms/creates chain: "Likes chicken nuggets → try fish sticks"
4. Chained foods appear as suggestions during logging

## Non-Functional Requirements

- **Offline-first**: App must work fully offline, syncing when online
- **Performance**: FlashList for any list >20 items, <16ms frame time
- **Accessibility**: VoiceOver/TalkBack support, minimum 44pt touch targets
- **Privacy**: All data encrypted at rest (SQLite + MMKV), Convex handles cloud encryption
- **Web support**: Responsive layout for tablet/desktop via Expo web

## Out of Scope (v1)

- Therapist portal / professional accounts
- AI-powered food suggestions
- Barcode scanning for packaged foods
- Social features / community
- Meal planning
- Nutritional tracking
- Photo recognition of foods

## Success Metrics (PostHog)

- Daily active users logging exposures
- Average exposures logged per week per child
- Food stage progression rate
- Family invite completion rate
- Retention at 7/14/30 days
