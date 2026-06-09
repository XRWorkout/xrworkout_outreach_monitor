# GIT_PROTOCOL.md

## 1. Objective

To maintain a high-integrity, traceable, and secure codebase. All interactions with the remote repository must adhere to this workflow to ensure CI/CD compatibility and team-wide readability.

## 2. The Agentic Push Workflow

Before performing any `git push`, the Agent **must** execute the following checklist sequentially:

1. **Sync State:** Execute `git pull --rebase origin <current_branch>` to ensure local history is aligned with the remote.
2. **Verification Gate:** Run the local test suite and linter. If tests fail, the workflow **halts**.
3. **Security Scan:** Scan for hardcoded credentials, sensitive tokens, or exposed API keys.
4. **Atomic Staging:** Stage only the files relevant to the specific logical change.
5. **Commit:** Draft a commit message following the *Conventional Commits* standard.
6. **Push:** Push to the origin branch.

---

## 3. Commit Message Convention

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This allows automated tools to parse your history and generate changelogs.

**Format:** `<type>(<scope>): <short summary>`

* **Types:**
* `feat`: A new feature (Database schema changes, new logic).
* `fix`: A bug fix.
* `docs`: Documentation changes.
* `style`: Formatting, missing semi-colons, etc. (no production code change).
* `refactor`: Code change that neither fixes a bug nor adds a feature.
* `test`: Adding missing tests or correcting existing tests.
* `chore`: Maintenance tasks (Dependency updates, project config).
* `sec`: Security hardening or vulnerability patches.



**Examples:**

* `feat(auth): add JWT validation logic`
* `sec(db): encrypt connection string in config`
* `fix(query): correct syntax in user_data join`

---

## 4. Security & Quality Checklist (Agent Guidelines)

**Prior to every push, Codex must verify:**

* **No Sensitive Data:** Ensure no `.env` files, `.pem` keys, or database credentials (DB_PASSWORD, API_KEY) are in the `git add` buffer.
* **Atomic Logic:** One commit = one logical change. Do not bundle a UI update with a database schema migration.
* **Branch Integrity:** Ensure you are not pushing directly to `main` or `production` branches if a PR process is required. Always prefer `feature/` or `fix/` naming conventions.

---

## 5. Automated Pre-Push Script (Bash)

*Codex, use this script to validate the state before executing the push command:*

```bash
#!/bin/bash
# Pre-push validation script
echo "Running pre-push checks..."

# 1. Run Tests
npm test || { echo "Tests failed. Aborting push."; exit 1; }

# 2. Run Linting
npm run lint || { echo "Linting failed. Aborting push."; exit 1; }

# 3. Secret Scanning (Example using trufflehog or similar)
# trufflehog filesystem . --exclude-paths .gitignore || { echo "Security breach detected."; exit 1; }

echo "Checks passed. Ready for commit."

```
## 6. Automated README Maintenance Protocol

The Agent **must** update the `README.md` dynamically whenever changes affect the project's setup, architecture, dependencies, or environment configuration.

### 6.1 Trigger Conditions for README Updates

Codex must evaluate and modify the `README.md` if a commit contains:

* **Dependency changes:** Additions or updates in files like `pom.xml`, `package.json`, or requirements files.
* **Environment changes:** New variables added to `.env.example` configurations.
* **Architectural changes:** New modules, core database schema updates, or security layers.
* **API/Gateway updates:** Modifying endpoints, network routing logic, or data-flow protocols.

### 6.2 Standardized README Schema

When generating or maintaining the `README.md`, Codex must strictly adhere to this layout:

```markdown
# Project Name

> Short, impactful one-sentence description of the project's core purpose.

---

## 🚀 Core Features
*   **Feature 1:** Brief technical explanation.
*   **Feature 2:** Brief technical explanation.

## 🛠️ Architecture & Tech Stack
*   **Core Languages:** [e.g., Java, SQL, Bash]
*   **Frameworks/Tools:** [List key components]
*   **Security/Integrity Layer:** [Explain data validation/security design]

## ⚙️ Getting Started

### Prerequisites
*   [List software requirements, versions, and dependencies]

### Installation & Local Setup
1. Clone the repository:
   \`\`\`bash
   git clone <repo_url>
   \`\`\`
2. Configure environment variables (Copy `.env.example` to `.env` and fill in local values—**Never commit real credentials**).
3. Install dependencies and build:
   \`\`\`bash
   # Insert exact build commands here
   \`\`\`

## 🧪 Running Tests & Validation
\`\`\`bash
# Insert testing instructions/scripts
\`\`\`

```

### 6.3 AI Guardrails for Documentation

* **No Placeholders:** Never output `TODO`, `Fixme`, or generic instructions. Codex must derive the exact setup steps from the codebase context.
* **Clean Formatting:** Use clean Markdown lists and explicit code-block syntax highlighting (e.g., `bash`, `sql, ````java).
* **Security Isolation:** Absolute prohibition against adding production keys, real server IPs, or sensitive system details to the public documentation.

---
