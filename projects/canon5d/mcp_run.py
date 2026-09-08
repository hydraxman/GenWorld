import asyncio, os, sys, json
from pathlib import Path
from datetime import timedelta
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
GOAL='讲解零部件时：1. 光线顺着穿过去，每到一个零部件就讲一下它是什么。2. 最好在旁边悬浮一个 tag 标签，并高亮聚焦一下，让人看清楚讲的是什么。'
async def main():
    code=Path(sys.argv[1]).read_text()
    env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG','LC_ALL','SYSTEMROOT']}
    env.update(DISABLE_TELEMETRY='true',BLENDER_MCP_SAFE_MODE='1',BLENDER_HOST='127.0.0.1',BLENDER_PORT='9876')
    params=StdioServerParameters(command='/Users/bryannathan/.hermes/tools/blender-mcp/.venv/bin/blender-mcp',args=[],env=env)
    async with stdio_client(params) as (read,write):
        async with ClientSession(read,write,read_timeout_seconds=timedelta(seconds=900)) as client:
            await client.initialize()
            result=await client.call_tool('execute_blender_code',{'code':code,'user_prompt':GOAL},read_timeout_seconds=timedelta(seconds=900))
            text='\n'.join(x.text for x in result.content if hasattr(x,'text'))
            Path(sys.argv[1]+'.receipt.json').write_text(result.model_dump_json(indent=2))
            print(text,flush=True)
            if result.isError or 'Rejected by safe mode' in text or text.startswith('Error'):raise RuntimeError('Blender MCP execution did not succeed')
asyncio.run(main())
