# REZ Live Chat Widget SDK

An embeddable live chat widget for websites with real-time messaging, file attachments, quick replies, and more.

## Features

- **Floating Chat Button** - Customizable position, size, and colors
- **Chat Window** - Full-featured chat interface with message history
- **Quick Replies** - Pre-defined response options for common questions
- **File Attachments** - Support for images, documents, and other file types
- **Typing Indicators** - Real-time typing status for both users and agents
- **Online/Offline Status** - Dynamic agent availability status
- **Agent Assignment** - Automatic or manual agent routing
- **Custom Branding** - Colors, logos, company name, and fonts
- **WebSocket Support** - Real-time bidirectional communication
- **Event System** - Hook into widget lifecycle events
- **Responsive Design** - Works on desktop and mobile

## Installation

### NPM

```bash
npm install @rezmedia/live-chat-widget
```

### CDN

```html
<script src="https://cdn.rezapp.com/live-chat-widget@1.0.0/widget.umd.js"></script>
```

## Quick Start

### JavaScript (CDN)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <!-- Add the widget container -->
  <div id="rez-chat"></div>

  <!-- Load the widget -->
  <script src="https://cdn.rezapp.com/live-chat-widget@1.0.0/widget.umd.js"></script>
  <script>
    window.ReZLiveChat.create('rez-chat', {
      apiUrl: 'https://api.example.com',
      apiKey: 'your-api-key',
      companyName: 'Acme Support'
    });
  </script>
</body>
</html>
```

### JavaScript (NPM)

```javascript
import { createWidget } from '@rezmedia/live-chat-widget';

const chat = createWidget('rez-chat', {
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  companyName: 'Acme Support'
});
```

### HTML Data Attributes

```html
<div
  data-rez-chat
  data-rez-chat-config='{"apiUrl": "https://api.example.com", "companyName": "Acme Support"}'
></div>
<script src="https://cdn.rezapp.com/live-chat-widget@1.0.0/widget.umd.js"></script>
```

## Configuration

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | `''` | Your chat API endpoint |
| `apiKey` | `string` | `''` | API key for authentication |
| `websocketUrl` | `string` | `''` | WebSocket endpoint for real-time |
| `companyName` | `string` | `'Support'` | Display name for your company |
| `companyLogo` | `string` | `''` | URL to your company logo |

### Branding Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `primaryColor` | `string` | `'#6366f1'` | Primary accent color |
| `secondaryColor` | `string` | `'#4f46e5'` | Secondary gradient color |
| `fontFamily` | `string` | `system-ui...` | Custom font family |

### Widget Position

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Chat bubble position |
| `offsetX` | `number` | `20` | Horizontal offset in pixels |
| `offsetY` | `number` | `20` | Vertical offset in pixels |
| `bubbleSize` | `number` | `60` | Chat button size in pixels |

### Feature Flags

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableFileUpload` | `boolean` | `true` | Enable file attachments |
| `enableQuickReplies` | `boolean` | `true` | Enable quick reply buttons |
| `enableEmoji` | `boolean` | `true` | Enable emoji picker |
| `enableTypingIndicator` | `boolean` | `true` | Show typing indicators |
| `enableReadReceipts` | `boolean` | `true` | Show message delivery status |

### Message Customization

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `welcomeMessage` | `string` | `''` | Initial greeting message |
| `inputPlaceholder` | `string` | `'Type a message...'` | Input field placeholder |
| `offlineMessage` | `string` | `''` | Message when offline |
| `showDuringOffline` | `boolean` | `true` | Show widget when offline |

### File Upload

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxFileSize` | `number` | `10485760` | Max file size in bytes (10MB) |
| `allowedFileTypes` | `string[]` | `['image/*', ...]` | Allowed MIME types |

## API Reference

### Widget Methods

```javascript
const chat = createWidget('rez-chat', config);

// Open the chat window
chat.open();

// Close the chat window
chat.close();

// Toggle chat visibility
chat.toggle();

// Send a message programmatically
await chat.sendMessage('Hello, I need help!');

// End the current chat session
await chat.endSession();

// Get current widget state
const state = chat.getState();
console.log(state.messages);
console.log(state.isOpen);
console.log(state.agent);

// Destroy the widget instance
chat.destroy();
```

### Event System

```javascript
const chat = createWidget('rez-chat', config);

// Listen to events
chat.on('ready', () => {
  console.log('Widget is ready!');
});

chat.on('open', () => {
  console.log('Chat opened');
});

chat.on('close', () => {
  console.log('Chat closed');
});

chat.on('message_sent', (event) => {
  console.log('Message sent:', event.data);
});

chat.on('message_received', (event) => {
  console.log('New message:', event.data);
});

chat.on('agent_joined', (event) => {
  console.log('Agent joined:', event.data.name);
});

chat.on('agent_left', (event) => {
  console.log('Agent left:', event.data.name);
});

chat.on('typing_start', (event) => {
  console.log('User typing:', event.data);
});

chat.on('typing_stop', () => {
  console.log('User stopped typing');
});

chat.on('connection_change', (event) => {
  console.log('Connection changed:', event.data.connected);
});

// Remove event listener
chat.off('message_received', myHandler);
```

### State Object

```typescript
interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  session: ChatSession | null;
  agent: Agent | null;
  isAgentTyping: boolean;
  isUserTyping: boolean;
  isConnected: boolean;
  unreadCount: number;
  fileUploads: FileUpload[];
  quickReplies: QuickReplyOption[];
  typingUsers: string[];
}
```

## Backend Integration

### API Endpoints Required

Your backend should implement the following endpoints:

#### Start Session
```
POST /sessions
Request: { userId?: string, metadata?: object }
Response: { sessionId, welcomeMessage, queuePosition?, estimatedWaitTime? }
```

#### Get Messages
```
GET /sessions/:sessionId/messages?limit=50&before=messageId
Response: ChatMessage[]
```

#### Send Message
```
POST /messages
Request: { sessionId, content, type, attachments? }
Response: ChatMessage
```

#### Upload File
```
POST /upload
Request: multipart/form-data with 'file' field
Response: { attachment: Attachment }
```

#### Get Agent Status
```
GET /sessions/:sessionId/agent
Response: Agent | null
```

#### Check Online Status
```
GET /status
Response: { isOnline: boolean, agentCount: number }
```

### WebSocket Events

The widget expects these WebSocket message types:

| Type | Payload | Description |
|------|---------|-------------|
| `message` | `ChatMessage` | New incoming message |
| `typing_start` | `{ agentId, agentName }` | Agent started typing |
| `typing_stop` | `{ agentName }` | Agent stopped typing |
| `agent_joined` | `Agent` | Agent joined session |
| `agent_left` | `Agent` | Agent left session |
| `session_ended` | - | Session ended |
| `quick_replies` | `{ options: QuickReplyOption[] }` | New quick replies |

## Styling Customization

### Custom CSS

You can inject custom CSS using the `customCss` option:

```javascript
createWidget('rez-chat', {
  customCss: `
    .rez-chat-bubble { border-radius: 50% !important; }
    .rez-chat-message { font-size: 16px !important; }
  `
});
```

### CSS Variables

The widget uses these CSS custom properties for easy customization:

```css
:root {
  --rez-chat-primary: #6366f1;
  --rez-chat-secondary: #4f46e5;
  --rez-chat-font: system-ui, sans-serif;
  --rez-chat-bubble-size: 60px;
  --rez-chat-offset-x: 20px;
  --rez-chat-offset-y: 20px;
}
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## TypeScript

The package includes TypeScript definitions. No additional `@types` package required.

```typescript
import { createWidget, ChatConfig } from '@rezmedia/live-chat-widget';

const config: ChatConfig = {
  apiUrl: 'https://api.example.com',
  primaryColor: '#3b82f6'
};

const chat = createWidget('rez-chat', config);
```

## License

MIT

## Support

For support, email support@rezapp.com or visit https://rezapp.com/support
