"""Test-only ASGI app: deku_server with the agent replaced by one that streams a
partial answer then hangs — lets tests exercise the client-disconnect path
against a real uvicorn server (TestClient can't cancel mid-stream)."""
import asyncio

from deku_server import main


async def fake_run_agent(*_args, **_kwargs):
    yield {"type": "delta", "text": "partial answer"}
    await asyncio.sleep(60)


main.run_agent = fake_run_agent
app = main.app
