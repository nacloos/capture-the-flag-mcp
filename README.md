# Capture the Flag MCP Demo
This project showcases LLM agents playing capture the flag through MCP tools.

## Installation
The game server is implement in Go. Download and install go at https://golang.org/doc/install.

Install [uv](https://docs.astral.sh/uv) for Python package management:
```bash
pip install uv
```

Install go dependencies:
```bash
go mod tidy
```

## Structure

- `main.go`: Game server handling WebSocket connections and game logic
- `static/index.html`: Web client 
- `mcp_server.py`: MCP server providing tools to play the game
- `mcp_client.py`: MCP client to play the game with LLMs

## Usage
### Play the game yourself
Run the game server:
```
go run main.go
```
Open http://localhost:8080 in a browser to play the game.

### LLM agents playing the game
This requires a LLM API key. 
Copy `.env.example` to `.env` and add your API key.

Run the MCP client script to start the game server and the agents:
```
uv run mcp_client.py
```

You can join the game at http://localhost:8080.


## Setting up Claude Code
Run the following command to install Claude Code:
```bash
npm install -g @anthropic-ai/claude-code
```
If you get a `npm: command not found` error, you need to install nodejs: https://nodejs.org/en/download.

See https://docs.anthropic.com/en/docs/claude-code/setup for more information.

Start Claude Code with the `claude` command in a terminal.

By default Claude Code always asks permissions before executing an action, start Claude Code with the following command to disable that:
```
claude --dangerously-skip-permissions
```

To run Claude Code with an API key:
1. Login to your personal account (prompted when running `claude` for the first time).
2. Run Claude Code in a folder with ANTHROPIC_API_KEY set as environment variable (for example, with a `.env` file at the root of the folder where claude code is run). Claude Code should automatically detect the API key and ask whether to use it or not.

