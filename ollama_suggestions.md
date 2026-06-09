## 1. Executive System Topology

The XRWorkout Outreach Monitor divides operational labor between automated data gathering, deterministic schema processing, elite cognitive evaluation/drafting, and mandatory human review. By shifting processing overhead from expensive foundational commercial APIs to an orchestrated self-hosted VPS and **Ollama Cloud/Local instances**, token margins are maximized while keeping strict operational safety guardrails.


```

```text
File successfully created: xrworkout_outreach_architecture.md

```text
+---------------------------------------------------------------------------------------+
|                              ORCHESTRATION & STORAGE LAYER                             |
|                                                                                       |
|   +---------------------------------+             +-------------------------------+   |
|   |    GitHub Actions Scheduler     |             | Next.js "Outreach OS" UI      |   |
|   |  - Cron triggers (Daily/Weekly) |             | - Human-in-the-loop validation|   |
|   |  - Repository Dispatches        |             | - Draft editor & metrics      |   |
|   +----------------+----------------+             +---------------+---------------+   |
|                    |                                              |                   |
|                    | (Triggers execution)                         | (Reads/Writes)    |
|                    v                                              v                   |
|   +-------------------------------------------------------------------------------+   |
|   |                               Supabase Postgres                               |   |
|   |  - Schema Engine (raw_items, opportunities, creators, drafts, followups)      |   |
|   |  - Transaction state provider & deterministic row deduplication lock          |   |
|   +-------------------------------------------------------------------------------+   |
+-----------------------------------------------------------+---------------------------+
                                                            |
                                                            | Read/Write State Queries
                                                            v
+-----------------------------------------------------------+---------------------------+
|                                  COMPUTE & PROCESSING LAYER                           |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             Self-Hosted VPS Runner                              |  |
|  |                                                                                 |  |
|  |   +-----------------------------------+     +-------------------------------+   |  |
|  |   |        Python Engine/CLI          |     |      Ollama Local Daemon      |   |  |
|  |   |  - Input Normalizers & BS4/html   +---->|  - qwen3.5:9b (Tier 1)        |   |  |
|  |   |  - Schema parsing & validators    |     |  - High-speed parsing / token |   |  |
|  |   +-----------------+-----------------+     +-------------------------------+   |  |
|  +---------------------|-----------------------------------------------------------+  |
|                        |                                                              |
|                        | Deep-Reasoning API Requests (Low Latency / Fallbacks)        |
|                        v                                                              |
|  +---------------------+-----------------------------------------------------------+  |
|  |                                   Ollama Cloud                                  |  |
|  |                                                                                 |  |
|  |   - gpt-oss:120b-cloud (Tier 2: Rubric Evaluation & Strategy Analysis)          |  |
|  |   - gemma4:26b-cloud / minimax-m3:cloud (Tier 3: Context-Aware Email Copywriting) |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+

```

---

## 2. Asymmetrical LLM Workload Partitioning Matrix

To maintain hardware stability and eliminate processing bottlenecks, tasks are systematically assigned to distinct model tiers based on computational complexity.

### Tier 1: Ingestion, Normalization & Binary Classification

* **Target Scripts:** `scripts/classify_opportunities.py`
* **Execution Framework:** Local Ollama Daemon (`localhost:11434`)
* **Model Class:** `qwen3.5:9b` or `gemma4:12b` (`Q6_K` or `Q5_K_M` quantization)
* **Objective:** Ingest chaotic, high-volume Markdown, JSON arrays, and RSS text blocks scraped from platforms (Reddit, YouTube, Twitch, Apify, Forums, Blogs). Clean whitespace, strip programmatic noise, and output strict, minified JSON matching the target database schema structure.
* **Core Criteria:** Rapid Time-To-First-Token (TTFT), excellent tool-calling compliance, low latency.

### Tier 2: Analytical Persona Matching & Candidate Rubric Evaluation

* **Target Scripts:** `scripts/discover_creators.py`
* **Execution Framework:** Ollama Cloud (Hosted Engine)
* **Model Class:** `gpt-oss:120b-cloud`
* **Objective:** Parse historical evidence from opportunities to calculate a multidimensional creator quality score. The model systematically scores attributes across seven specific vectors: Creator Quality, Content Recency, Definite VR/Headset Proof, Activity Frequency, Contactability Metrics, Safety Guardrails, and Review Urgency.
* **Core Criteria:** Advanced conditional deduction, multi-variable tracking, deep contextual logic.

### Tier 3: High-Nuance, Personalized Copywriting & Strategy Selection

* **Target Scripts:** `scripts/generate_drafts.py`, `scripts/generate_draft_for_opportunity.py`
* **Execution Framework:** Ollama Cloud (Hosted Engine)
* **Model Class:** `gemma4:26b-cloud` or `minimax-m3:cloud`
* **Objective:** Translate the specific strategic angle decided during Tier 2 evaluation (e.g., matching a creator's public alternative-seeking context for *FitXR* or *Supernatural*) into an authentic, highly persuasive, customized outreach template.
* **Core Criteria:** Empathetic stylistic alignment, complex negative prompting (to avoid AI boilerplate indicators like "In today's digital landscape," "delve," "testament"), and strict compliance with brand guidelines.

---

## 3. The Immutable Data State Machine

To enforce the fundamental operating principal (**"Agents propose, Humans approve, Code fires"**), state transitions within Supabase must act as unidirectional architectural locks. A row can never advance past a gateway state without passing explicit automated criteria or human cryptographic approval.

```text
  [RAW DISCOVERY]
         |
         v
+-----------------------+      ON CONFLICT DO NOTHING      +-----------------------+
|  Platform Collectors  +--------------------------------->|  raw_items Table      |
|  (Reddit, YT, Apify)  |      (Source URL Unique Hash)    |  - status: raw        |
+-----------------------+                                  +-----------+-----------+
                                                                       |
                                                                       | classify_opportunities.py
                                                                       v
                                                           +-----------------------+
                                                           | opportunities Table   |
                                                           | - status: unassigned  |
                                                           +-----------+-----------+
                                                                       |
                                                                       | discover_creators.py
                                                                       v
                                                           +-----------------------+
                                                           | creators Table        |
                                                           | - score: Calculated   |
                                                           +-----------+-----------+
                                                                       |
                                                                       | generate_drafts.py
                                                                       v
                                                           +-----------------------+
                                                           | drafts Table          |
                                                           | - status: needs_review|
                                                           +-----------+-----------+
                                                                       |
                                               +-----------------------+-----------------------+
                                               |                                               |
                                               | Operator Action: Reject                       | Operator Action: Approve
                                               v                                               v
                                   +-----------------------+                       +-----------------------+
                                   | drafts Table          |                       | drafts Table          |
                                   | - status: rejected    |                       | - status: approved    |
                                   +-----------------------+                       +-----------+-----------+
                                                                                               |
                                                                                               | send_approved.py
                                                                                               v
                                                                                   +-----------------------+
                                                                                   | Brevo Outbound Mailer |
                                                                                   | - status: sent        |
                                                                                   +-----------------------+

```

### Deterministic State Transition Logic

1. **Deduplication Engine:** All platform ingest components parse source entries and calculate an immutable hash: `SHA-256(platform_source_identifier + published_timestamp + creator_handle)`. This field is protected via a unique constraint in Postgres. Duplicate collection instances are completely dropped via `ON CONFLICT DO NOTHING`.
2. **Strict Sending Query Guardrail:** The actual delivery daemon running `scripts/send_approved.py` uses a hard-locked transactional loop that isolates records from the rest of the ecosystem. It selects only rows explicitly tagged with `status = 'approved'` where `email_sent_at IS NULL`.
3. **Optimistic Locking:** On picking up an approved draft, the delivery process immediately sets `status = 'sending'` inside a database transaction block before triggering the remote Brevo API payload. This completely mitigates double-delivery vulnerabilities caused by process overlap or webhook timeouts.

---

## 4. Production Host Configuration & Optimization

Running this hybrid configuration on a self-hosted VPS requires tweaking the default Ollama settings to ensure consistent uptime and reliable processing pipelines.

### Daemon Service Parameters (`/etc/systemd/system/ollama.service.d/override.conf`)

To handle intense local processing queues without crashing or dropping foundational layers between scheduling windows, apply the following environment variables:

```ini
[Service]
# Ensure the local engine can execute parallel parsing threads
Environment="OLLAMA_NUM_PARALLEL=4"

# Limit the maximum number of concurrent internal memory-mapped models to minimize memory footprints
Environment="OLLAMA_MAX_LOADED_MODELS=1"

# Retain the processing layers hot in memory for 45 minutes after a collector task closes
Environment="OLLAMA_KEEP_ALIVE=45m"

# Restrict the default API binding strictly to local loopback interface for complete security hardening
Environment="OLLAMA_HOST=127.0.0.1:11434"

```

### Input Token & Context Pre-Processing Guardrails

Raw forum scrapes and social data contain significant noise (HTML boilerplate, structural CSS, tracking parameters). Passing this uncurated content directly to an LLM wastes context window space and increases costs.

* **Text Hardening Step:** Every collection pipeline must funnel structural raw metrics through `BeautifulSoup(text, "html.parser")` and `html2text` transformations before packaging the payload for Codex CLI.
* **Strict Context Window Clipping:** Enforce a strict input token cap of **8,192 tokens** for Tier 1 parsing engines. This limits memory usage on the self-hosted VPS runner and keeps the processing queue running smoothly.

---

## 5. Next.js Human-In-The-Loop Execution Matrix

The internal Next.js dashboard ("Outreach OS") operates completely decoupled from the physical server constraints of the runner. It acts as an asynchronous state monitor and event dispatcher.

```text
+-----------------------+       Click "Generate Draft"       +-----------------------+
|  Next.js OS UI        +----------------------------------->|  Supabase Postgres    |
|  - Operator View      |                                    |  - Update state       |
+-----------------------+                                    +-----------+-----------+
                                                                         |
                                                                         | Fires Webhook / Web Socket Event
                                                                         v
+-----------------------+       Triggers Python Worker       +-----------------------+
|  GitHub Actions Engine|<-----------------------------------+  GitHub API Gateway   |
|  - runs-on: self-hosted|       via repository_dispatch      |  - Fine-Grained Token |
+-----------+-----------+                                    +-----------------------+
            |
            v Runs local pipeline stage
+-----------------------+
|  Self-Hosted Server   |
|  - Executes Ollama    |
+-----------------------+

```

### Operational Framework Operations

* **Decoupled Job Dispatching:** When an operator reviews an option in the UI and clicks `Generate LLM draft`, the dashboard does **not** launch an inline API call to the model. Instead, it securely triggers a `repository_dispatch` event against the GitHub Actions API using a restricted token (`DASHBOARD_GITHUB_TOKEN`).
* **Background Worker Processing:** GitHub Actions catches the incoming webhook, identifies the requested job payload, and spins up a targeted workflow on the self-hosted runner. The runner executes `scripts/generate_draft_for_opportunity.py --id <TARGET_ID>`, interacts with the model layer, saves the output straight back to Supabase as a `needs_review` draft, and cleanly terminates.
* **Real-time Live Logging UI:** The Next.js dashboard monitors this processing lifecycle via the `Run Monitor` view by querying the active GitHub Actions workflow state. This approach provides clear progress updates and detailed step failures without exposing internal server infrastructure to public networks.
"""

# Define file path

output_filename = "xrworkout_outreach_architecture.md"

# Write out the file content

with open(output_filename, "w", encoding="utf-8") as file:
file.write(markdown_content)

print(f"File successfully created: {output_filename}")

```
Your comprehensive Markdown architectural blueprint documentation file is ready.

[file-tag: code-generated-file-0-1780984522778954770]

### Architectural Summary of the Generated Blueprints

The generated documentation file (`xrworkout_outreach_architecture.md`) acts as an engineering runbook that details exactly how to shift your XRWorkout infrastructure off of premium commercial endpoints into a hybrid **Ollama (Local) + Hosted Ollama Cloud** architecture. 

It explicitly addresses the engineering choices needed for your production rollout:
1. **The Asymmetrical Processing Matrix:** Keeps high-volume, structural HTML/Markdown data stripping local via a highly optimized small model (`qwen3.5:9b`), while offloading complex candidate rubric evaluation (`gpt-oss:120b-cloud`) and contextual outreach copywriting to datacenter-grade hosted endpoints.
2. **Deterministic Data Guardrails:** Outlines structural state locking within Supabase utilizing unique SHA-256 hashes generated from the platform sources to guarantee an `ON CONFLICT DO NOTHING` constraint—eliminating identical duplicate processing pipelines at ingestion.
3. **Optimistic Sender Protection:** Implements an atomic state progression lock inside `scripts/send_approved.py` where selected records immediately advance to a `sending` state prior to hitting the external Brevo API payload, avoiding duplicate email execution frames.
4. **Daemon Systemd Fine-Tuning:** Provides precise host environment overrides (`OLLAMA_NUM_PARALLEL`, `OLLAMA_MAX_LOADED_MODELS`, and `OLLAMA_KEEP_ALIVE`) to manage physical RAM/VRAM constraints safely on your self-hosted server runner.
5. **Decoupled HITL Trigger Mapping:** Configures an event-driven webhook relationship between your Next.js dashboard interactions and GitHub Actions' `repository_dispatch` engine, meaning manual model updates never block web-facing presentation interfaces.

```