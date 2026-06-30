# Swarajya MCP – Production Grade Technical Specification

**Version:** 1.0  
**Date:** 30 June 2026  
**Status:** Ready for Implementation  
**Type:** Full-Scale Product (Not MVP)

---

## 1. Introduction & Product Vision

The **Swarajya MCP** (Content Intelligence Layer) is a production-grade orchestration service that converts Swarajya’s Quintype-powered content archive into a high-quality, queryable knowledge system.

Users (both internal and external) should be able to ask natural language questions about Swarajya’s coverage and receive **grounded, well-cited, professional responses** drawn exclusively from published Swarajya content.

This is a **full-scale product**. It must be designed for reliability, extensibility, security, and long-term maintainability.

---

## 2. Reference to Complete API Documentation

The single source of truth for all Quintype API behaviour is the live Swagger specification located at:

**`https://quintype-demo.quintype.io/swagger.json`**

This is the authoritative Swagger 2.0 definition containing every endpoint, schema, parameter, and response structure. The implementation team (or AI coding assistant) **must consult this URL** for authoritative details on any endpoint, parameters, and response formats.

---

## 3. Architecture Overview

```
External Consumers
├── Swarajya Website (Insights / Ask Swarajya)
├── External AI Agents (ChatGPT Custom GPTs, Claude Tools, etc.)
└── Future channels
         ↓
   Swarajya MCP (FastAPI)
         ↓
   Intelligent Orchestration & Synthesis Layer
         ↓
   Quintype API Surface (Full)
         ↓
   LLM Layer (Grounded Synthesis)
         ↓
   Structured, Cited Response
```

The MCP is a **smart orchestration layer**. It should intelligently compose calls to multiple Quintype endpoints rather than treating the API as a simple search backend.

---

## 4. Key API Endpoints & Strategic Usage

### Core Retrieval (Foundation Layer)
| Endpoint                              | Purpose                              | Priority   | Guidance |
|---------------------------------------|--------------------------------------|------------|----------|
| `GET /api/v1/advanced-search`         | Primary search with rich filters     | Critical   | Main entry point for queries. Use `q`, filters, `sort`, aggregations |
| `GET /api/v1/stories/{story-id}`      | Full story with cards + access level | Critical   | Enrich top results and enforce access control |
| `GET /api/v1/stories-by-slug`         | Lookup story by slug                 | High       | Convenient alternative lookup |

### Intelligence & Context Enrichment
| Endpoint                                      | Purpose                              | Priority | Guidance |
|-----------------------------------------------|--------------------------------------|----------|----------|
| `GET /api/v1/stories/{story-id}/related-stories` | Additional relevant articles     | High     | Expand context beyond initial search |
| `GET /api/v1/entities` & `/api/v1/entity/{id}`   | Entity discovery and profiles     | High     | Enable entity-aware querying |
| `GET /api/v1/entities/{id}/{subentity}`          | Nested entity relationships       | Medium   | Future deep research capability |
| `GET /api/v1/collections/{slug}`                 | Manual & automated collections    | High     | Leverage curated collections |
| `GET /api/v1/authors/{id}/collection`            | Author-specific content           | Medium   | Support author-centric queries |

### Supporting Endpoints
- `GET /api/v1/config`
- `GET /api/v1/sections`
- `GET /api/v1/tags/{slug}`
- `GET /api/v1/trending/tags`
- `GET /api/v1/breaking-news`

**Design Principle:** Start with core search + story retrieval. Progressively add entity awareness, related stories, and collection intelligence in later phases.

---

## 5. Core Product Capabilities (Full Scale)

- Natural language querying of the full Swarajya archive
- High-quality, grounded LLM synthesis with mandatory citations
- Respect for story-level `access` controls
- Entity-aware and collection-aware responses
- Clean, structured responses suitable for both humans and tool-calling LLMs
- Support for internal website usage and external AI agent usage
- Extensible foundation for future capabilities (personalised briefings, research mode, topic tracking, etc.)

---

## 6. Technical Stack & Constraints

- **Framework**: FastAPI + Uvicorn (async)
- **Data Validation**: Pydantic v2
- **HTTP Client**: `httpx` (async)
- **LLM Provider**: Anthropic Claude (primary). Must be configurable.
- **Configuration**: Environment variables only
- **Observability**: Structured logging + health endpoints
- **Security**: Rate limiting and input validation required

---

## 7. Configuration (Environment Variables)

```env
QUINTYPE_BASE_URL=https://swarajyamag.com
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022
MAX_CONTEXT_STORIES=8
REQUEST_TIMEOUT=45
LOG_LEVEL=INFO
```

All external services and limits must be configurable via environment variables.

---

## 8. Authentication & Client Management

### Overview
The MCP will use a **Client + Bearer Token** model for authentication. An internal **Admin Frontend** will be used to create and manage clients and their tokens. This approach provides controlled access while remaining relatively simple to implement in Phase 1.

### Admin Frontend Capabilities (Phase 1)
The Admin UI should allow authorized internal users to perform the following actions:

- **Create Client**
  - Fields: `name`, `description`, `contact_email` (optional), `rate_limit_per_minute` (optional)
- **Generate Bearer Token**
  - System generates a long, random, secure token (shown only once to the admin)
  - Token is stored as a **hash** (never in plain text)
- **List Clients** with their active tokens
- **Revoke / Delete Tokens** (immediate effect)
- **Deactivate Client** (soft delete / disable all tokens)

### Data Model (Recommended)

**Clients Table**
- `id`
- `name`
- `description`
- `is_active`
- `created_at`
- `created_by` (admin user)
- `rate_limit_per_minute` (nullable)

**Client Tokens Table**
- `id`
- `client_id`
- `token_hash`
- `is_active`
- `created_at`
- `expires_at` (nullable)
- `last_used_at` (nullable)

### Token Validation Flow (MCP)
1. Client sends request with header: `Authorization: Bearer <token>`
2. MCP looks up the token hash in the database.
3. If valid and active → request proceeds (client context attached to request).
4. If invalid/revoked/expired → return `401 Unauthorized`.

### Security Requirements
- Tokens must be stored as **hashes** (use strong hashing like bcrypt or Argon2).
- Tokens should be long (minimum 32–40 characters).
- Support for optional token expiration.
- Immediate revocation support (no caching of tokens for too long).
- Basic rate limiting per client should be implemented from Phase 1.

### Content Access Control
Regardless of authentication, the MCP **must** respect story-level access:
- Use the `access` field and `AccesstypeStoryAttributes` returned by Quintype.
- Do not return full content or synthesis from premium stories to clients who should not have access.

### Future Enhancements (Phase 3)
- Token scopes / permissions (e.g., `public_only`, `full_access`)
- Per-client usage quotas and analytics dashboard
- Integration with Swarajya’s existing member/subscription system
- Self-service API key management for premium subscribers (future)

---

## 9. Primary Endpoint Design

**Initial Core Endpoint:** `POST /api/v1/ask`

**Request Example:**
```json
{
  "query": "What does Swarajya say about China tech policy?",
  "limit": 6,
  "include_related": true
}
```

**Response Requirements:**
- Must be strictly structured (see schemas in implementation).
- Must include `synthesis` and `sources` array with proper citations.
- Must clearly indicate access level of sources where relevant.

Additional endpoints should be planned for future phases (e.g. `/briefing`, `/research`).

---

## 10. Data Flow & Orchestration Logic

1. Receive and validate incoming query.
2. Construct and execute call to `/api/v1/advanced-search`.
3. Retrieve and optionally enrich top results using `/api/v1/stories/{story-id}`.
4. (Later phases) Detect entities and query entity endpoints.
5. (Later phases) Check for relevant collections.
6. Curate context and send to LLM with strong grounding instructions.
7. Return structured, cited response.

The orchestration logic should be cleanly separated from API clients.

---

## 11. LLM Integration & Prompt Strategy

- Use a well-engineered, versioned system prompt.
- The prompt must strictly enforce grounding in the provided articles only.
- Citations must follow a consistent format (Headline + Date + URL).
- Tone should align with Swarajya’s editorial voice (evidence-based, professional).
- Temperature and other generation parameters should be configurable.

---

## 12. Recommended Project Structure

```
swarajya-mcp/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── schemas.py
│   ├── dependencies.py
│   ├── clients/
│   │   ├── quintype.py          # All Quintype API calls
│   │   └── llm.py               # LLM abstraction
│   ├── routers/
│   │   └── ask.py
│   ├── services/
│   │   └── orchestrator.py      # Core business logic
│   └── prompts/
│       └── synthesis_system.txt
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

---

## 13. Implementation Phases (Three-Phase Plan)

Even though this is a full-scale product, we will deliver it in **three well-defined phases** to manage complexity, risk, cost, and quality.

### Phase 1: Foundation (Core Product)
**Goal**: Deliver a working, production-ready “Ask Swarajya” experience with basic security.

**Features to Include:**
- Natural language query interface (`POST /api/v1/ask`)
- Grounded LLM synthesis with proper citations
- Core orchestration using `/api/v1/advanced-search` + `/api/v1/stories/{id}`
- Respect for story-level access controls (`access` field)
- Structured, tool-friendly JSON responses (optimized for ChatGPT/Claude)
- Basic Authentication system:
  - Admin frontend to create Clients
  - Generate and manage Bearer Tokens
  - Token validation in the MCP
- Basic rate limiting + request logging
- Health check and error handling

**Success Criteria**: Users (internal + authorized external) can ask questions and receive cited, grounded answers from Swarajya content with controlled access.

---

### Phase 2: Intelligence Layer
**Goal**: Make the MCP significantly smarter by leveraging more of the Quintype API surface.

**Features to Include:**
- Entity detection and enrichment using `/api/v1/entities` and `/api/v1/entity/{id}`
- Related stories enrichment (`/api/v1/stories/{id}/related-stories`)
- Improved context curation and orchestration logic
- Enhanced system prompt for better synthesis quality
- Optional: Basic entity-aware responses

**Success Criteria**: Answers become richer and more contextually aware by intelligently using entities and related content.

---

### Phase 3: Scale, Advanced Features & Hardening
**Goal**: Make the system production-hardened, scalable, and feature-rich for broader usage.

**Features to Include:**
- Collection intelligence (use of `/api/v1/collections/{slug}` and author collections)
- Advanced Authentication features:
  - Token scopes / permissions
  - Per-client rate limits and quotas
  - Usage dashboard and analytics
- Additional endpoints (e.g., `/briefing`, research-oriented endpoints)
- Stronger monitoring, alerting, and cost control
- Token expiration and rotation support
- Production-grade logging and observability

**Success Criteria**: The MCP can safely support higher usage volumes, external partners, and more advanced use cases while remaining cost-efficient and maintainable.

---

## 14. Non-Functional Requirements

- Comprehensive error handling with meaningful messages
- Structured logging
- Health check endpoint (`/health`)
- Rate limiting on externally exposed endpoints
- Proper timeout handling for external calls (Quintype + LLM)
- Clear separation of concerns (clients, services, routers)
- Maintainable and versioned system prompts

---

## 15. Final Instructions for Implementation

- Treat `https://quintype-demo.quintype.io/swagger.json` as the definitive reference for all Quintype API behaviour, parameters, and response schemas.
- Prioritise clean architecture, configurability, and maintainability.
- Design for extensibility from day one.
- All external configuration must be environment-driven.
- Responses must be grounded and properly cited.

---

**End of Specification**