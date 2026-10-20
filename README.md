# Draftly — AI-Powered Email Drafting Assistant

Draftly is a full-stack AI application that transforms simple ideas into professional email drafts using AI.

It helps users create, review, edit, and manage email drafts while keeping full control over the final content.

> **Draftly generates email drafts. It does not automatically send emails.**

## Features

- AI-powered email draft generation
- Ollama integration for AI models
- Streaming AI responses
- Draft editing and version history
- Email content safety checks
- Time-zone-aware date handling
- Responsive user interface
- Dark and light theme support
- REST API built with FastAPI

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| AI | LangChain, Ollama |
| Package Management | uv, npm |
| Database | SQLite |
| Deployment | Docker |

## Project Structure

```text
draftly/
├── .claude/
│   └── skills/
├── api/
│   ├── app/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── web/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following tools:

- Python 3.13
- uv package manager
- Node.js and npm
- Ollama with an available AI model

### 1. Clone the Repository

```bash
git clone https://github.com/waleed341/draftly.git
cd draftly
```

### 2. Backend Setup

Open PowerShell:

```powershell
cd api
uv sync
Copy-Item .env.example .env
```

Configure the AI model in `api/.env` according to your Ollama setup.

Start the backend:

```powershell
uv run uvicorn app.main:app --reload
```

Backend API documentation:

http://127.0.0.1:8000/docs

### 3. Frontend Setup

Open another PowerShell terminal from the project root:

```powershell
cd web
npm install
```

Start the frontend:

```powershell
npm run dev
```

Open:

http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/drafts` | Generate an email draft |
| POST | `/api/drafts/stream` | Stream draft generation |
| GET | `/api/drafts` | Retrieve saved drafts |
| GET | `/api/drafts/{id}` | Retrieve draft details |
| PUT | `/api/drafts/{id}/edit` | Edit an existing draft |

## How It Works

1. The user enters an email idea.
2. The backend processes the request.
3. The AI model generates an email draft.
4. The user reviews and edits the generated content.
5. Draft versions remain available for future review.

## Security and Privacy

- Environment variables are used for configuration.
- Sensitive `.env` files are excluded from Git.
- Email drafts are not automatically sent.
- Users review drafts before finalizing them.

## Future Improvements

- Gmail integration
- User authentication
- Email templates
- Additional AI model integrations

## Author

**Muhammad Waleed**

GitHub: [@waleed341](https://github.com/waleed341)

## License

No license has been specified for this project.