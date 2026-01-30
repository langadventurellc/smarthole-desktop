# Client Registration System

Plugin clients register with SmartHole to provide routing descriptions for the LLM routing agent.

## Initialization

```typescript
import { initializeClientRegistry } from "./services/client-registry";
import { initializeRegistrationHandler } from "./services/registration-handler";

app.whenReady().then(async () => {
  const registry = initializeClientRegistry();
  const registrationHandler = initializeRegistrationHandler();
});
```

## Registration Protocol

Clients register by sending a WebSocket message with type `"registration"`:

```typescript
// Message sent by client
interface WebSocketRegistrationMessage {
  type: "registration";
  payload: {
    name: string; // Unique identifier (e.g., "notebook", "home-assistant")
    description: string; // Free-form routing hint for the LLM
    version?: string; // Optional client version
    capabilities?: string[]; // Optional capability hints
  };
}

// Response sent by server
interface WebSocketRegistrationResponse {
  type: "registration_response";
  payload:
    | { success: true; clientId: string; message: string }
    | { success: false; code: RegistrationErrorCode; message: string };
}
```

## Name Validation Rules

Client names must:

- Start with a letter (a-zA-Z)
- Contain only alphanumeric characters, hyphens, and underscores
- Be 64 characters or less
- Be unique among registered clients

## Error Codes

| Code                  | Description                                     |
| --------------------- | ----------------------------------------------- |
| `INVALID_NAME`        | Name doesn't meet validation rules              |
| `INVALID_DESCRIPTION` | Description is empty or too long (>1024 chars)  |
| `DUPLICATE_NAME`      | A client with this name is already registered   |
| `ALREADY_REGISTERED`  | This connection already has a registered client |
| `VALIDATION_ERROR`    | General validation failure                      |

## Registry Usage

```typescript
import { getClientRegistry } from "./services/client-registry";

const registry = getClientRegistry();

// Query clients
registry.getClientCount();
registry.getAllClients();
registry.getClient("notebook");

// Subscribe to events
registry.on("registered", (event) => console.log(`Registered: ${event.client.name}`));
registry.on("unregistered", (event) => console.log(`Unregistered: ${event.client.name}`));
```

## Renderer Access

For accessing client information from the renderer process or system tray, see [Client Status IPC](client-status.md).

## Disconnection Handling

When a WebSocket connection closes, the registration handler automatically:

1. Detects the disconnection via the WebSocket server's `disconnection` event
2. Looks up the connection in the registry by connection ID
3. Unregisters the client with reason `"disconnect"`
4. Emits an `"unregistered"` event for any listeners

## RegistryClientInfo

```typescript
interface RegistryClientInfo {
  id: string; // Server-assigned connection ID
  name: string; // Client-provided unique name
  description: string; // Routing description for LLM
  version?: string;
  capabilities?: string[];
  registeredAt: string; // ISO 8601 timestamp
}
```
