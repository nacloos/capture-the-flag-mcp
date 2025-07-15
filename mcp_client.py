import asyncio
import subprocess
import dotenv
from pydantic_ai import Agent
from pydantic_ai.usage import UsageLimits
from pydantic_ai.mcp import MCPServerStdio

dotenv.load_dotenv()

# Configuration for multiple players
PLAYERS_CONFIG = [
    {"name": "RedPlayer1", "team": "red"},
    {"name": "RedPlayer2", "team": "red"},
    {"name": "BluePlayer1", "team": "blue"},
    {"name": "BluePlayer2", "team": "blue"},
]

model = 'claude-sonnet-4-20250514'
# model = "gemini-2.5-flash"
request_limit = 100


def create_agent(player_config):
    server = MCPServerStdio('uv', args=['run', 'mcp_server.py'])
    agent = Agent(model, mcp_servers=[server])
    return agent, server, player_config

# Create agents for all configured players
agents_data = [create_agent(config) for config in PLAYERS_CONFIG]

prompt_template = """You are an autonomous agent named '{name}' playing capture the flag. 
You are strategic, competitive, and focused on winning for your team.
Join the {team} team with the name '{name}' and coordinate with your teammates.

Actions have delays - anticipate opponents' actions.
"""

async def run_agent(agent, server, player_config):
    """Run a single agent"""
    name = player_config["name"]
    team = player_config["team"]
    
    try:
        async with agent.run_mcp_servers():
            result = await agent.run(
                prompt_template.format(name=name, team=team), 
                usage_limits=UsageLimits(request_limit=request_limit)
            )
            print(f"Agent {name} ({team}): {result.output}")
    except Exception as e:
        print(f"Error running agent {name}: {e}")

async def main():
    print(f"Starting {len(PLAYERS_CONFIG)} agents...")
    for config in PLAYERS_CONFIG:
        print(f"  - {config['name']} on {config['team'].upper()} team")
    
    # Run all agents concurrently
    tasks = [run_agent(agent, server, config) for agent, server, config in agents_data]
    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    subprocess.run("lsof -ti:8080 | xargs -r kill", shell=True)
    server = subprocess.Popen(['go', 'run', 'main.go'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    asyncio.sleep(3)  # Wait for server to start

    asyncio.run(main())