# StudySync Architecture

## Overview
StudySync is built as a separate frontend and backend application housed within a Turborepo monorepo. 

- **Frontend**: React + Vite + TypeScript (Single Page Application)
- **Backend**: Node.js + NestJS + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API Style**: RESTful APIs for standard operations, Socket.IO for real-time presence and synchronization.
- **State/Scaling**: Redis is deferred until necessary for scaling. Socket.IO state will be in-memory initially but designed for future Redis integration.

## Architecture Principles
1. strict separation of frontend and backend applications.
2. Business logic is isolated from UI components (Frontend: UI -> Hooks -> API).
3. Business rules are decoupled from controllers/gateways (Backend: Controller -> Service -> Prisma).

## Timer Architecture
To ensure accurate analytics, timers are separated into three concepts:
- **TimerMode**: Configuration defining stages, durations, and rules.
- **TimerSession**: Active, real-time execution of a mode.
- **StudySession**: Immutable historical record of completed study time.
