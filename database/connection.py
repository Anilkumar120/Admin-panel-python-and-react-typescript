import os

from pymongo import MongoClient

from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

DATABASE_NAME = os.getenv("DATABASE_NAME")

client = MongoClient(MONGO_URL)

db = client[DATABASE_NAME]

products_collection = db["products"]

users_collection = db["users"]

content_collection = db["content"]

post_types_collection = db["post_types"]

settings_collection = db["settings"]

taxonomies_collection = db["taxonomies"]

menus_collection = db["menus"]

header_footer_collection = db["header_footer"]

media_collection = db["media"]