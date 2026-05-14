# REZ Journey Builder

Visual drag-and-drop interface for building customer journey automations.

## Features

- **Drag & Drop Canvas** - Build journeys by dragging nodes
- **Visual Node Types** - Triggers, Actions, Conditions, Delays
- **Templates** - Pre-built journey templates
- **Real-time Preview** - See journey flow visually
- **API Integration** - Connect to REZ engagement platform

## Components

### JourneyBuilder

Main component for building journeys:

```tsx
import { JourneyBuilder } from '@rez/journey-builder';

<JourneyBuilder
  journeyId="journey-123"
  onSave={(journey) => console.log(journey)}
  onPublish={(journeyId) => console.log(journeyId)}
/>
```

### Node Types

| Type | Icon | Purpose |
|------|------|---------|
| Trigger | ⚡ | Start journey on event/schedule |
| Action | 🎬 | Send email, SMS, push, webhook |
| Condition | ❓ | Branch based on rules |
| Delay | ⏱️ | Wait before next step |
| Split | 🔀 | A/B test branches |
| End | ✅ | End of journey |

## Templates

Pre-built journeys:

- **Welcome Series** - 3-day onboarding sequence
- **Abandoned Cart** - Cart recovery reminders
- **Win Back** - Re-engage inactive customers

## API

### Create Journey

```bash
POST /api/journeys
{
  "name": "My Journey",
  "nodes": [...],
  "connections": [...]
}
```

### Publish Journey

```bash
POST /api/journeys/:id/publish
```

## Usage

```bash
npm install @rez/journey-builder
```

```tsx
import { JourneyBuilder } from '@rez/journey-builder';

export default function Page() {
  return <JourneyBuilder />;
}
```
