# DomainChat — Multi-Domain AI Chatbot Platform

A full-stack Multi-Domain AI Chatbot Web Application with switchable domain-specialized AI assistants, pre-generation domain classification powered by local **Ollama** (`qwen2.5:3b`), **NDJSON** real-time streaming, isolated per-assistant conversation histories, and an **Admin Console** for chatbot management and analytics.

---

## Key Features

* **Switchable Domain Assistants**: Users can switch between active AI assistants (**Programming**, **Healthcare**, **Finance**, **Education**, **Legal**, and custom admin-created domains) without mixing conversation histories or system prompts.
* **3-Way Domain Classification Gate**: Before generating any answer, both standard (`POST /api/messages/send`) and streaming (`POST /api/messages/stream`) endpoints classify the user's question via Ollama into:
  * `IN_DOMAIN` — Answers using the assistant's protected system prompt and chat-scoped history.
  * `OUT_OF_DOMAIN` — Returns a polite domain-specific refusal without calling the answer-generation model.
  * `AMBIGUOUS` — Prompts the user for clarification without calling the answer-generation model.
* **Prompt-Injection & Fail-Closed Protection**: Classifier outputs are strictly validated as JSON on the backend; invalid or unconfirmed outputs never fall back to unrestricted generation.
* **Real-Time Streaming (Socket.IO + NDJSON)**: Primary real-time streaming over **Socket.IO** (`chat:send`, `chat:start`, `chat:chunk`, `chat:done`, `chat:error`, `chat:stop`) with JWT handshake authentication, plus automatic HTTP **NDJSON** streaming (`POST /api/messages/stream`) fallback and `AbortController` cancellation so aborted partial responses are never saved as completed messages.
* **Admin Control Center (`/admin`)**:
  * Create, update, activate/deactivate, and soft-delete chatbots (preserving historical conversations).
  * Configure `name`, `slug`, `description`, `systemPrompt`, `allowedTopics`, `restrictedTopics`, and local Ollama model.
  * View platform KPIs, per-chatbot usage, classification breakdown, average response time, model usage, and user feedback ratings.
* **Responsive Next.js Frontend**: Landing page, login/registration, mobile slide-over chat history drawer, assistant selector, streaming chat UI, stop generation, copy, regenerate, rename/delete/clear chat, message helpfulness feedback, and light/dark mode.
* **Backward Compatibility**: Legacy chats without a `chatbotId` (`chatbotId: null`) remain accessible and functional.

---

## Tech Stack

* **Frontend (`frontend/`)**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `socket.io-client`
* **Backend (`backend/`)**: Node.js, Express 5 (CommonJS), Mongoose 9, Socket.IO, JWT (`jsonwebtoken`), `bcryptjs`, Axios, Swagger UI
* **Database**: MongoDB
* **AI Runtime**: Local Ollama (`/api/chat`, `/api/tags`, default model `qwen2.5:3b`)

---

## Project Structure

```text
AIChatBot/
├── backend/
│   ├── config/
│   │   ├── db.js
│   │   └── swagger.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── chatbotController.js
│   │   ├── chatController.js
│   │   ├── feedbackController.js
│   │   ├── messageController.js
│   │   ├── modelController.js
│   │   ├── streamController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── adminMiddleware.js
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   ├── rateLimitMiddleware.js
│   │   └── validateMiddleware.js
│   ├── models/
│   │   ├── chat.js
│   │   ├── chatbot.js
│   │   ├── feedback.js
│   │   ├── message.js
│   │   ├── usageLog.js
│   │   ├── user.js
│   │   └── userSetting.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── chatbotRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── feedbackRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── modelRoutes.js
│   │   ├── streamRoutes.js
│   │   └── userRoutes.js
│   ├── services/
│   │   ├── chatServices.js
│   │   ├── classificationService.js
│   │   └── ollamaServices.js
│   ├── tests/
│   │   ├── controllerTests.js
│   │   └── runVerification.js
│   ├── utils/
│   │   ├── generateToken.js
│   │   └── seedChatbots.js
│   ├── package.json
│   └── server.js
└── frontend/
    ├── app/
    │   ├── admin/page.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── AdminDashboard.tsx
    │   ├── AuthScreen.tsx
    │   ├── ChatbotSelector.tsx
    │   ├── ChatSidebar.tsx
    │   ├── ChatWorkspace.tsx
    │   ├── LandingPage.tsx
    │   ├── MessageList.tsx
    │   └── ThemeProvider.tsx
    ├── lib/
    │   ├── api.ts
    │   └── types.ts
    └── package.json
```

---

## Prerequisites

1. **Node.js** (v20+ recommended)
2. **MongoDB** (local MongoDB or MongoDB Atlas with your IP whitelisted)
3. **Ollama** installed and running locally with `qwen2.5:3b` pulled:

```bash
ollama pull qwen2.5:3b
ollama serve
```

---

## Environment Configuration

### 1. Backend (`backend/.env`)

```env
DATABASR_URL=mongodb+srv://<username>:<password>@<cluster-url>/
PORT=5000
API_URL=http://localhost:5000
JWT_SECRET=<your-strong-jwt-secret>
JWT_EXPIRES_IN=7d
NODE_ENV=development

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

### 2. Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Installation & Running Locally

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

* API runs at `http://localhost:5000`
* Swagger docs run at `http://localhost:5000/api-docs`
* To seed the 5 default chatbots manually (requires at least one user in MongoDB):

```bash
npm run seed
```

> Default chatbots are also seeded automatically on startup or after first user registration if no chatbots exist yet.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### 3. Creating an Admin Account

New registrations default to `role: "user"` for security. To grant admin access for `/admin` and `/api/admin/*`, update the user's `role` to `"admin"` directly in MongoDB (`users` collection).

---

## API Overview

| Area | Method & Endpoint | Description |
|---|---|---|
| **Auth** | `POST /api/auth/register` | Register a new user (min 8-char password) |
| | `POST /api/auth/login` | Login and receive JWT |
| | `GET /api/auth/me` | Get authenticated user profile & `selectedChatbotId` |
| **User Chatbots** | `GET /api/chatbots` | List active, non-deleted chatbots (`systemPrompt` omitted) |
| | `GET /api/chatbots/:id` | Get active chatbot details |
| | `PUT /api/chatbots/select/:id` | Switch active assistant for the logged-in user |
| **Admin Chatbots** | `POST /api/admin/chatbots` | Create a new chatbot (Admin only) |
| | `GET /api/admin/chatbots` | List all chatbots (Admin only) |
| | `GET /api/admin/chatbots/:id` | Get full chatbot config (Admin only) |
| | `PUT /api/admin/chatbots/:id` | Update chatbot fields (Admin only) |
| | `PATCH /api/admin/chatbots/:id/status` | Activate or deactivate a chatbot (Admin only) |
| | `DELETE /api/admin/chatbots/:id` | Soft delete a chatbot (Admin only) |
| **Admin Analytics** | `GET /api/admin/analytics` | Platform overview, domain/model usage, latency & ratings |
| | `GET /api/admin/users` | User list and conversation counts |
| **Chats** | `POST /api/chats` | Create a chat bound to an active `chatbotId` |
| | `GET /api/chats?chatbotId=<id\|legacy>` | List user chats (optionally filtered by domain or `legacy`) |
| | `GET /api/chats/:chatId` | Get chat details and messages |
| | `PATCH /api/chats/:chatId` | Rename a chat |
| | `DELETE /api/chats/:chatId` | Delete a chat and its messages |
| | `DELETE /api/chats/:chatId/messages` | Clear messages in a chat |
| **Messages & Stream** | `POST /api/messages/send` | Classify question and return AI response |
| | `POST /api/messages/stream` | Classify question and stream NDJSON response |
| | `POST /api/messages/regenerate` | Regenerate the latest assistant response |
| | `GET /api/messages/:chatId` | Paginated message history |
| **Feedback & Models** | `POST /api/feedback` | Rate an assistant message (`positive` / `negative`) |
| | `GET /api/feedback/chat/:chatId` | Fetch user feedback for a chat |
| | `GET /api/models` | List locally available Ollama models |
| | `GET / PUT /api/users/settings` | Read or update user settings |

---

## Testing & Verification

### Backend Verification

```bash
cd backend

# HTTP controller, RBAC, classification gating, and NDJSON route tests (mocked Mongoose)
node tests/controllerTests.js

# Socket.IO JWT auth, classification gating, and streaming tests (mocked Mongoose)
node tests/socketTests.js

# Live Ollama (qwen2.5:3b) classification & stream cancellation tests
node tests/runVerification.js
```

### Frontend Verification

```bash
cd frontend
npm run lint
npm run build
```
