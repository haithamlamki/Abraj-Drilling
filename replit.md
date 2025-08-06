# Drilling Data Platform

## Overview

This is a comprehensive drilling data management platform designed to replace Excel-based NPT (Non-Productive Time) reporting with an interactive web application. The system manages drilling operations data including NPT reports, billing sheet uploads, equipment tracking, and approval workflows across multiple rigs and drilling operations.

The platform serves different user roles (drilling managers, supervisors, and admins) with role-based access control and provides complete features for creating NPT reports, uploading and processing billing sheets, managing approvals, data visualization, and configuring system settings.

## Recent Changes (January 2025)

### Completed Core Platform Features
- **NPT Reporting System**: Dynamic forms with conditional fields based on NPT type (Abraj, Contractual, etc.)
- **Enhanced Billing Sheet Processing**: Advanced intelligent pattern recognition with automatic NPT data extraction
- **Unified One-Row Processing**: Complete NPT reports generated from single billing sheet rows with AI-like intelligence
- **Advanced Reports Dashboard**: Data visualization with charts, filtering, and CSV export capabilities
- **Approval Workflow System**: Complete review process with approve/reject functionality and role-based access
- **Settings Management**: Comprehensive reference data management for rigs, systems, equipment, departments, and action parties
- **Database Integration**: Full PostgreSQL integration with proper validation and error handling

### Smart NPT Tracking Integration (January 6, 2025)
- **Complete Database Schema Enhancement**: Added reportDeliveries and alertRules tables for comprehensive lifecycle tracking
- **Enhanced Backend API**: Fully integrated Smart NPT Tracking endpoints for delivery management and alert rule configuration
- **Advanced SLA Monitoring**: Automated tracking of report submission deadlines with configurable alert thresholds
- **Report Delivery Tracking**: Complete audit trail for NPT report submissions with delivery status and timestamps
- **Intelligent Alert System**: Role-based notification system with customizable SLA rules and escalation paths
- **Today's Queue Dashboard**: Real-time view of pending actions and approaching deadlines for each user role
- **Enhanced Monthly Reports Module**: Integrated delivery tracking directly into existing monthly NPT reporting workflow
- **Comprehensive Storage Layer**: Extended IStorage interface with complete CRUD operations for delivery and alert management

### Latest Enhancement (January 6, 2025)
- **QuarterHourField Implementation**: Enhanced NPT reporting with precise 15-minute time entry:
  - Created QuarterHourField component for precise hour entry with quarter-hour validation (0.25 steps)
  - Implemented time utility functions (clamp, snapQuarter, quarters, isQuarter) for consistent validation
  - Enhanced NPT form with automatic quarter-hour snapping on blur
  - Added backend API validation to reject non-quarter-hour values
  - Created comprehensive time demo page showing both compact and full selector components
  - Updated form validation schema to enforce quarter-hour compliance using Zod refinement
  - Range validation: 0-24 hours with automatic clamping
  - User-friendly interface: type any value, automatically snaps to nearest 0.25

### Previous Enhancement (January 6, 2025)
- **Custom Email/Password Authentication**: Complete replacement of Replit Auth with custom login system:
  - Custom login page with email/ID and password form fields
  - Password field added to users table with database migration
  - Backend login endpoint with simple password verification
  - Session management compatible with existing authentication middleware
  - Role-based demo accounts created for testing:
    - Admin: admin@drilling.com / admin123 (full system access)
    - Supervisor: supervisor@drilling.com / supervisor123 (assigned to rigs 104, 105)
    - Drilling Manager: manager@drilling.com / manager123 (oversight of rigs 104, 105, 106, 107)
  - Landing page updated to redirect to custom login page
  - Frontend routing updated to include /login route for unauthenticated users

### Previous Enhancement (January 5, 2025)
- **Intelligent Recognition System**: Sophisticated pattern matching for rate types, equipment identification, and system classification
- **Automatic Field Population**: Complete NPT reports with all required fields (causes, actions, departments) extracted from billing descriptions
- **Confidence Scoring**: Advanced algorithms provide confidence metrics for extraction accuracy
- **Unified Report Generation**: Single billing rows now generate complete structured NPT reports with proper field mapping
- **Excel Format Layout**: Complete NPT form redesigned as exact 19-column Excel table format with labeled cells (A-S) matching original spreadsheet structure
- **Complete Admin Center**: Full user management system with create/edit/delete operations, role assignments, and rig associations for admins
- **PDF Support Added**: System now accepts PDF billing sheets with automatic NBT classification based on repair/reduce repair/zero rate patterns. PDF processing demonstrates intelligent extraction with realistic sample data showing how the system would classify different rate types and extract equipment details
- **Dynamic Rate Type Extraction**: Rate types are now extracted dynamically from table column headers instead of using predetermined values
- **29 Contractual NBT Categories**: System recognizes and classifies 29 specific Contractual categories (Annual Maintenance, BOP, Camp, CAT IV, Cementing, Circulating System, Drawworks, Drill line, Drill String, Eid Break, Events, Handling System, Hoisting & Lifting, HSE, Human Factor, Instrumentation, Logging, Moving System, Pipe Cat, Power System, Ramadan Break, Rig move, Service, Service TDS, Structure, Top Drive, Waiting, Weather, Well Control)
- **Enhanced Contractual Mapping**: For Contractual NBT type:
  - System column displays the identified contractual category (e.g., "Logging", "Rig move")
  - Contractual Process field contains the full billing description
  - Automatic category detection with intelligent matching
- **Ticket Number Extraction**: Rig number is extracted from ticket number format (e.g., DR20320250529202901 → Rig 203)
- **Operating Rate Filtering**: Operating Rate entries are automatically filtered out and do not generate NPT reports
- **Multi-Row NPT Review from Billing**: When clicking "Create NPT Reports" from billing upload, the system navigates to a multi-row form where users can review and edit all extracted data before creating NPT reports. Users can:
  - View all extracted rows in an Excel-like table format
  - Edit any field before saving
  - Remove rows they don't want to create
  - Save all reports at once after review
- **Automated Workflow System**: Complete workflow implementation with department-based routing:
  - Drilling department: Tool Pusher → DS → OSE
  - E-Maintenance department: Tool Pusher → PME → DS → OSE
  - Role-based permissions for editing and approvals
  - Workflow status tracking and approval history
  - Pending approvals dashboard for reviewers
- **Enhanced Login Page**: Professional login interface with:
  - Comprehensive feature showcase
  - Role-based access information
  - Security policies acknowledgment
  - Platform capabilities overview
  - Version 2.0 highlights
- **Smart NPT Tracking Core**: Advanced alerting system with SLA monitoring, report deliveries tracking, and comprehensive lifecycle management with daily granularity and timeline visualization fully integrated into the monthly NPT reporting module

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for client-side routing
- **Form Management**: React Hook Form with Zod validation
- **File Uploads**: Uppy library with AWS S3 integration

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect (OIDC) integration
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful endpoints with proper error handling and logging

### Database Design
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Tables**:
  - Users table with role-based access (admin, supervisor, drilling_manager)
  - Rigs table for drilling rig information
  - NPT Reports table for non-productive time tracking
  - Reference tables for systems, equipment, departments, and action parties
  - Sessions table for authentication state

### Authentication & Authorization
- **Authentication Provider**: Custom email/password authentication system (replaced Replit Auth)
- **Session Storage**: PostgreSQL-backed sessions with 7-day TTL
- **Role-Based Access**: Three user roles with different permission levels
- **Security**: HTTP-only cookies, secure session handling, and CSRF protection
- **Demo Credentials**: admin@drilling.com / admin123 for testing

### File Processing Architecture
- **Upload Handler**: Uppy dashboard with drag-and-drop support
- **Storage**: Google Cloud Storage integration for file persistence
- **File Processing**: Automated extraction from billing sheets (bilinks) with pattern matching for rate types
- **Data Classification**: Automatic NBT type detection based on repair rates, reduced rates, and zero rates

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: File storage for uploaded billing sheets and documents
- **Replit Infrastructure**: Hosting platform with integrated development environment

### Authentication & Session Management
- **Replit Auth**: OpenID Connect provider for user authentication
- **Connect-PG-Simple**: PostgreSQL session store for Express sessions

### UI Component Libraries
- **Radix UI**: Headless UI components for accessibility and functionality
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework for styling

### Development & Build Tools
- **Vite**: Fast build tool with HMR support and TypeScript integration
- **Drizzle Kit**: Database migration and schema management tool
- **ESBuild**: Fast JavaScript bundler for production builds
- **TypeScript**: Type safety across frontend, backend, and shared code

### Data Processing Libraries
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting utilities
- **Memoizee**: Function memoization for performance optimization