---
name: draftly-upgrade
description: Upgrade the existing Draftly app toward Draftly 2.0 while preserving functionality and following the plan's security and approval requirements.
---

# MASTER DEVELOPMENT SKILL — DRAFTLY 2.0

## Role and Mission

You are a Senior Full-Stack Software Engineer, AI Agent Architect, SaaS Architect, Security Engineer, and DevOps Engineer.

Your mission is to upgrade my existing **Draftly AI Email Application** into a secure, production-ready, multi-user AI Email Management, Gmail Integration, Approval, and Scheduling Platform.

**IMPORTANT: This is an existing working project, not a new application.**

You must inspect the entire existing codebase, understand its architecture, and extend it without unnecessarily rebuilding or breaking existing functionality.

I want you to autonomously implement the requested features, create necessary files, install dependencies, update the database schema, write tests, and verify the application.

Do not stop after planning. Implement the complete solution, except where my credentials, external configuration, or security approval are required.

---

# 1. EXISTING PROJECT ARCHITECTURE

Project: Draftly

Existing technologies:

**Backend**
- Python
- FastAPI
- LangChain / LangGraph
- SQLAlchemy 2 Async
- SQLite
- Server-Sent Events
- uv package manager

**Frontend**
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- TanStack Query

**AI**
- Ollama-compatible language models
- LangChain `create_agent`
- Existing AI draft generation workflow

Existing capabilities include:
- AI-generated email drafts
- Email editing
- Draft review and approval
- Draft version history
- Safety checks
- Streaming AI responses

Preserve all existing functionality.

Read and follow the existing `.claude/skills/fullstack-ai-agent-app/SKILL.md` and its relevant reference files.

Use the existing layered architecture, API conventions, error handling, and frontend design patterns.

Before modifying anything, perform a complete codebase audit.

---

# 2. AUTHENTICATION SYSTEM

Implement a complete authentication system.

Required features:

- User signup
- User login
- User logout
- Secure password hashing using Argon2id or an equivalent established algorithm
- Email verification
- Password reset
- Session management
- Secure HTTP-only authentication cookies
- CSRF protection where applicable
- Login rate limiting
- Protected routes
- Session expiration and revocation
- User profile management

Create the following frontend pages:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/dashboard`
- `/settings/profile`

Use the existing frontend design language.

Do not store authentication tokens in browser localStorage.

Implement server-side authentication and authorization checks for all protected APIs.

---

# 3. SUPER ADMIN SYSTEM

Implement a role-based access control system.

Required roles:

**SUPER_ADMIN**
- Complete platform control
- Manage all users
- Approve or reject access requests
- Grant and revoke roles
- Suspend and reactivate accounts
- View system activity
- Manage platform settings
- View operational logs
- Control platform-wide feature availability

**ADMIN**
- Manage explicitly assigned users or resources
- Access authorized administrative features
- View permitted reports
- Cannot modify the Super Admin
- Cannot promote themselves or others to Super Admin

**USER**
- Access personal dashboard
- Generate and manage personal email drafts
- Connect personal Gmail account
- Approve personal drafts
- Schedule personal emails
- View personal email activity

## Super Admin Ownership

I am the platform owner and must be the initial Super Admin.

Implement a secure one-time bootstrap process to establish the first Super Admin account.

Requirements:

- Super Admin identity must be established through secure environment configuration or a one-time setup command.
- Never hardcode credentials.
- Never expose bootstrap credentials in logs.
- Prevent duplicate bootstrap operations.
- Prevent unauthorized Super Admin creation.
- Protect against deleting or demoting the last Super Admin.
- Never allow public signup to assign privileged roles.

Create an Admin Dashboard at `/admin`.

Include:

- User management
- Pending access requests
- Role management
- Account suspension
- Platform statistics
- Email scheduling overview
- Failed email delivery overview
- Security and audit logs
- Platform settings

**Access control must be enforced by the backend, not just by hiding frontend buttons.**

---

# 4. USER ACCESS APPROVAL SYSTEM

I want complete control over who can use my platform.

Implement configurable registration modes:

1. Invite-only registration
2. Registration requiring Super Admin approval
3. Open registration, if explicitly enabled by Super Admin

Default mode: Registration requiring approval.

New users should remain in a PENDING state until approved.

Super Admin can:

- Approve a user
- Reject a user
- Suspend a user
- Revoke access
- Change allowed roles
- Send invitations

Pending or suspended users must not access protected application functionality.

Preserve audit records for all access changes.

---

# 5. GMAIL OAUTH 2.0 INTEGRATION

Integrate the official Google Gmail API.

Users must be able to connect their own Gmail accounts securely.

Implement:

- Google OAuth 2.0 Authorization Code Flow
- PKCE and state validation
- Google consent screen integration
- Secure token exchange
- Encrypted refresh-token storage
- Access-token refresh
- Account disconnection
- Token revocation where supported
- Connection status monitoring
- Gmail API error handling

Use the minimum Google OAuth scopes required for the implemented functionality.

Prefer narrowly scoped Gmail permissions for draft creation and sending.

Do not request full mailbox access unless absolutely necessary.

Do not use Gmail usernames or passwords.

Never expose OAuth client secrets or refresh tokens to the frontend.

Required pages:

- `/settings/integrations`
- `/settings/integrations/gmail`

Display:

- Connected Gmail address
- Connection status
- Connect button
- Disconnect button
- Reconnect button
- Last successful synchronization or API verification time, clearly labeled

Provide `.env.example` entries for all required Google OAuth configuration.

Document the Google Cloud Console setup, OAuth consent screen, redirect URIs, scopes, testing mode, and any verification requirements.

---

# 6. GMAIL DRAFT MANAGEMENT

Users should be able to generate emails using the existing Draftly AI Agent and save approved drafts to Gmail.

Required workflow:

1. User enters an email idea.
2. Draftly generates the email.
3. User reviews the generated content.
4. User edits the subject, body, and recipients.
5. User approves the final draft.
6. User chooses to save it in Gmail Drafts, send it now, or schedule it.

Implement:

- Gmail draft creation
- Gmail draft updating
- Gmail draft deletion, with confirmation
- Gmail draft ID tracking
- Draft ownership validation
- Local draft-to-Gmail draft mapping
- Recipient validation
- CC and BCC support
- HTML and plain-text email support

Preserve the existing local draft version history.

If the Gmail draft is changed after approval, require reapproval before sending.

Clearly distinguish local Draftly drafts from Gmail drafts.

---

# 7. EMAIL APPROVAL WORKFLOW

Implement explicit human approval before sending.

Draft statuses should support:

- DRAFT
- PENDING_APPROVAL
- APPROVED
- SCHEDULED
- SENDING
- SENT
- FAILED
- CANCELLED

Maintain compatibility with existing draft statuses and existing API contracts.

Approval must be associated with an immutable snapshot containing:

- Subject
- Body
- Recipients
- CC/BCC
- Sender Gmail account
- Draft version
- Approving user
- Approval timestamp

Any material changes after approval must invalidate the previous approval.

**Never send an email without valid authorization and explicit approval.**

For immediate sending, require a deliberate Send Now action with appropriate confirmation.

---

# 8. AUTOMATIC EMAIL SCHEDULING

This is a critical feature.

Users must be able to select an approved email and schedule it for a future date and time.

Example:

Current time: 10:00 AM

User selects an approved email.

Recipient: client@example.com

Scheduled time: 1:00 PM

The application must automatically send that exact approved email at approximately 1:00 PM, without requiring the user to keep the browser open.

The application must support:

- Schedule email
- Schedule using exact date and time
- Schedule using relative delays such as 3 hours
- View scheduled emails
- Edit schedule
- Reschedule email
- Cancel scheduled email
- View delivery status
- Retry failed deliveries safely
- View send history

## Scheduling Architecture

Use a durable background job architecture.

Preferred approach:

- PostgreSQL for persistent production data
- Redis-backed Celery workers, or another justified durable scheduling system
- Separate scheduler and worker processes where required

Do not use FastAPI BackgroundTasks, browser timers, or in-memory Python timers as the sole scheduling mechanism.

Scheduling must survive:

- Browser closure
- Application restart
- Worker restart
- Server restart
- Temporary network failure

Store scheduling timestamps in UTC.

Display timestamps in the user's selected IANA time zone.

Handle daylight-saving transitions correctly.

## Delivery Reliability

Implement:

- Persistent scheduling records
- Transactional job claiming or locking
- Protection against concurrent workers processing the same job
- Idempotency controls
- Safe retry policies with exponential backoff
- Rate-limit handling
- Permanent failure handling
- Recovery of interrupted jobs
- Audit logging

Gmail sending cannot be assumed to provide perfect exactly-once delivery.

If a network failure leaves delivery status uncertain, reconcile using available Gmail message identifiers and state before retrying.

Do not blindly resend a message with an uncertain outcome.

Provide realistic scheduling accuracy guarantees and monitor queue delays.

---

# 9. EMAIL SCHEDULING DASHBOARD

Create `/dashboard/scheduled`.

Include:

- Scheduled email list
- Recipient
- Subject
- Connected Gmail account
- Scheduled date and time
- Current status
- Edit action
- Reschedule action
- Cancel action

Create `/dashboard/sent` and `/dashboard/failed`.

Include searchable and filterable history.

Display delivery errors using clear, understandable messages.

Do not claim that Gmail recipient delivery has been confirmed merely because Gmail accepted the send request.

---

# 10. DATABASE ARCHITECTURE

Review the existing SQLite database implementation.

Implement a safe migration strategy toward PostgreSQL for production reliability.

Use SQLAlchemy 2 Async and Alembic migrations.

Suggested entities:

- users
- roles
- user_roles
- access_requests
- invitations
- sessions
- gmail_connections
- drafts
- draft_versions
- draft_approvals
- scheduled_emails
- email_send_attempts
- email_events
- audit_logs
- platform_settings

These are suggested entities, not mandatory table names.

Adapt the schema to the existing codebase and avoid unnecessary duplication.

Every user-owned record must have a verified owner or tenant relationship.

Enforce data isolation at the database query and service layers.

Do not allow one user to access another user's drafts, connected Gmail accounts, or scheduled emails.

Preserve existing draft records and version history during migration.

Never silently delete or reset existing data.

---

# 11. FRONTEND EXPERIENCE

Build a professional, responsive SaaS interface.

Keep the existing Draftly visual identity.

Required navigation:

**User Dashboard**
- Overview
- AI Email Writer
- My Drafts
- Gmail Drafts
- Scheduled Emails
- Sent Emails
- Failed Emails
- Integrations
- Settings

**Super Admin Dashboard**
- Overview
- Users
- Access Requests
- Roles and Permissions
- Email Operations
- Audit Logs
- Platform Settings

Use reusable React components.

Provide:

- Loading states
- Empty states
- Error states
- Success notifications
- Confirmation dialogs
- Form validation
- Accessible controls
- Responsive mobile and desktop layouts

Do not create placeholder buttons or fake API responses in the finished application.

---

# 12. SECURITY REQUIREMENTS

Treat authentication, Gmail credentials, and email sending as security-critical.

Implement:

- Backend authorization checks
- Secure password hashing
- Secure session cookies
- CSRF protection where applicable
- OAuth state and PKCE verification
- Encrypted Gmail tokens at rest
- Secrets through environment variables or a secret manager
- Rate limiting
- Input validation
- Protection against privilege escalation
- Prevention of IDOR vulnerabilities
- User data isolation
- Audit logging
- Safe error handling
- Secure CORS configuration
- Protection against duplicate email sending

Never log passwords, refresh tokens, access tokens, or sensitive email content unnecessarily.

Apply least-privilege principles.

No user should be able to connect or send from another user's Gmail account without authorization.

Do not automatically send AI-generated emails without explicit human approval.

---

# 13. PACKAGE MANAGEMENT AND DEPENDENCIES

The backend uses `uv`.

Use `uv` for Python dependency management.

Examples:

```bash
uv add package-name
uv sync
uv run pytest
```

For frontend dependencies, use npm and preserve the existing lockfile.

Install only necessary dependencies.

Do not replace working libraries without a technical reason.

Update lockfiles whenever dependencies change.

---

# 14. TESTING REQUIREMENTS

Implement automated tests for:

- Signup and login
- Password reset
- Session security
- Super Admin bootstrap
- Role-based permissions
- Unauthorized access rejection
- User approval and suspension
- Gmail OAuth callback validation
- Gmail token refresh
- Gmail draft creation and updates
- Draft approval and invalidation
- Scheduling and rescheduling
- Cancellation
- Worker restart recovery
- Concurrent scheduling workers
- Duplicate-send prevention
- Gmail API failures
- Retry behavior
- Cross-user data isolation

Use mocked Gmail APIs for automated testing.

Do not send real emails during automated tests.

Provide a separate, explicitly authorized Gmail sandbox integration test procedure.

Run backend tests, frontend linting, TypeScript checks, and production builds.

Fix failures introduced by the implementation.

---

# 15. DEPLOYMENT AND OPERATIONS

Provide a production-capable deployment architecture.

Include:

- Next.js frontend
- FastAPI backend
- PostgreSQL
- Redis, if required
- Scheduler process
- Worker process
- Environment configuration
- Database migrations
- Health checks
- Structured logging
- Backup and recovery instructions

Review and update the existing Docker Compose setup.

Ensure scheduling continues when the frontend is offline.

Provide guidance for deployment on platforms supporting persistent workers and schedulers.

Do not assume that a serverless frontend deployment can execute persistent scheduling workers.

---

# 16. EXECUTION INSTRUCTIONS

You are authorized to implement the application changes autonomously within the project workspace.

Follow this execution sequence:

**Phase 1 — Codebase Audit**

Inspect the entire project.

Identify existing features, architectural constraints, tests, and extension points.

Create a concise implementation plan.

**Phase 2 — Authentication and Authorization**

Implement authentication, Super Admin bootstrap, user management, and permissions.

**Phase 3 — Gmail Integration**

Implement OAuth, token management, connection settings, and Gmail draft operations.

**Phase 4 — Approval Workflow**

Implement immutable approval snapshots and approval validation.

**Phase 5 — Scheduling Engine**

Implement durable scheduling, worker execution, retry safety, cancellation, and recovery.

**Phase 6 — Frontend Integration**

Implement dashboards, forms, navigation, and user workflows.

**Phase 7 — Testing and Verification**

Run all relevant tests and builds.

Fix failures.

**Phase 8 — Documentation and Delivery**

Update README, environment examples, architecture documentation, deployment instructions, and API documentation.

Do not repeatedly ask me for routine implementation decisions.

Make reasonable engineering decisions and explain them in the final report.

However, stop and request my approval before:

- Deleting existing user data
- Performing destructive database migrations
- Sending real emails
- Deploying to production
- Creating or changing privileged accounts in an existing live environment
- Performing irreversible external operations

Never fabricate credentials or claim a Google integration works before it has been configured and verified.

If Google Cloud credentials are unavailable, implement the integration and mock tests, document the missing configuration, and continue all independent development work.

---

# 17. FINAL ACCEPTANCE CRITERIA

The upgrade is complete only when:

1. Users can securely register and log in.
2. Super Admin can approve and manage access.
3. Unauthorized users cannot access protected resources.
4. Users can securely connect their Gmail accounts.
5. Users can generate and edit AI email drafts.
6. Approved drafts can be saved to Gmail.
7. Users can approve an exact email version.
8. Users can schedule an approved email for a future time.
9. A persistent background worker can send the scheduled email without an open browser.
10. Users can cancel or reschedule pending emails.
11. Failed sends are handled safely.
12. Duplicate-send risks are mitigated.
13. Users can view accurate email statuses.
14. Existing Draftly features continue working.
15. Tests and production builds pass.
16. Setup and deployment instructions are complete.

At the end, provide:

- Summary of implemented features
- Files created and modified
- Database migrations
- Dependencies added
- Environment variables required
- Google Cloud Console configuration steps
- Local development commands
- Test results
- Remaining external setup requirements
- Known limitations
- Production readiness assessment

**FINAL OBJECTIVE**

Transform the existing Draftly project into a secure, professional AI-powered email management platform with Super Admin control, multi-user authentication, Gmail integration, human approval, and reliable automatic scheduled email sending.

Preserve the existing project. Implement real, tested functionality rather than demonstrations or placeholders.
