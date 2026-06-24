import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.configs.settings import settings
from app.fast_mcp import fast_mcp, write_tools_to_redis
from app.routers import health_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("http")

class _HealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/health" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(_HealthFilter())

_mcp_app = fast_mcp.http_app(path="/")

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with _mcp_app.lifespan(app):
        await write_tools_to_redis()
        yield

app = FastAPI(title="Architect MCP Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path == "/api/health":
        return await call_next(request)
    start = time.time()
    if request.method == "POST":
        body = await request.body()
        logger.info("MCP %s %s", request.method, body.decode())
    response = await call_next(request)
    ms = int((time.time() - start) * 1000)
    logger.info("%s %s %s %dms", request.method, request.url.path, response.status_code, ms)
    return response


app.include_router(health_router.router, prefix="/api")
app.mount("/mcp", _mcp_app)
