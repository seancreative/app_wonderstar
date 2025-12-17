# WonderStars - Family Membership & Rewards App

A comprehensive family membership and rewards application for Wonderpark that gamifies visits, spending, workshops, and missions into Stars that unlock perks, gifts, and VIP tiers.

## Features Implemented

### Authentication & Onboarding
- Welcome screen with animated branding
- Sign up with parent account creation
- Login with dummy authentication (accepts any password for demo)
- Child profile creation flow

### Core Functionality
- **Home Dashboard**: Personalized greeting, Stars counter, tier badge, quick actions, missions carousel, workshops highlight
- **Stars System**: View balance, track tier progress, see benefits, earn and spend stars with multipliers
- **Wallet**: Top-up packages (RM50/100/200) with bonus credits and tier boosters
- **Missions**: Active, completed, and seasonal challenges with progress tracking and claiming
- **Rewards Store**: Browse catalog by category, redeem with tier-adjusted pricing
- **Mystery Boxes**: Bronze, Silver, Gold boxes with random prize pools
- **Workshops**: Browse sessions, view details, book (simulation)
- **Check-In**: Simulated QR scan with off-peak bonuses
- **Profile**: Manage account, children, referral code, theme selection
- **Settings**: Preferences for haptics, surprises, reduce motion

### Membership Tiers
Three tiers with progressive benefits:
- **Silver**: Standard (below RM500)
- **Gold**: 1.2x stars, +5% bonuses (RM500-1,499)
- **Platinum**: 1.5x stars, +10% bonuses (RM1,500+)

Tier benefits apply to:
- Stars earn rate multiplier
- Top-up bonus percentage
- Workshop discount percentage
- Redemption cost reduction
- Mission bonus stars

### Design
- Four themes: Light, Dark, Colorful, Robotic
- Frosted glass morphism effects (iOS-inspired)
- Gradient purple-silver color palette
- Smooth animations and transitions
- Responsive layouts
- Bottom navigation bar

### Database Schema
Comprehensive Supabase setup with:
- Users and child profiles
- Wallet and stars transactions
- Membership tiers configuration
- Missions and progress tracking
- Rewards catalog and redemptions
- Mystery boxes and openings
- Workshops and bookings
- Vouchers and usage
- Check-ins and notifications
- App configuration
- Full Row Level Security (RLS) policies

## Tech Stack
- React 18 with TypeScript
- React Router for navigation
- Supabase for database and backend
- Tailwind CSS for styling
- Lucide React for icons
- Vite for build tooling

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

## Usage Flow

1. **Sign Up**: Create parent account and add children (optional)
2. **Home**: View stars balance, current tier, and quick actions
3. **Top Up**: Add funds to wallet with tier-based bonuses
4. **Earn Stars**: Complete missions, check in, attend workshops, spend in-park
5. **Spend Stars**: Redeem rewards, open mystery boxes
6. **Level Up**: Accumulate lifetime top-ups to reach higher tiers
7. **Customize**: Change themes, manage settings

## Demo Credentials
Since this is a demo app with dummy authentication:
- Any email can be used for signup
- Any password works for login
- Users are stored in Supabase for persistence

## Key Design Decisions
- Dummy authentication for easy demo access
- Tier multipliers apply to all star-earning activities
- Bonus wallet credit is separate from main balance
- Mission progress must be claimed to receive stars
- QR codes generated for redemptions and bookings
- Off-peak check-ins (before 1 PM) earn bonus stars
- Theme changes apply globally and persist

## Future Enhancements
Additional features that could be added:
- Vouchers management interface
- Avatar builder with unlockable items
- Notifications center with push support
- Admin configuration panel
- Workshop booking with wallet payment
- Redemption history with QR viewing
- Badge achievements system
- Referral rewards tracking
- Analytics dashboard
