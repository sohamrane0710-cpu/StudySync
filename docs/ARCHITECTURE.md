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

## Detailed Architecture Documents

For deep-dive documentation on specific systems, please refer to the following specifications:

- [Product Specification](PRODUCT_SPEC.md)
- [Database Schema & ERD](DATABASE.md)
- [Timer Engine](TIMER_ENGINE.md)
- [Analytics & Labels](ANALYTICS.md)
- [Authentication](AUTH.md)
