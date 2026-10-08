from pydantic import BaseModel, Field
from typing import Optional


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    quantity: int = Field(ge=0)
    category: str
    brand: Optional[str] = None