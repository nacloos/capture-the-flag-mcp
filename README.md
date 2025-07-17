# Capture the Flag MCP Demo
This project showcases LLM agents playing capture the flag through MCP tools.

## Getting started
### Installation

1. **Install Go**
   Download and install Go at https://golang.org/doc/install.
   
   Check installation with:
   ```bash
   go version
   ```

2. **Install Node.js**
   Download and install Node.js at https://nodejs.org/
   
   Check installation with:
   ```bash
   node --version
   ```

3. **Install uv**
   Install [uv](https://docs.astral.sh/uv) for Python package management:
   ```bash
   pip install uv
   ```
   
   Check installation with:
   ```bash
   uv --version
   ```

4. **Install all dependencies**
   Install all dependencies (UI and test page):
   ```bash
   npm run install:all
   ```

### Starting the UI
Start the full-stack UI application:

```bash
npm run dev
```

This will start both the React client (typically on http://localhost:5173) and the Node.js server concurrently.

## Structure

The project follows a modular structure where each game/implementation lives in its own folder:

```
src/
├── runners.json          # Configuration for all implementations
└── capture-the-flag/     # Example Go-based multiplayer CTF game
```

### Configuration format
`src/runners.json`
```json
{
  "folder-name": {
    "command": "start command",
    "port": 8080
  }
}
```

## Workflow

### Creating a new implementation
1. **Update configuration**: add entry to `src/runners.json` before starting implementation
2. **Create working folder**: create `src/{name}` directory
3. **Implement**: no need to read existing implementations when creating a new one
4. **Test implementation**: run `npm run test-page {name}`

### Modifying existing implementation
1. **Create version copy**: always copy the folder before modifications (versioning system)
2. **Update configuration**: add new copy to `src/runners.json`
3. **Make changes**: modify the copied version
4. **Test**: run `npm run test-page {new-name}`

### Game development
Preferred settings for implementing games:
* p5.js for 2D games
* Three.js for 3D games
* no html content outside game canvas unless specified otherwise
  * white bg and centered game canvas
  * instructions in game HUD
* golang server for multiplayer games 

### Python development
When using Python:
- Use `uv` for package management
- Write `pyproject.toml` with only name, version, dependencies (unless specified otherwise)
- Run scripts with `uv run <script>`
- Example: running http server with python `uv run -m http.server 8000`
