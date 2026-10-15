export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
}

const CART_STORAGE_KEY = "store_cart";

export const readCart = (): CartItem[] => {
  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) return [];
    const cart: unknown = JSON.parse(rawCart);
    if (!Array.isArray(cart)) {
      throw new Error("Saved cart data is invalid.");
    }
    return cart as CartItem[];
  } catch (error) {
    console.error("Unable to read the saved cart:", error);
    throw error;
  }
};

const writeCart = (cart: CartItem[]) => {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("store-cart-updated", { detail: cart }));
};

export const addToCart = (item: Omit<CartItem, "quantity">, quantity = 1) => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Cart quantity must be a positive whole number.");
  }
  const cart = readCart();
  const existing = cart.find((cartItem) => cartItem.product_id === item.product_id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity });
  }
  writeCart(cart);
};

export const updateCartQuantity = (productId: string, quantity: number) => {
  const cart = readCart()
    .map((item) =>
      item.product_id === productId ? { ...item, quantity } : item,
    )
    .filter((item) => item.quantity > 0);
  writeCart(cart);
};

export const clearCart = () => writeCart([]);
