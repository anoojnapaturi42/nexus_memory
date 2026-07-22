# Google Nexus Memory

Google Nexus Memory is a production-style full-stack ai workspace platform built with Next.js App Router, TypeScript, TailwindCSS, shadcn/ui, Lucide icons, Framer Motion, Zustand, TanStack Query, Supabase, and Google Workspace integrations.

It is designed as an intelligent workspace command center for managing memories, conversations, calendar context, email context, documents, background automations, and multi-agent workflows.

## Project Overview

Google Nexus Memory brings together several core ideas:

- a premium enterprise dashboard for workspace activity
- a chat assistant with multi-agent orchestration
- an interactive memory graph for relationships and context
- connected Google Workspace integrations
- proactive automation and recommendation workflows
- a semantic memory retrieval pipeline
- durable persistence for conversations, memories, and agent logs

The project currently mixes real backend scaffolding with mock-first behavior in a few areas so the app can feel complete while the remaining integrations are still being finished. The UI, architecture, route structure, and service boundaries are intentionally production-shaped.

## Project Statement

The goal of this project is to create an ai-native workspace layer that can:

- capture and organize important memories
- surface relevant context before users need it
- coordinate multiple specialized agents
- connect to Google Workspace data
- persist conversations and execution traces
- support future live retrieval and automation without major rewrites

In plain language, it is meant to feel like an internal operating system for your work, emails, docs, meetings, and plans.

## Features

### Workspace UI

- responsive dashboard shell
- sidebar navigation and top header
- dark/light mode theme support
- polished card-based layout
- loading states and error boundaries

### Chat Assistant

- chatgpt-style conversation interface
- persistent chat history
- agent execution timeline
- streaming-style assistant responses
- agent thought panels and execution logs

### Memory Graph

- interactive relationship graph
- people, projects, emails, meetings, files, tasks, and goals
- search and filtering controls
- clustering and node highlighting

### Connected Apps

- Google Gmail integration UI
- Google Calendar integration UI
- Google Drive integration UI
- Google Docs integration UI
- Google Meet placeholder support
- connection status, sync status, and oauth flow states

### Proactive Automations

- background recommendation engine
- approval workflow for autonomous actions
- execution logs and traceability
- reminders, calendar suggestions, follow-up tasks, and drive recommendations

### Backend Foundations

- typed service layer
- repository pattern for persistence
- Supabase and PostgreSQL scaffolding
- google oauth routes
- google workspace service modules
- semantic memory retrieval pipeline
- agent orchestration framework

## Architecture

The repository follows a layered architecture so UI, logic, persistence, and external integrations stay separated.

### High-level layers

- `app/`
  - Next.js App Router pages and API routes
- `components/`
  - reusable ui and page sections
- `features/`
  - feature-specific composition points
- `services/`
  - application logic, data orchestration, and integration services
- `repositories/`
  - durable data access abstractions
- `agents/`
  - internal orchestration engine and modular agents
- `lib/`
  - utilities, env helpers, shared logic, and low-level support code
- `mock/`
  - fake data, mock runtimes, and development fallbacks
- `store/`
  - zustand state slices
- `hooks/`
  - reusable client-side data hooks
- `types/`
  - strict TypeScript domain and api models
- `database/`
  - schema and migration files

### Core runtime flow

1. the ui renders a dashboard, chat assistant, memory graph, connected apps page, or automation panel
2. hooks fetch data from api routes or services
3. services call repositories, google integrations, or mock fallbacks
4. the agent orchestrator coordinates specialized agents when chat or automation workflows run
5. execution traces, logs, and state updates flow back into the ui

## Project Structure

```text
app/
  api/                 server routes and api endpoints
  automations/         proactive automation page
  chat-assistant/      chat interface page
  connected-apps/      google integrations page
  memory-graph/        graph visualization page
  settings/            settings scaffold

components/
  automation/          automation panels and approval cards
  chat/                chat assistant workspace
  graph/               memory graph ui
  integrations/        connected apps ui
  layout/              dashboard shell, headers, placeholders
  providers/           app-wide providers
  theme/               theme toggle and helpers
  ui/                  shared ui primitives

services/
  google/              google oauth and workspace sync
  llm/                 llm provider abstraction and gemini integration
  database/            database service layer
  memory-*             memory ingestion, ranking, retrieval, and search
  proactive-automation service for background recommendations

repositories/
  database/            postgres/supabase repositories
  integration.repository.ts  google integration persistence

agents/
  orchestrator.ts      central agent workflow engine
  memory-agent.ts      memory reasoning agent
  research-agent.ts    workspace research agent
  planner-agent.ts     planning agent
  scheduler-agent.ts   calendar planning agent
  email-agent.ts       follow-up drafting agent
  llm.ts              provider abstraction and mock/gemini routing

mock/
  datasets/            typed mock data
  repositories/        in-memory fallback repositories
  runtime.ts           live mock workspace state
  chat-orchestration.ts chat workflow simulation

database/
  schema.sql           main postgres schema
  migrations/          migration files

types/
  domain.ts            core domain models
  auth.ts              auth response models
  google-workspace.ts  workspace item models
  proactive.ts         automation models
```

## Technologies Used

- Next.js App Router
- React 19
- TypeScript
- TailwindCSS
- shadcn/ui
- Lucide React
- Framer Motion
- Zustand
- TanStack Query
- Supabase
- PostgreSQL
- pgvector-ready schema
- googleapis
- Google Gemini SDK

## Installation

### Prerequisites

- Node.js 20 or newer
- npm
- a Google Cloud project if you want to use real Google OAuth
- Supabase or PostgreSQL if you want durable persistence

### Local setup

1. clone or open the repository
2. install dependencies:

```bash
npm install
```

3. create your local environment file:

```bash
copy .env.example .env.local
```

4. fill in the values you need

5. start the development server:

```bash
npm run dev
```

6. open the app:

```text
http://localhost:3000
```

### Useful scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run format:write
```

## Environment Variables

The project uses environment validation in several areas. Common variables include:

- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_EMBEDDING_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

If a variable is missing, the relevant service usually falls back to a safe error state or a mock mode during development.

## What is Real vs Mock

This repository is intentionally hybrid.

### Real today

- app routing and page structure
- ui shell and dashboards
- typed service abstractions
- google oauth route scaffolding
- durable persistence scaffolding
- postgres/supabase schema and repositories
- agent orchestration framework
- llm provider abstraction
- google workspace service modules

### Mock or development fallback today

- some agent outputs
- some workspace signals when oauth is unavailable
- some semantic retrieval pieces
- some background automation behavior
- some development-only fallback data paths

This is by design so the project can be developed safely before every external dependency is fully live.

## Future Improvements

- complete end-to-end live Gemini streaming in the chat ui
- replace all remaining mock fallbacks with durable backend data
- add production-grade encrypted token storage for oauth sessions
- finish live memory ingestion and pgvector similarity search
- persist proactive automation runs and approvals in postgres
- add background job processing for scheduled automations
- add team/workspace multi-user support
- improve graph rendering performance for large datasets
- add audit logs and admin tooling
- add deployment docs and environment checklists

## Notes

- This project is still evolving, so some modules are scaffolding rather than final production logic.
- The architecture is intentionally modular so live services can replace mock implementations without changing the ui contract.

