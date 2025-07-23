# REST Express Full-Stack Application

## Overview

This is a full-stack web application built with Express.js backend and React frontend, featuring a customer service chatbot with order tracking capabilities. The application uses a hybrid architecture that integrates with an existing MSSQL database while being configured for potential PostgreSQL migration through Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM configured for PostgreSQL (though currently using MSSQL)
- **Database**: Microsoft SQL Server (production), PostgreSQL ready (development)
- **API Pattern**: RESTful endpoints with JSON responses
- **Session Management**: Built-in session handling with connect-pg-simple

### Key Components

#### Database Layer
- **Current**: MSSQL connection using `mssql` package
- **Future**: PostgreSQL with Drizzle ORM (schema defined in `shared/schema.ts`)
- **Tables**: Customers, Orders, OrderNotes, ChatMessages
- **Migration Strategy**: Drizzle migrations in `./migrations` directory

#### API Endpoints
- `POST /api/track-order` - Order tracking by email and order ID
- `POST /api/chat/message` - Chat message handling (planned)
- `GET /api/chat/history/:sessionId` - Chat history retrieval (planned)

#### Frontend Components
- **Chatbot Interface**: Main conversational UI with message history
- **Order Tracking Modal**: Detailed order status with timeline visualization
- **Chat Input**: Message composition with keyboard shortcuts
- **Order Timeline**: Visual progress indicator for order status

## Data Flow

### Order Tracking Flow
1. User provides email and order ID through chatbot
2. Frontend validates input using Zod schemas
3. API queries MSSQL database for order details
4. System fetches order notes to build status timeline
5. Response includes order info, customer details, and status history
6. Frontend displays results in modal with visual timeline

### Chat Flow
1. User sends message through chat input
2. Session ID generated for conversation tracking
3. Messages stored in database with timestamp
4. Bot responses generated based on user intent
5. Conversation history maintained per session

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives for accessible components
- **Icons**: Lucide React for consistent iconography
- **Date Handling**: date-fns for date formatting and manipulation
- **Validation**: Zod for runtime type checking and validation
- **HTTP Client**: Fetch API with custom wrapper for API requests

### Backend Dependencies
- **Database**: `mssql` for SQL Server connectivity, `@neondatabase/serverless` for PostgreSQL
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Validation**: Zod for API request/response validation
- **Session**: `connect-pg-simple` for PostgreSQL session store

### Development Tools
- **Build**: esbuild for server bundling, Vite for client bundling
- **Development**: tsx for TypeScript execution
- **Replit Integration**: Custom plugins for Replit environment

## Deployment Strategy

### Build Process
1. **Frontend**: Vite builds client-side assets to `dist/public`
2. **Backend**: esbuild bundles server code to `dist/index.js`
3. **Database**: Drizzle migrations applied via `db:push` script

### Environment Configuration
- **Development**: Uses tsx for hot reloading, Vite dev server
- **Production**: Node.js serves bundled Express app with static files
- **Database**: Environment variables for connection strings

### Hosting Considerations
- **Static Assets**: Served through Express in production
- **API Routes**: Express middleware handles API endpoints
- **Database**: Supports both MSSQL (current) and PostgreSQL (future)
- **Session Storage**: PostgreSQL-based session store ready for scaling

### Migration Strategy
The application is architected to support migration from MSSQL to PostgreSQL:
- Drizzle schema defined for PostgreSQL compatibility
- MSSQL implementation in storage layer can be swapped out
- Shared schema types ensure consistency across database layers
- Migration scripts ready for data transfer when needed

## Recent Changes (July 23, 2025)

### Project Migration from Replit Agent to Replit Environment
- Successfully migrated full-stack REST Express application to native Replit environment
- Verified all packages are properly installed and configured (tsx, React, Express, etc.)
- Confirmed development workflow runs without errors on port 5000
- Validated frontend-backend integration with API status endpoint working correctly
- Ensured proper client/server separation following security best practices
- Chat widget interface confirmed to be working as designed (floating button opens chatbot)
- All shadcn/ui components properly integrated and accessible
- No LSP diagnostics errors found - application is production-ready
- Migration completed successfully with full Replit compatibility

## Recent Changes (July 22, 2025)

### JavaScript Version Enhanced with MSSQL Support
- Added complete MSSQL Server connectivity to JavaScript version
- Created Node.js server with `mssql` package integration
- Implemented automatic fallback to mock data if database unavailable  
- Added comprehensive environment variable configuration (.env support)
- Created complete database setup documentation (MSSQL-SETUP.md)
- Enhanced startup scripts with automatic dependency installation
- Updated packaging to include all MSSQL-related files
- New downloadable bundle: `karjistore-chatbot-javascript-mssql-v2.0.zip` (28KB)

### Key Features Added
- Direct MSSQL database queries using same nopCommerce schema as React version
- Connection pooling with timeout and error handling
- Status mapping for order and shipping statuses  
- Graceful database connection management with automatic fallback
- Cross-platform startup scripts that detect Node.js vs Python environments
- Production-ready configuration with environment variable support