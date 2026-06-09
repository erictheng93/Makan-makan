# GEMINI.md - Project Context for AI Agent

This document provides a comprehensive overview of the **MakanMakan** project to serve as a shared context for AI-assisted development.

## 1. Project Overview

**MakanMakan** is a modern, serverless restaurant management platform built entirely on the **Cloudflare edge computing ecosystem**. Its purpose is to provide a full suite of solutions for restaurant operations, from ordering and menu management to employee scheduling and AI-powered business analytics.

### Core Technologies

- **Monorepo:** The project is a monorepo managed with **pnpm** workspaces and **Turborepo** for efficient task running.
- **Frontend:** The various web applications (customer, admin, kitchen) are built with **Vue.js 3** and **TypeScript**, styled with **Tailwind CSS**. They are hosted on **Cloudflare Pages**.
- **Backend API:** The API is serverless, running on **Cloudflare Workers** using **TypeScript**.
- **Database:** The primary database is **Cloudflare D1** (a serverless SQLite-based database).
- **Realtime Services:** Realtime features like order tracking are powered by **Cloudflare Durable Objects**.
- **Storage & Caching:** **Cloudflare R2** is used for image storage, and **Cloudflare KV** is used for caching hot data like sessions.

### Architecture

The project follows a full-stack serverless architecture. Frontend applications built with Vue.js interact with a serverless API running on Cloudflare Workers. This API handles business logic and communicates with other Cloudflare services (D1, R2, KV, Durable Objects) for data persistence, storage, and real-time communication.

### Project Structure (`pnpm-workspace.yaml`)

The monorepo contains two main types of packages:

- `apps/*`: These are the deployable applications, such as `customer-app`, `admin-dashboard`, `kitchen-display`, and the `api`.
- `packages/*`: These are shared libraries used across the applications, such as `database` schemas, `shared-types`, and `utils`.

## 2. Building and Running

The project uses `pnpm` as its package manager and `turbo` as its build system. Key commands are defined in the root `package.json`.

### Key Commands

- **Installation:**

  ```bash
  # Install all dependencies for the monorepo
  pnpm install
  ```

- **Development:**

  ```bash
  # Start all applications in development mode
  pnpm run dev
  ```

  This command uses `turbo run dev` to start development servers for all workspaces concurrently. The running applications will be accessible at different local ports (e.g., `http://localhost:3000`, `http://localhost:3001`).

- **Building:**

  ```bash
  # Build all applications for production
  pnpm run build
  ```

  This uses `turbo run build` and caches outputs in `dist/`, `.output/`, etc. directories within each workspace.

- **Testing:**

  ```bash
  # Run all unit and integration tests with vitest
  pnpm run test

  # Run end-to-end tests with playwright
  pnpm run test:e2e
  ```

- **Database Migrations:**
  ```bash
  # Run local database migrations
  pnpm run db:migrate:local
  ```

## 3. Development Conventions

The project enforces a consistent and high-quality development workflow.

### Code Style & Quality

- **Language:** The entire stack is written in **TypeScript**, ensuring type safety.
- **Linting:** **ESLint** is used for static code analysis. Linting rules are configured in `.eslintrc.cjs`. You can run the linter with `pnpm run lint`.
- **Formatting:** **Prettier** is used for code formatting to maintain a consistent style.

### Testing

- **Unit & Integration Testing:** **Vitest** is the primary framework for unit and integration tests. Configuration is in `vitest.config.ts`.
- **End-to-End Testing:** **Playwright** is used for end-to-end testing of the applications. Configuration is in `playwright.config.ts`.
- **Test-driven philosophy:** The `README.md` and extensive test scripts suggest that writing tests for new features is a core part of the development process.

### Git Workflow

The project follows a standard Git workflow:

- `main`: Represents the production-ready code.
- `develop`: Serves as the staging branch.
- `feature/*`: Development for new features happens in these branches.
  Pull requests are made from `feature` branches into `develop`.
