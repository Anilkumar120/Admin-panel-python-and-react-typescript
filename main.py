def update_product(products):
    try:
        product_id = int(input("Enter Product Id: "))
    except ValueError:
        print("Invalid Product Id")
        return

    found = False

    for product in products:
        if product["id"] == product_id:
            found = True

            print("Name:", product["name"])
            print("Price:", product["price"])
            print("Quantity:", product["quantity"])
            print("Category:", product["category"])

            name = input("Enter new name: ")
            if name == "":
                name = product["name"]

            try:
                price_input = input("Enter new Price: ")
                if price_input == "":
                    price = product["price"]
                else:
                    price = float(price_input)
                    if price < 0:
                        print("Price cannot be negative")
                        return
            except ValueError:
                print("Invalid Price")
                return

            try:
                quantity_input = input("Enter new quantity: ")
                if quantity_input == "":
                    quantity = product["quantity"]
                else:
                    quantity = int(quantity_input)
                    if quantity < 0:
                        print("Quantity cannot be negative")
                        return
            except ValueError:
                print("Invalid quantity")
                return

            category = input("Enter new Category: ")
            if category == "":
                category = product["category"]

            product["name"] = name
            product["price"] = price
            product["quantity"] = quantity
            product["category"] = category

            print("Product updated successfully")
            return

    if not found:
        print("Product not found")


products = [
    {
        "id": 1,
        "name": "Laptop",
        "price": 1200,
        "quantity": 5,
        "category": "Electronics"
    },
    {
        "id": 2,
        "name": "Mouse",
        "price": 25,
        "quantity": 10,
        "category": "Accessories"
    }
]

update_product(products)