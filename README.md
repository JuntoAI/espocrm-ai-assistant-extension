# espocrm-ai-assistant-extension

AI-powered CRM assistant extension for EspoCRM with natural language interface, Gemini integration, and access to 47 CRM tools via MCP.

Built by [JuntoAI](https://juntoai.org) — the next generation business network.

## Prerequisites

- EspoCRM >= 9.0.0
- PHP >= 8.1

### Required dependencies

This extension **requires** the following services to be running:

1. **[espocrm-ai-backend](https://github.com/JuntoAI/espocrm-ai-backend)** — the AI service that processes natural language requests
2. **[espocrm-mcp-server](https://github.com/JuntoAI/espocrm-mcp-server)** — the MCP server that provides 47 CRM tools (used by the AI backend)

**Deployment order:** MCP Server → AI Backend → AI Assistant Extension

## Installation

### Build from source

```bash
git clone https://github.com/JuntoAI/espocrm-ai-assistant-extension.git
cd espocrm-ai-assistant-extension
./build.sh
```

Upload the generated `ai-assistant-extension.zip` via **Administration > Extensions** in your EspoCRM instance.

### Manual install

1. Download the `.zip` from [Releases](https://github.com/JuntoAI/espocrm-ai-assistant-extension/releases)
2. In EspoCRM, go to **Administration > Extensions**
3. Click **Install**, upload the `.zip`, confirm

## Configuration

After installation, configure the AI backend URL in the extension settings under **Administration**. Point it to your running [espocrm-ai-backend](https://github.com/JuntoAI/espocrm-ai-backend) instance.

## Usage

Once configured, a chat panel appears in EspoCRM where you can interact with the AI assistant using natural language:

- "Find all contacts at Acme Corp"
- "Create a high-priority task to follow up on the proposal"
- "Schedule a call with Sarah for tomorrow at 2pm"
- "Show deals over $50k in Qualification stage"

The assistant translates your requests into CRM operations via 47 MCP tools.

## Testing

```bash
npm install
npm test
```

## Related Repositories

This extension is part of the [JuntoAI EspoCRM ecosystem](https://github.com/JuntoAI/espocrm-workspace).

| Repository | Description | Dependency |
|---|---|---|
| [espocrm-ai-backend](https://github.com/JuntoAI/espocrm-ai-backend) | AI backend service bridging Gemini and MCP tools | **Required** — this extension calls the backend |
| [espocrm-mcp-server](https://github.com/JuntoAI/espocrm-mcp-server) | MCP server with 47 CRM tools | **Required** — used by the AI backend |
| [espocrm-chart-dashlet-extension](https://github.com/JuntoAI/espocrm-chart-dashlet-extension) | Pie and bar chart dashlets for the home dashboard | Independent |
| [espocrm-reporting-extension](https://github.com/JuntoAI/espocrm-reporting-extension) | Full-page reporting dashboard with interactive charts | Independent |
| [espocrm-gcp-terraform](https://github.com/JuntoAI/espocrm-gcp-terraform) | Terraform modules for deploying EspoCRM on GCP | Independent |

## About JuntoAI

[JuntoAI](https://juntoai.org) is the next generation business network. We use EspoCRM as our CRM and share our extensions with the community as open source.

Join the waitlist at [juntoai.org](https://juntoai.org). Found a bug? [Open an issue](https://github.com/JuntoAI/espocrm-ai-assistant-extension/issues) or reach out at [juntoai.org](https://juntoai.org).

## License

MIT
