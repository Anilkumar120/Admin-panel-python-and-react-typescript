import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database.connection import client

from backend.routes.products import router as product_router
from backend.routes.product_taxonomies import router as product_taxonomies_router
from backend.routes.orders import router as orders_router
from backend.routes.auth import router as auth_router
from backend.routes.users import router as users_router
from backend.routes.profile import router as profile_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.content import router as content_router
from backend.routes.settings import router as settings_router
from backend.routes.menus import router as menus_router
from backend.routes.media import router as media_router
from backend.routes.page_builder import router as page_builder_router
from backend.routes.public import router as public_router
from backend.routes.forms import router as forms_router
from backend.routes import header_footer
from backend.routes.addresses import router as addresses_router

app = FastAPI()

MAX_REQUEST_SIZE = 25 * 1024 * 1024


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)


@app.middleware("http")
async def check_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")

    if content_length:
        try:
            request_size = int(content_length)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length header"},
            )

        if request_size > MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": "Request too large. Maximum allowed size is 25 MB."
                },
            )

    return await call_next(request)


app.mount(
    "/uploads",
    StaticFiles(directory=UPLOADS_DIR),
    name="uploads",
)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(profile_router)
app.include_router(product_router)
app.include_router(product_taxonomies_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(content_router)
app.include_router(settings_router)
app.include_router(menus_router)
app.include_router(media_router)
app.include_router(page_builder_router)
app.include_router(public_router)
app.include_router(forms_router)
app.include_router(header_footer.router)
app.include_router(addresses_router) 


@app.get("/")
def home():
    try:
        client.admin.command("ping")

        return {
            "message": "Smart Inventory API is running",
            "mongodb": "Connected",
        }

    except Exception as error:
        return {
            "message": "Smart Inventory API is running",
            "mongodb": "Connection Failed",
            "error": str(error),
        }