# DOOH Screen Controller - Mobile App

**Purpose:** Control and monitor your DOOH screens from mobile

## Features

- View screen status (online/offline)
- Pause/play individual screens
- View earnings
- Request payouts
- Receive alerts

## Tech Stack

```bash
npx create-expo-app dooh-controller
expo install @react-navigation/native
expo install @react-navigation/stack
```

## Screens

| Screen | Purpose |
|--------|---------|
| Dashboard | Overview of all screens |
| Screen Detail | Individual screen status |
| Earnings | View earnings + request payout |
| Settings | App settings |

## API Integration

```typescript
import { supabase } from './lib/supabase'

// Get screens
const { data } = await supabase
  .from('dooh_screens')
  .select('*')
  .eq('owner_id', userId)
```

## Setup

```bash
cd dooh-mobile
npm install
npx expo start
```
