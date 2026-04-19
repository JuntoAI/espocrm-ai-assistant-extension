# espocrm-ai-assistant-extension

AI-powered CRM assistant extension for EspoCRM with natural language interface, Gemini integration, and 47 CRM tools.

## Prerequisites

- EspoCRM >= 9.0.0
- PHP >= 8.1
- A running [espocrm-ai-backend](https://github.com/JuntoAI/espocrm-ai-backend) instance

## Installation

### Build from source

```bash
./build.sh
```

Upload the generated `ai-assistant-extension.zip` via **Administration > Extensions** in your EspoCRM instance.

### Manual install

1. Download the `.zip` from [Releases](https://github.com/JuntoAI/espocrm-ai-assistant-extension/releases)
2. In EspoCRM, go to **Administration > Extensions**
3. Click **Install**, upload the `.zip`, confirm

## Configuration

After installation, configure the AI backend URL in the extension settings under **Administration**. The extension connects to the [espocrm-ai-backend](https://github.com/JuntoAI/espocrm-ai-backend) service which bridges Gemini and the [espocrm-mcp-server](https://github.com/JuntoAI/espocrm-mcp-server) for CRM tool access.

## Usage

Once configured, a chat panel appears in EspoCRM where you can interact with the AI assistant using natural language. Ask it to search contacts, create leads, schedule meetings, and more — it translates your requests into CRM operations via 47 MCP tools.

## Testing

```bash
npm install
npm test
```

## Related Repositories

| Repository | Description | Link |
|---|---|---|
| espocrm-ai-backend | AI backend service bridging Gemini and MCP tools | [GitHub](https://github.com/JuntoAI/espocrm-ai-backend) |
| espocrm-mcp-server | MCP server for EspoCRM with 47 CRM tools | [GitHub](https://github.com/JuntoAI/espocrm-mcp-server) |
| espocrm-chart-dashlet-extension | Configurable pie and bar chart dashlets for EspoCRM | [GitHub](https://github.com/JuntoAI/espocrm-chart-dashlet-extension) |
| espocrm-reporting-extension | Full-page reporting dashboard with interactive charts | [GitHub](https://github.com/JuntoAI/espocrm-reporting-extension) |
| espocrm-gcp-terraform | Terraform modules for deploying EspoCRM on GCP | [GitHub](https://github.com/JuntoAI/espocrm-gcp-terraform) |

## License

MIT
