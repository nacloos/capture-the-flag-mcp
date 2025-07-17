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

