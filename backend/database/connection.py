import os

from pymongo import MongoClient

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

DATABASE_NAME = os.getenv("DATABASE_NAME")

client = MongoClient(MONGODB_URI)

db = client[DATABASE_NAME]

products_collection = db["products"]
product_taxonomies_collection = db["product_taxonomies"]
orders_collection = db["orders"]

users_collection = db["users"]

content_collection = db["content"]

post_types_collection = db["post_types"]

settings_collection = db["settings"]

taxonomies_collection = db["taxonomies"]

menus_collection = db["menus"]


media_collection = db["media"]
pages_collection = db["pages"]
global_styles_collection = db["global_styles"]
form_submissions_collection = db["form_submissions"]