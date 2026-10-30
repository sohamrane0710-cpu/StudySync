# StudySync

StudySync is a modern study productivity platform that combines personal Pomodoro & deep-work study tracking with collaborative real-time study rooms.

## Monorepo Structure

```text
studysync/
├── frontend/                 # React 19 + TypeScript + Vite web application
│   ├── src/                  # Application source (features, components, hooks, lib, types)
│   ├── tests/                # Unit and component tests (Vitest)
│   ├── .env.example          # Frontend configuration template
│   ├── package.json          # Dependencies and scripts (dev, build, test)
│   └── README.md             # Frontend architecture and integration documentation
├── backend/                  # NestJS modular monolith API & WebSocket service
│   ├── src/                  # Application source code
│   ├── test/                 # Integration and unit tests (Jest)
│   ├── prisma/               # Database schema and versioned migrations
│   ├── docs/                 # API reference and integration guides
│   ├── .env.example          # Sample environment configuration
│   └── README.md             # Backend setup and developer documentation
├── .gitignore
└── README.md
```

## Quick Start

### 1. Start Database & Backend

```bash
# Start PostgreSQL via Docker Compose
cd backend
docker compose up -d

# Install backend dependencies & apply migrations
npm install
npx prisma migrate deploy

# Start NestJS backend in development mode (port 3000)
npm run start:dev
```

### 2. Start Frontend

```bash
# In a separate terminal, navigate to frontend
cd frontend

# Install frontend dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev
```

Visit `http://localhost:5173` to access StudySync.

## Testing

```bash
# Run backend tests
cd backend && npm run test:unit

# Run frontend tests
cd frontend && npm test

# Run frontend production build
cd frontend && npm run build
```
