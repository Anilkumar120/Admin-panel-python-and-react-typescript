from backend.database.connection import pages_collection

result = pages_collection.update_one(
    {"template_type": "single_product"},
    {
        "$set": {
            "is_default": True,
            "conditions.include": ["products"],
            "conditions.priority": 10,
        }
    }
)

print("Matched:", result.matched_count)
print("Modified:", result.modified_count)

# Verify
d = pages_collection.find_one({"template_type": "single_product"})
print()
print("Is Default:", d.get("is_default"))
print("Conditions:", d.get("conditions"))