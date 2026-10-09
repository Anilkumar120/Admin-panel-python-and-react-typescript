import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database.connection import client

from backend.routes.products import router as product_router
from backend.routes.auth import router as auth_router
from backend.routes.users import router as users_router
from backend.routes.profile import router as profile_router
from backend.routes.dashboard import router as dashboard_router
from backend.routes.content import router as content_router
from backend.routes.settings import router as settings_router
from backend.routes.menus import router as menus_router
from backend.routes.header_footer import router as header_footer_router
from backend.routes.media import router as media_router
from backend.routes.page_builder import router as page_builder_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)


app.mount(
    "/uploads",
    StaticFiles(
        directory=os.path.join(
            BASE_DIR,
            "uploads"
        )
    ),
    name="uploads"
)


app.include_router(auth_router)

app.include_router(users_router)

app.include_router(profile_router)

app.include_router(product_router)

app.include_router(dashboard_router)

app.include_router(content_router)

app.include_router(settings_router)
app.include_router( menus_router )
app.include_router(header_footer_router)
app.include_router(media_router)

app.include_router(page_builder_router)

@app.get("/")
def home():

    try:

        client.admin.command("ping")

        return {
            "message": "Smart Inventory API is running",
            "mongodb": "Connected"
        }

    except Exception as error:

        return {
            "message": "Smart Inventory API is running",
            "mongodb": "Connection Failed",
            "error": str(error)
        }
