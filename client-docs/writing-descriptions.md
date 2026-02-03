# Writing Effective Descriptions

Your `description` field is the most important part of your client registration. It's the **only thing** the routing LLM sees when deciding which client should receive a message.

## How Routing Works

When a user sends a message like "remind me to call mom tomorrow", SmartHole's routing agent (Claude Haiku) sees:

1. The user's message
2. A list of available tools, one per connected client
3. Each tool's description comes from your `description` field

The LLM then decides which tool(s) to call based on the descriptions.

## Principles

### 1. Write for a Person, Not a Machine

The routing agent is an LLM. Write your description like you're explaining to a helpful assistant what you do.

```javascript
// Bad - too technical
description: "Processes CRUD operations on note entities in SQLite";

// Good - natural language
description: "I save notes, journal entries, and things you want to remember for later";
```

### 2. Be Specific About What You Handle

Vague descriptions lead to poor routing. Be concrete about your domain.

```javascript
// Bad - too vague
description: "Handles home stuff";

// Good - specific
description: "I control smart home devices including lights, thermostats, door locks, and home automation routines";
```

### 3. Use First Person ("I handle...", "I manage...")

This reads naturally to the LLM and matches the conversational context.

```javascript
// OK
description: "Manages calendar events and scheduling";

// Better
description: "I manage your calendar, schedule meetings, and set reminders for appointments";
```

### 4. Include Action Words

Describe what actions you can take, not just what category you belong to.

```javascript
// Bad - passive/categorical
description: "A task management system";

// Good - action-oriented
description: "I create, update, and complete tasks. I can set due dates, priorities, and organize tasks into projects.";
```

### 5. Mention Edge Cases You Handle

If there are ambiguous cases, clarify them in your description.

```javascript
// Basic
description: "I handle notes and reminders";

// Better - clarifies scope
description: "I handle personal notes, journal entries, and memory storage. For calendar appointments and scheduled events, use the calendar client instead.";
```

## Examples by Category

### Note-Taking Client

```javascript
description: "I handle note-taking, journaling, memory storage, and anything the user wants to remember or write down. Use me when someone says 'remember', 'note', 'write down', or 'don't forget'.";
```

### Smart Home Client

```javascript
description: "I control smart home devices: lights, thermostats, door locks, garage doors, and home automation routines. I can turn things on/off, adjust settings, and run scenes like 'goodnight' or 'movie time'.";
```

### Task Manager Client

```javascript
description: "I manage tasks and to-do lists. I can create tasks, set due dates and priorities, mark tasks complete, and organize work into projects. Use me for action items and things that need to get done.";
```

### Calendar Client

```javascript
description: "I manage calendar events and scheduling. I can create appointments, check availability, and set up meetings. For simple reminders without a specific time, use the notes client instead.";
```

### Music Player Client

```javascript
description: "I control music playback. I can play, pause, skip tracks, adjust volume, and play specific songs, artists, albums, or playlists.";
```

### Email Client

```javascript
description: "I help with email. I can compose new emails, read recent messages, search your inbox, and flag important messages for follow-up.";
```

## Anti-Patterns

### Don't Be Too Broad

```javascript
// Bad - will receive irrelevant messages
description: "I can help with anything";
```

### Don't Be Too Narrow

```javascript
// Bad - might miss valid messages
description: "I only handle the exact phrase 'create a note'";
```

### Don't Include Technical Details

```javascript
// Bad - LLM doesn't care about implementation
description: "Node.js service using MongoDB for persistence with Redis caching";
```

### Don't Use Jargon

```javascript
// Bad - unclear to general-purpose LLM
description: "CRUD interface for PKM with bidirectional linking";

// Good
description: "I manage your personal knowledge base with notes, links between ideas, and search";
```

## Testing Your Description

1. Start your client with the description
2. Use SmartHole's text input to send various messages
3. Check if your client receives appropriate messages
4. Refine the description based on what's being routed (or not routed) to you

### Test Messages to Try

For a note-taking client:

- "Remember to buy milk" (should route to you)
- "Turn on the lights" (should NOT route to you)
- "Note: meeting at 3pm" (should route to you)
- "Schedule a meeting at 3pm" (ambiguous - refine description if wrong)

## Description Length

- **Minimum**: A sentence or two that clearly describes your purpose
- **Maximum**: 1024 characters
- **Sweet spot**: 100-300 characters

Longer isn't always better. A focused, clear description often routes better than a lengthy one.
