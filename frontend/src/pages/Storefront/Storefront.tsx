import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_URL } from "../../api/config";
import {
  addToCart,
  clearCart,
  readCart,
  updateCartQuantity,
  type CartItem,
} from "../../api/cart";
import { getImageUrl } from "../../api/products";
import type { ProductData } from "../../components/ContentRenderer/BuilderRenderer";
import BuilderRenderer from "../../components/ContentRenderer/BuilderRenderer";
import { fetchActiveTemplate, type TemplateType } from "../../api/templates";
import type { WidgetSettings } from "../../types/pageBuilder";
import { useAuth } from "../../context/AuthContext";
import { getProfile, updateProfile, changePassword, uploadProfileImage } from "../../api/profile";

export type StorefrontPage =
  | "shop"
  | "cart"
  | "checkout"
  | "received"
  | "account";

interface OrderReceipt {
  order_number: string;
  total: number;
  payment_status?: string;
  created_at?: string;
  items?: {
    name: string;
    quantity: number;
    unit_price: number;
  }[];
  shipping_address?: string;
  billing_address?: string;
}

interface OrderLookupResult extends OrderReceipt {
  status: string;
  payment_status: string;
  items: { name: string; quantity: number; unit_price: number }[];
}

interface PublicBankUpiSettings {
  upi_enabled?: boolean;
  upi_id?: string;
  upi_account_name?: string;
  bank_transfer_enabled?: boolean;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  payment_instructions?: string;
}

interface PublicPaymentSettings {
  enabled?: boolean;
  bank_upi?: PublicBankUpiSettings;
  upi_enabled?: boolean;
  upi_id?: string;
  upi_account_name?: string;
  bank_transfer_enabled?: boolean;
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  payment_instructions?: string;
}

interface CheckoutResponse extends OrderReceipt {
  id: string;
  razorpay?: {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
  };
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: string,
    callback: (response: { error?: { description?: string } }) => void,
  ) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (result: RazorpayResult) => void;
  modal: { ondismiss: () => void };
}

interface SavedAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  country?: string;
  state?: string;
  city?: string;
  postcode?: string;
  address_1?: string;
  address_2?: string;
  phone?: string;
  email?: string;
}

const money = (amount: number) => `₹${Number(amount || 0).toFixed(2)}`;

const loadRazorpay = async (): Promise<
  new (options: RazorpayOptions) => RazorpayInstance
> => {
  const existing = (
    window as Window & {
      Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
  ).Razorpay;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay checkout could not be loaded."));
    document.body.appendChild(script);
  });

  const Razorpay = (
    window as Window & {
      Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
  ).Razorpay;
  if (!Razorpay) throw new Error("Razorpay checkout is unavailable.");
  return Razorpay;
};

const templateTypes: Partial<Record<StorefrontPage, TemplateType>> = {
  shop: "shop",
  cart: "cart",
  checkout: "checkout",
  account: "my_account",
  received: "order_received",
};

interface StorefrontProps {
  page: StorefrontPage;
  embedded?: boolean;
  settings?: WidgetSettings;
  previewMode?: boolean;
}

type AccountTab =
  | "dashboard"
  | "orders"
  | "downloads"
  | "addresses"
  | "account_details";

const Storefront = ({
  page,
  embedded = false,
  settings = {},
  previewMode = false,
}: StorefrontProps) => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loadError, setLoadError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [pageNumber, setPageNumber] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash_on_delivery" | "bank_transfer" | "razorpay"
  >("cash_on_delivery");
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [publicBankUpiSettings, setPublicBankUpiSettings] =
    useState<PublicBankUpiSettings>({});
  const [publicPaymentSettingsLoaded, setPublicPaymentSettingsLoaded] =
    useState(false);
  const [hasPublicBankUpiConfig, setHasPublicBankUpiConfig] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<{
    path: string;
    type: TemplateType;
    template: NonNullable<Awaited<ReturnType<typeof fetchActiveTemplate>>>;
  } | null>(null);
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<OrderLookupResult | null>(
    null,
  );
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [cartError, setCartError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [showAccountCurrentPassword, setShowAccountCurrentPassword] = useState(false);
  const [showAccountNewPassword, setShowAccountNewPassword] = useState(false);
  const [showAccountConfirmPassword, setShowAccountConfirmPassword] = useState(false);
  const [accountProfileImage, setAccountProfileImage] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");

  // 🆕 My Account active tab
  const [activeAccountTab, setActiveAccountTab] =
    useState<AccountTab>("dashboard");

  // 🆕 Address identity + status
  const [addressEmail, setAddressEmail] = useState("");
  const [addressSaveMessage, setAddressSaveMessage] = useState("");
  const [addressLoadError, setAddressLoadError] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  // 🆕 Billing address fields
  const [billingFirstName, setBillingFirstName] = useState("");
  const [billingLastName, setBillingLastName] = useState("");
  const [billingCompany, setBillingCompany] = useState("");
  const [billingCountry, setBillingCountry] = useState("India");
  const [billingState, setBillingState] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingPostcode, setBillingPostcode] = useState("");
  const [billingAddress1, setBillingAddress1] = useState("");
  const [billingAddress2, setBillingAddress2] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  // 🆕 Shipping address fields
  const [shippingFirstName, setShippingFirstName] = useState("");
  const [shippingLastName, setShippingLastName] = useState("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [shippingCountry, setShippingCountry] = useState("India");
  const [shippingState, setShippingState] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingEmail, setShippingEmail] = useState("");

  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const receipt = location.state as OrderReceipt | null;

  // ============ 🔧 SETTINGS DEFAULTS ============
  // Cart
  const cartLayout = settings.cartLayout || "default";
  const showCartHeading = settings.showCartHeading !== false;
  const cartHeadingText = settings.cartHeading || "Your Cart";
  const showCartItems = settings.showCartItems !== false;
  const showCoupon = settings.showCoupon !== false;
  const showCartTotal = settings.showCartTotal !== false;
  const showContinueShopping = settings.showContinueShopping !== false;
  const continueShoppingText =
    settings.continueShoppingText || "Continue Shopping";
  const showUpdateCartButton = settings.showUpdateCartButton !== false;
  const showCheckoutButton = settings.showCheckoutButton !== false;
  const checkoutButtonText =
    settings.checkoutButtonText || "Proceed to Checkout";
  const emptyCartMessage =
    settings.emptyCartMessage || "Your cart is currently empty.";
  const showCrossSells = settings.showCrossSells === true;
  const crossSellsHeading = settings.crossSellsHeading || "You may also like";

  // Checkout
  const checkoutLayout = settings.checkoutLayout || "two-column";
  const orderSummaryPosition = settings.orderSummaryPosition || "right";
  const showBillingForm = settings.showBillingForm !== false;
  const showShippingForm = settings.showShippingForm === true;
  const showOrderNotes = settings.showOrderNotes !== false;
  const orderNotesPlaceholder =
    settings.orderNotesPlaceholder ||
    "Notes about your order, e.g. special notes for delivery.";
  const showTerms = settings.showTerms !== false;
  const termsText =
    settings.termsText ||
    "I have read and agree to the website terms and conditions";
  const termsLink = settings.termsLink || "";
  const showReturnToCart = settings.showReturnToCart !== false;
  const returnToCartText = settings.returnToCartText || "← Return to cart";
  const placeOrderText = settings.placeOrderText || "Place Order";
  const showCod = settings.showCod !== false;
  const showBankTransfer = settings.showBankTransfer !== false;
  const showRazorpayOpt = settings.showRazorpay === true;
  const cashOnDeliveryLabel =
    settings.cashOnDeliveryLabel || "Cash on delivery";
  const bankTransferLabel =
    settings.bankTransferLabel || "Offline bank transfer";
  const bankTransferInstructions =
    settings.bankTransferInstructions ||
    "Payment instructions will need to be configured by the store administrator. Your order will remain pending until payment is confirmed.";
  const razorpayLabel =
    settings.razorpayLabel || "Pay online (Razorpay)";

  // My Account
  const accountLayout = settings.accountLayout || "sidebar";
  const accountNavPosition = settings.accountNavPosition || "left";
  const showAccountNav = settings.showAccountNav !== false;
  const showDashboardLink = settings.showDashboardLink !== false;
  const showOrdersLink = settings.showOrdersLink !== false;
  const showDownloadsLink = settings.showDownloadsLink !== false;
  const showAddressesLink = settings.showAddressesLink !== false;
  const showAccountDetailsLink =
    settings.showAccountDetailsLink !== false;
  const showLogoutLink = settings.showLogoutLink !== false;
  const logoutText = settings.logoutText || "Log out";
  const showWelcomeMessage = settings.showWelcomeMessage !== false;
  const welcomeText = settings.welcomeText || "Hello {name}, welcome back!";
  const defaultAccountTab = settings.defaultAccountTab || "dashboard";
  const showOrderLookupForm = settings.showOrderLookupForm !== false;

  // Order Summary / Received
  const orderSummaryLayout = settings.orderSummaryLayout || "card";
  const orderSummaryWidth = settings.orderSummaryWidth || "full";
  const showOrderNumber = settings.showOrderNumber !== false;
  const showOrderDate = settings.showOrderDate !== false;
  const showPaymentStatus = settings.showPaymentStatus !== false;
  const showOrderItems = settings.showOrderItems !== false;
  const showOrderTotals = settings.showOrderTotals !== false;
  const showShippingDetails = settings.showShippingDetails === true;
  const showBillingDetails = settings.showBillingDetails === true;
  const showThankYouMessage = settings.showThankYouMessage !== false;
  const thankYouHeading =
    settings.thankYouHeading ||
    "Thank you. Your order has been received.";
  const thankYouDescription =
    settings.thankYouDescription ||
    "We'll notify you once your order is on its way.";
  const showContinueShoppingButton =
    settings.showContinueShoppingButton !== false;
  const continueShoppingButtonText =
    settings.continueShoppingButtonText || "Continue Shopping";
  const continueShoppingLink = settings.continueShoppingLink || "/shop";
  const emptyOrderText =
    settings.emptyOrderText ||
    "We couldn't find an order matching those details.";

  // Mark cartLayout as used
  void cartLayout;

  // Use the authenticated customer's profile instead of a hard-coded name.
  // Only fill empty checkout/account fields so existing user edits are preserved.
  useEffect(() => {
    if (!user) return;

    if (user.name) {
      setCustomerName((current) => current || user.name);
      setAccountDisplayName((current) => current || user.name);
    }
    setAccountEmail((current) => current || user.email || "");
    setAccountProfileImage((current) => current || user.profile_image || "");

    if (user.email) {
      setEmail((current) => current || user.email);
      setAddressEmail((current) => current || user.email);
      setBillingEmail((current) => current || user.email);
      setShippingEmail((current) => current || user.email);
    }
  }, [user?.id, user?.name, user?.email]);

  const handleAccountLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      navigate("/admin/login", { replace: true });
    }
  };

  const handleAccountDetailsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountError("");
    setAccountMessage("");
    if (!user) {
      setAccountError("Please log in to update your account details.");
      return;
    }
    const displayName = accountDisplayName.trim();
    const firstName = accountFirstName.trim();
    const lastName = accountLastName.trim();
    const emailValue = accountEmail.trim().toLowerCase();
    if (!displayName || !emailValue) {
      setAccountError("Display name and email address are required.");
      return;
    }
    if (accountNewPassword && accountNewPassword.length < 6) {
      setAccountError("New password must be at least 6 characters.");
      return;
    }
    const passwordFieldsStarted = Boolean(accountCurrentPassword || accountNewPassword || accountConfirmPassword);
    if (passwordFieldsStarted && (!accountCurrentPassword || !accountNewPassword || !accountConfirmPassword)) {
      setAccountError("To change your password, complete all three password fields.");
      return;
    }
    if (accountNewPassword !== accountConfirmPassword) {
      setAccountError("New password and confirmation do not match.");
      return;
    }
    setAccountSaving(true);
    try {
      const updated = await updateProfile(displayName, undefined, emailValue, firstName, lastName);
      updateUser({ name: updated.name || displayName, email: updated.email || emailValue });
      setCustomerName(updated.name || displayName);
      if (accountNewPassword) {
        await changePassword(accountCurrentPassword, accountNewPassword);
        setAccountCurrentPassword("");
        setAccountNewPassword("");
        setAccountConfirmPassword("");
        setAccountMessage("Account details updated. Password changed; an email notification is sent when SMTP is configured.");
      } else {
        setAccountMessage("Account details updated successfully.");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        setAccountError(typeof detail === "string" ? detail : "Unable to update account details. Please try again.");
      } else {
        setAccountError("Unable to update account details. Please try again.");
      }
    } finally {
      setAccountSaving(false);
    }
  };

  const handleAccountImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAccountError("");
    setAccountMessage("");
    if (!file.type.startsWith("image/")) {
      setAccountError("Please select an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAccountError("Profile image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    try {
      const result = await uploadProfileImage(file);
      setAccountProfileImage(result.profile_image || result.url);
      updateUser({ profile_image: result.profile_image || result.url });
      setAccountMessage("Profile image uploaded and saved to the media library.");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        setAccountError(typeof detail === "string" ? detail : "Unable to upload profile image.");
      } else {
        setAccountError("Unable to upload profile image.");
      }
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (page !== "account" || !user) return;
    let active = true;
    getProfile().then((profile) => {
      if (!active) return;
      setAccountFirstName(profile.first_name || "");
      setAccountLastName(profile.last_name || "");
      setAccountDisplayName(profile.name || user.name || "");
      setAccountEmail(profile.email || user.email || "");
      setAccountProfileImage(profile.profile_image || user.profile_image || "");
    }).catch((error) => {
      console.error("Unable to load account details:", error);
    });
    return () => { active = false; };
  }, [page, user?.id]);

  // Sync active tab with default when page changes
  useEffect(() => {
    if (page === "account") {
      setActiveAccountTab(defaultAccountTab as AccountTab);
    }
  }, [page, defaultAccountTab]);

  useEffect(() => {
    const templateType = templateTypes[page];
    if (embedded || previewMode || !templateType) return;
    let active = true;
    fetchActiveTemplate(templateType, location.pathname)
      .then((template) => {
        if (active && template) {
          setActiveTemplate({
            path: location.pathname,
            type: templateType,
            template,
          });
        }
      })
      .catch((error) => {
        console.error(
          `Unable to load ${templateType} storefront template:`,
          error,
        );
      });
    return () => {
      active = false;
    };
  }, [page, location.pathname, embedded, previewMode]);

  useEffect(() => {
    if (previewMode) return;
    let active = true;

    axios
      .get<PublicPaymentSettings>(`${API_URL}/api/settings/payments/public`)
      .then(({ data }) => {
        if (!active) return;

        setRazorpayEnabled(Boolean(data.enabled));

        // Supports the nested response and the flat shape used by older APIs.
        const hasBankUpiConfig = Boolean(
          data.bank_upi ||
            "upi_enabled" in data ||
            "bank_transfer_enabled" in data,
        );
        const bankUpi = data.bank_upi || data;
        setHasPublicBankUpiConfig(hasBankUpiConfig);
        setPublicBankUpiSettings({
          upi_enabled: Boolean(bankUpi.upi_enabled),
          upi_id: bankUpi.upi_id || "",
          upi_account_name: bankUpi.upi_account_name || "",
          bank_transfer_enabled: Boolean(bankUpi.bank_transfer_enabled),
          account_holder_name: bankUpi.account_holder_name || "",
          bank_name: bankUpi.bank_name || "",
          account_number: bankUpi.account_number || "",
          ifsc_code: bankUpi.ifsc_code || "",
          branch_name: bankUpi.branch_name || "",
          payment_instructions: bankUpi.payment_instructions || "",
        });
        setPublicPaymentSettingsLoaded(true);
      })
      .catch((error) => {
        console.error("Unable to load payment methods:", error);
        if (active) {
          setRazorpayEnabled(false);
          setPublicBankUpiSettings({});
          setHasPublicBankUpiConfig(false);
          setPublicPaymentSettingsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [previewMode]);

  useEffect(() => {
    const update = () => {
      try {
        setCart(readCart());
        setCartError("");
      } catch (error) {
        console.error("Unable to refresh cart contents:", error);
        setCartError(
          "Saved cart data could not be read. Clear the site cart storage and try again.",
        );
      }
    };
    update();
    window.addEventListener("store-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("store-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    if (page !== "shop") return;
    if (previewMode) {
      setProducts([
        {
          id: "preview-1",
          title: "Sample Product 1",
          name: "Sample Product 1",
          slug: "sample-1",
          description: "",
          excerpt: "",
          image: "",
          featured_image: "",
          price: 99,
          quantity: 10,
          stock_status: "in_stock",
          category: "Sample",
          brand: "",
          sku: "",
        },
        {
          id: "preview-2",
          title: "Sample Product 2",
          name: "Sample Product 2",
          slug: "sample-2",
          description: "",
          excerpt: "",
          image: "",
          featured_image: "",
          price: 149,
          quantity: 10,
          stock_status: "in_stock",
          category: "Sample",
          brand: "",
          sku: "",
        },
      ] as unknown as ProductData[]);
      return;
    }
    let active = true;
    axios
      .get<{ products: ProductData[] }>(`${API_URL}/api/public/products`, {
        params: { limit: 100 },
      })
      .then(({ data }) => {
        if (active)
          setProducts(Array.isArray(data.products) ? data.products : []);
      })
      .catch((error) => {
        console.error("Unable to load shop products:", error);
        if (active)
          setLoadError("Products could not be loaded. Please try again later.");
      });
    return () => {
      active = false;
    };
  }, [page, previewMode]);

  // 🆕 Load saved addresses when email changes
  useEffect(() => {
    if (page !== "account") return;
    if (previewMode) return;
    if (
      !addressEmail ||
      !addressEmail.includes("@") ||
      !addressEmail.includes(".")
    ) {
      return;
    }

    let active = true;
    setAddressLoadError("");
    setAddressLoading(true);

    axios
      .get<{
        billing: SavedAddress | null;
        shipping: SavedAddress | null;
      }>(`${API_URL}/api/public/account/addresses`, {
        params: { email: addressEmail.trim().toLowerCase() },
      })
      .then(({ data }) => {
        if (!active) return;

        const b = data.billing;
        if (b) {
          setBillingFirstName(b.first_name || "");
          setBillingLastName(b.last_name || "");
          setBillingCompany(b.company || "");
          setBillingCountry(b.country || "India");
          setBillingState(b.state || "");
          setBillingCity(b.city || "");
          setBillingPostcode(b.postcode || "");
          setBillingAddress1(b.address_1 || "");
          setBillingAddress2(b.address_2 || "");
          setBillingPhone(b.phone || "");
          setBillingEmail(b.email || "");
        }

        const s = data.shipping;
        if (s) {
          setShippingFirstName(s.first_name || "");
          setShippingLastName(s.last_name || "");
          setShippingCompany(s.company || "");
          setShippingCountry(s.country || "India");
          setShippingState(s.state || "");
          setShippingCity(s.city || "");
          setShippingPostcode(s.postcode || "");
          setShippingAddress1(s.address_1 || "");
          setShippingAddress2(s.address_2 || "");
          setShippingPhone(s.phone || "");
          setShippingEmail(s.email || "");
        }
      })
      .catch((error) => {
        console.error("Failed to load addresses:", error);
        if (active) setAddressLoadError("Could not load saved addresses.");
      })
      .finally(() => {
        if (active) setAddressLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, addressEmail, previewMode]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category).filter(Boolean)),
      ),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products
      .filter((product) => !category || product.category === category)
      .filter(
        (product) =>
          !normalizedSearch ||
          product.title.toLowerCase().includes(normalizedSearch),
      )
      .sort((a, b) =>
        sort === "price-low"
          ? a.price - b.price
          : sort === "price-high"
            ? b.price - a.price
            : sort === "newest"
              ? b.id.localeCompare(a.id)
              : a.title.localeCompare(b.title),
      );
  }, [products, search, category, sort]);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize,
  );
  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const submitCheckout = async (event: FormEvent) => {
    event.preventDefault();
    if (previewMode) return;
    setSubmitting(true);
    setCheckoutError("");
    try {
      const { data } = await axios.post<CheckoutResponse>(
        `${API_URL}/api/public/checkout`,
        {
          customer_name: customerName,
          email,
          phone,
          address,
          payment_method: paymentMethod,
          order_notes: orderNotes,
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        },
      );
      if (data.razorpay) {
        const Razorpay = await loadRazorpay();
        await new Promise<void>((resolve, reject) => {
          const checkout = new Razorpay({
            key: data.razorpay!.key_id,
            amount: data.razorpay!.amount,
            currency: data.razorpay!.currency,
            name: data.razorpay!.name,
            order_id: data.razorpay!.order_id,
            prefill: { name: customerName, email, contact: phone },
            handler: async (payment) => {
              try {
                const { data: confirmedOrder } =
                  await axios.post<CheckoutResponse>(
                    `${API_URL}/api/public/payments/verify`,
                    {
                      order_id: data.id,
                      razorpay_order_id: payment.razorpay_order_id,
                      razorpay_payment_id: payment.razorpay_payment_id,
                      razorpay_signature: payment.razorpay_signature,
                    },
                  );
                clearCart();
                navigate("/order-received", {
                  replace: true,
                  state: confirmedOrder,
                });
                resolve();
              } catch (verificationError) {
                reject(verificationError);
              }
            },
            modal: {
              ondismiss: () => {
                void axios
                  .post(`${API_URL}/api/public/payments/fail/${data.id}`)
                  .catch((failureError) =>
                    console.error(
                      "Unable to record closed payment:",
                      failureError,
                    ),
                  );
                setCheckoutError("Payment was cancelled. You can try again.");
                resolve();
              },
            },
          });
          checkout.on("payment.failed", (failure) => {
            void axios
              .post(`${API_URL}/api/public/payments/fail/${data.id}`)
              .catch((failureError) =>
                console.error("Unable to record failed payment:", failureError),
              );
            reject(
              new Error(
                failure.error?.description ||
                  "Payment failed. Please try again.",
              ),
            );
          });
          checkout.open();
        });
        return;
      }
      clearCart();
      navigate("/order-received", { replace: true, state: data });
    } catch (error) {
      console.error("Checkout failed:", error);
      setCheckoutError(
        axios.isAxiosError(error)
          ? String(
              error.response?.data?.detail ||
                "Checkout could not be completed.",
            )
          : "Checkout could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const lookupOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (previewMode) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const response = await axios.get<OrderLookupResult>(
        `${API_URL}/api/public/orders/lookup`,
        { params: { order_number: lookupOrderNumber, email: lookupEmail } },
      );
      setLookupResult(response.data);
    } catch (error) {
      console.error("Order lookup failed:", error);
      setLookupError(emptyOrderText);
    } finally {
      setLookupLoading(false);
    }
  };

  const addProduct = (product: ProductData) => {
    if (previewMode) return;
    try {
      addToCart({
        product_id: product.id,
        name: product.title,
        slug: product.slug,
        price: product.price,
        image: product.image,
      });
      setCart(readCart());
    } catch (error) {
      console.error("Unable to add shop product to cart:", error);
      setLoadError("Unable to add this product to cart.");
    }
  };

  // 🆕 Save billing address
  const saveBillingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) return;

    if (
      !addressEmail ||
      !addressEmail.includes("@") ||
      !addressEmail.includes(".")
    ) {
      setAddressSaveMessage("Please enter a valid email first.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
      return;
    }

    try {
      await axios.post(`${API_URL}/api/public/account/addresses`, {
        email: addressEmail.trim().toLowerCase(),
        billing: {
          first_name: billingFirstName,
          last_name: billingLastName,
          company: billingCompany,
          country: billingCountry,
          state: billingState,
          city: billingCity,
          postcode: billingPostcode,
          address_1: billingAddress1,
          address_2: billingAddress2,
          phone: billingPhone,
          email: billingEmail,
        },
      });
      setAddressSaveMessage("✅ Billing address saved.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
    } catch (error) {
      console.error("Save billing address failed:", error);
      setAddressSaveMessage("❌ Could not save billing address.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
    }
  };

  // 🆕 Save shipping address
  const saveShippingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) return;

    if (
      !addressEmail ||
      !addressEmail.includes("@") ||
      !addressEmail.includes(".")
    ) {
      setAddressSaveMessage("Please enter a valid email first.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
      return;
    }

    try {
      await axios.post(`${API_URL}/api/public/account/addresses`, {
        email: addressEmail.trim().toLowerCase(),
        shipping: {
          first_name: shippingFirstName,
          last_name: shippingLastName,
          company: shippingCompany,
          country: shippingCountry,
          state: shippingState,
          city: shippingCity,
          postcode: shippingPostcode,
          address_1: shippingAddress1,
          address_2: shippingAddress2,
          phone: shippingPhone,
          email: shippingEmail,
        },
      });
      setAddressSaveMessage("✅ Shipping address saved.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
    } catch (error) {
      console.error("Save shipping address failed:", error);
      setAddressSaveMessage("❌ Could not save shipping address.");
      setTimeout(() => setAddressSaveMessage(""), 3000);
    }
  };

  if (
    !embedded &&
    !previewMode &&
    activeTemplate?.path === location.pathname &&
    activeTemplate.type === templateTypes[page] &&
    activeTemplate.template.layout?.length
  ) {
    return (
      <BuilderRenderer
        layout={activeTemplate.template.layout}
        pageId={activeTemplate.template.id}
        pageTitle={activeTemplate.template.title}
      />
    );
  }

  // ============================================================
  // 🎨 SHARED STYLES
  // ============================================================
  const sectionStyle: React.CSSProperties = {
    maxWidth: previewMode ? "100%" : 1200,
    margin: "0 auto",
    padding: previewMode ? "16px" : "32px 20px 60px",
    boxSizing: "border-box",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#1a1a2e",
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontSize: 15,
    lineHeight: 1.4,
    color: "#1a1a2e",
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
    minHeight: 46,
    fontFamily: "inherit",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 96,
    resize: "vertical",
    lineHeight: 1.5,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    paddingRight: 36,
    cursor: "pointer",
    backgroundImage:
      "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg width='12' height='8' viewBox='0 0 12 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%236b7280' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    backgroundSize: "12px 8px",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    letterSpacing: 0.1,
  };

  const fieldWrapperStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 4,
  };

  const buttonPrimary: React.CSSProperties = {
    background: "#0c2f55",
    color: "#fff",
    border: "none",
    padding: "12px 22px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    minHeight: 46,
    transition: "background 0.2s",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  };

  const buttonSecondary: React.CSSProperties = {
    background: "#fff",
    color: "#0c2f55",
    border: "1px solid #0c2f55",
    padding: "12px 22px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    minHeight: 46,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  };

  const focusStyles = `
    .sf-input:focus,
    .sf-input:focus-visible {
      border-color: #0c2f55 !important;
      box-shadow: 0 0 0 3px rgba(12,47,85,0.12) !important;
    }
    .sf-account-tab {
      transition: background 0.15s, color 0.15s;
    }
    .sf-account-tab:hover {
      background: #f3f4f6 !important;
    }
    .sf-account-tab.active:hover {
      background: #e0e9f5 !important;
    }
    .sf-button-primary:hover {
      background: #0a2544 !important;
    }
    .sf-button-secondary:hover {
      background: #f3f4f6 !important;
    }
    .sf-add-to-cart:hover:not(:disabled) {
      background: #0a2544 !important;
    }
  `;

  return (
    <main style={sectionStyle}>
      <style dangerouslySetInnerHTML={{ __html: focusStyles }} />

      {!previewMode && (
        <nav
          aria-label="Store"
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 28,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Link to="/shop" style={{ color: "#0c2f55", textDecoration: "none" }}>
            Shop
          </Link>
          <Link to="/cart" style={{ color: "#0c2f55", textDecoration: "none" }}>
            Cart ({cartCount})
          </Link>
          <Link
            to="/my-account"
            style={{ color: "#0c2f55", textDecoration: "none" }}
          >
            My account
          </Link>
        </nav>
      )}
      {cartError && <p role="alert">{cartError}</p>}

      {/* ============================================================ */}
      {/* SHOP                                                          */}
      {/* ============================================================ */}
      {page === "shop" && (
        <>
          <h1 style={{ marginTop: 0 }}>Shop</h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              margin: "20px 0 28px",
            }}
          >
            <input
              className="sf-input"
              aria-label="Search products"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageNumber(1);
              }}
              placeholder="Search products…"
              style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 320 }}
            />
            <select
              className="sf-input"
              aria-label="Filter by category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPageNumber(1);
              }}
              style={{ ...selectStyle, flex: "0 0 180px", maxWidth: 180 }}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="sf-input"
              aria-label="Sort products"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPageNumber(1);
              }}
              style={{ ...selectStyle, flex: "0 0 200px", maxWidth: 200 }}
            >
              <option value="name">Name</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          {loadError && <p role="alert">{loadError}</p>}
          {!loadError && !visibleProducts.length && <p>No products found.</p>}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 20,
            }}
          >
            {visibleProducts.map((product) => (
              <article key={product.id} style={cardStyle}>
                <Link
                  to={
                    product.permalink ||
                    `/products/${encodeURIComponent(product.slug || product.id)}`
                  }
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {product.image && (
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.title}
                      loading="lazy"
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    />
                  )}
                  <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>
                    {product.title}
                  </h2>
                  <strong style={{ color: "#0c2f55" }}>
                    {money(product.price)}
                  </strong>
                </Link>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="storefront-add-to-cart sf-add-to-cart"
                    disabled={
                      product.stock_status === "out_of_stock" ||
                      (product.manage_stock !== false && product.quantity <= 0)
                    }
                    onClick={() => addProduct(product)}
                    style={{
                      ...buttonPrimary,
                      width: "100%",
                      opacity:
                        product.stock_status === "out_of_stock" ||
                        (product.manage_stock !== false &&
                          product.quantity <= 0)
                          ? 0.5
                          : 1,
                      cursor:
                        product.stock_status === "out_of_stock" ||
                        (product.manage_stock !== false &&
                          product.quantity <= 0)
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {product.stock_status === "out_of_stock" ||
                    (product.manage_stock !== false && product.quantity <= 0)
                      ? "Out of stock"
                      : "Add to cart"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: 28,
              }}
            >
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((current) => current - 1)}
                style={{ ...buttonSecondary, opacity: pageNumber <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ alignSelf: "center", fontSize: 14 }}>
                Page {pageNumber} of {totalPages}
              </span>
              <button
                type="button"
                disabled={pageNumber >= totalPages}
                onClick={() => setPageNumber((current) => current + 1)}
                style={{
                  ...buttonSecondary,
                  opacity: pageNumber >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* CART                                                          */}
      {/* ============================================================ */}
      {page === "cart" && (
        <>
          {showCartHeading && (
            <h1 style={{ marginTop: 0 }}>{cartHeadingText}</h1>
          )}

          {!cart.length ? (
            <div style={cardStyle}>
              <p style={{ margin: 0, fontSize: 15 }}>{emptyCartMessage}</p>
              {showContinueShopping && (
                <Link
                  to="/shop"
                  className="sf-button-secondary"
                  style={{ ...buttonSecondary, marginTop: 16 }}
                >
                  {continueShoppingText}
                </Link>
              )}
            </div>
          ) : (
            <>
              {showCartItems && (
                <div style={{ display: "grid", gap: 0, marginTop: 24 }}>
                  {cart.map((item) => (
                    <article
                      key={item.product_id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        alignItems: "center",
                        borderBottom: "1px solid #eef0f3",
                        padding: "16px 0",
                      }}
                    >
                      {item.image ? (
                        <img
                          src={getImageUrl(item.image)}
                          alt=""
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 8,
                            flex: "0 0 auto",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 72,
                            height: 72,
                            background: "#f3f4f6",
                            borderRadius: 8,
                            display: "inline-block",
                            flex: "0 0 auto",
                          }}
                        />
                      )}
                      <Link
                        to={`/products/${encodeURIComponent(
                          item.slug || item.product_id,
                        )}`}
                        style={{
                          flex: 1,
                          color: "#0c2f55",
                          textDecoration: "none",
                          fontWeight: 600,
                          minWidth: 140,
                        }}
                      >
                        {item.name}
                      </Link>
                      <span style={{ fontWeight: 600, minWidth: 80 }}>
                        {money(item.price)}
                      </span>
                      <input
                        className="sf-input"
                        aria-label={`Quantity for ${item.name}`}
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(event) =>
                          updateCartQuantity(
                            item.product_id,
                            Number(event.target.value),
                          )
                        }
                        style={{ ...inputStyle, width: 80, textAlign: "center" }}
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product_id, 0)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#b42318",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          padding: "8px 10px",
                        }}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              )}

              {showCoupon && (
                <div
                  style={{
                    marginTop: 24,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <input
                    className="sf-input"
                    type="text"
                    placeholder="Coupon code"
                    style={{ ...inputStyle, maxWidth: 240 }}
                  />
                  <button
                    type="button"
                    className="sf-button-secondary"
                    style={buttonSecondary}
                  >
                    Apply Coupon
                  </button>
                </div>
              )}

              {showCartTotal && (
                <h2
                  style={{
                    textAlign: "right",
                    marginTop: 28,
                    fontSize: 20,
                    color: "#0c2f55",
                  }}
                >
                  Subtotal: {money(cartTotal)}
                </h2>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {showUpdateCartButton && (
                  <button
                    type="button"
                    className="sf-button-secondary"
                    style={buttonSecondary}
                  >
                    Update Cart
                  </button>
                )}
                {showContinueShopping && (
                  <Link
                    to="/shop"
                    className="sf-button-secondary"
                    style={buttonSecondary}
                  >
                    {continueShoppingText}
                  </Link>
                )}
                {showCheckoutButton && (
                  <Link
                    to="/checkout"
                    className="sf-button-primary"
                    style={buttonPrimary}
                  >
                    {checkoutButtonText}
                  </Link>
                )}
              </div>

              {showCrossSells && (
                <section style={{ marginTop: 48 }}>
                  <h2 style={{ fontSize: 20 }}>{crossSellsHeading}</h2>
                  <p style={{ color: "#888" }}>
                    Cross-sell products will be shown here.
                  </p>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* CHECKOUT                                                      */}
      {/* ============================================================ */}
      {page === "checkout" && (
        <>
          <h1 style={{ marginTop: 0 }}>Checkout</h1>
          {!cart.length ? (
            <div style={cardStyle}>
              <p style={{ margin: 0 }}>
                Your cart is empty.{" "}
                <Link to="/shop" style={{ color: "#0c2f55" }}>
                  Browse the shop
                </Link>
                .
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  checkoutLayout === "two-column"
                    ? "repeat(auto-fit, minmax(min(100%, 340px), 1fr))"
                    : "1fr",
                gap: 32,
                marginTop: 24,
              }}
            >
              <form
                onSubmit={submitCheckout}
                style={{ display: "grid", gap: 16 }}
              >
                {checkoutError && (
                  <div
                    role="alert"
                    style={{
                      padding: 12,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      color: "#b42318",
                      fontSize: 14,
                    }}
                  >
                    {checkoutError}
                  </div>
                )}

                {showBillingForm && (
                  <>
                    <div style={fieldWrapperStyle}>
                      <label style={labelStyle} htmlFor="sf-name">
                        Name
                      </label>
                      <input
                        id="sf-name"
                        className="sf-input"
                        required
                        maxLength={160}
                        value={customerName}
                        onChange={(event) =>
                          setCustomerName(event.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div style={fieldWrapperStyle}>
                      <label style={labelStyle} htmlFor="sf-email">
                        Email
                      </label>
                      <input
                        id="sf-email"
                        className="sf-input"
                        required
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={fieldWrapperStyle}>
                      <label style={labelStyle} htmlFor="sf-phone">
                        Phone
                      </label>
                      <input
                        id="sf-phone"
                        className="sf-input"
                        required
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={fieldWrapperStyle}>
                      <label style={labelStyle} htmlFor="sf-address">
                        Billing / shipping address
                      </label>
                      <textarea
                        id="sf-address"
                        className="sf-input"
                        required
                        minLength={5}
                        rows={4}
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        style={textareaStyle}
                      />
                    </div>
                  </>
                )}

                {showShippingForm && (
                  <fieldset
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    <legend
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                        padding: "0 8px",
                      }}
                    >
                      Shipping details
                    </legend>
                    <div style={fieldWrapperStyle}>
                      <label style={labelStyle} htmlFor="sf-ship-address">
                        Shipping address
                      </label>
                      <textarea
                        id="sf-ship-address"
                        className="sf-input"
                        rows={3}
                        placeholder="Same as billing by default"
                        style={textareaStyle}
                      />
                    </div>
                  </fieldset>
                )}

                {showOrderNotes && (
                  <div style={fieldWrapperStyle}>
                    <label style={labelStyle} htmlFor="sf-order-notes">
                      Order notes (optional)
                    </label>
                    <textarea
                      id="sf-order-notes"
                      className="sf-input"
                      rows={3}
                      placeholder={orderNotesPlaceholder}
                      value={orderNotes}
                      onChange={(event) => setOrderNotes(event.target.value)}
                      style={textareaStyle}
                    />
                  </div>
                )}

                <div style={fieldWrapperStyle}>
                  <label style={labelStyle} htmlFor="sf-payment">
                    Payment method
                  </label>
                  <select
                    id="sf-payment"
                    className="sf-input"
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as typeof paymentMethod,
                      )
                    }
                    style={selectStyle}
                  >
                    {showCod && (
                      <option value="cash_on_delivery">
                        {cashOnDeliveryLabel}
                      </option>
                    )}
                    {showBankTransfer &&
                      (!publicPaymentSettingsLoaded ||
                        !hasPublicBankUpiConfig ||
                        publicBankUpiSettings.bank_transfer_enabled ||
                        publicBankUpiSettings.upi_enabled) && (
                        <option value="bank_transfer">
                          {publicBankUpiSettings.upi_enabled &&
                          !publicBankUpiSettings.bank_transfer_enabled &&
                          !settings.bankTransferLabel
                            ? "UPI payment"
                            : bankTransferLabel}
                        </option>
                      )}
                    {(razorpayEnabled || showRazorpayOpt) && (
                      <option value="razorpay">{razorpayLabel}</option>
                    )}
                  </select>
                </div>

                {paymentMethod === "bank_transfer" && (
                  <section
                    aria-label="UPI and bank transfer details"
                    style={{
                      display: "grid",
                      gap: 12,
                      padding: 16,
                      border: "1px solid #dbe3ec",
                      borderRadius: 10,
                      background: "#f8fafc",
                      color: "#344054",
                      fontSize: 14,
                    }}
                  >
                    <h3 style={{ margin: 0, color: "#0c2f55", fontSize: 16 }}>
                      Manual payment details
                    </h3>

                    {publicBankUpiSettings.upi_enabled &&
                      publicBankUpiSettings.upi_id && (
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong>UPI payment</strong>
                          {publicBankUpiSettings.upi_account_name && (
                            <span>
                              Account name: {publicBankUpiSettings.upi_account_name}
                            </span>
                          )}
                          <span>
                            UPI ID: <strong>{publicBankUpiSettings.upi_id}</strong>
                          </span>
                        </div>
                      )}

                    {publicBankUpiSettings.bank_transfer_enabled && (
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong>Bank transfer</strong>
                        {publicBankUpiSettings.account_holder_name && (
                          <span>
                            Account holder: {publicBankUpiSettings.account_holder_name}
                          </span>
                        )}
                        {publicBankUpiSettings.bank_name && (
                          <span>Bank name: {publicBankUpiSettings.bank_name}</span>
                        )}
                        {publicBankUpiSettings.account_number && (
                          <span>
                            Account number: {publicBankUpiSettings.account_number}
                          </span>
                        )}
                        {publicBankUpiSettings.ifsc_code && (
                          <span>IFSC code: {publicBankUpiSettings.ifsc_code}</span>
                        )}
                        {publicBankUpiSettings.branch_name && (
                          <span>Branch: {publicBankUpiSettings.branch_name}</span>
                        )}
                      </div>
                    )}

                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {publicBankUpiSettings.payment_instructions ||
                        bankTransferInstructions}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#667085" }}>
                      Your order will be created as a pending/manual payment order. The store will confirm payment after receiving it.
                    </p>
                  </section>
                )}

                {showTerms && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 14,
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      required
                      style={{ marginTop: 3, width: 16, height: 16 }}
                    />
                    <span>
                      {termsText}
                      {termsLink && (
                        <>
                          {" "}
                          <a
                            href={termsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#0c2f55" }}
                          >
                            (view)
                          </a>
                        </>
                      )}
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="sf-button-primary"
                  style={{
                    ...buttonPrimary,
                    width: "100%",
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  {submitting ? "Placing order…" : placeOrderText}
                </button>

                {showReturnToCart && (
                  <Link
                    to="/cart"
                    className="sf-button-secondary"
                    style={{ ...buttonSecondary, width: "100%" }}
                  >
                    {returnToCartText}
                  </Link>
                )}
              </form>

              {orderSummaryPosition !== "top" && (
                <aside style={{ ...cardStyle, alignSelf: "start" }}>
                  <h2 style={{ marginTop: 0, fontSize: 18 }}>Your order</h2>
                  {cart.map((item) => (
                    <p
                      key={item.product_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 14,
                        margin: "8px 0",
                        color: "#374151",
                      }}
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </p>
                  ))}
                  <hr
                    style={{
                      border: 0,
                      borderTop: "1px solid #eef0f3",
                      margin: "14px 0",
                    }}
                  />
                  <p
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 16,
                      margin: 0,
                    }}
                  >
                    <span>Total</span>
                    <strong style={{ color: "#0c2f55" }}>
                      {money(cartTotal)}
                    </strong>
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 14 }}>
                    Prices and stock are validated again when the order is
                    placed.
                  </p>
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* ORDER RECEIVED                                                */}
      {/* ============================================================ */}
      {page === "received" && (
        <div
          style={{
            ...cardStyle,
            maxWidth: orderSummaryWidth === "boxed" ? 600 : "100%",
            margin: "0 auto",
            display: orderSummaryLayout === "plain" ? "block" : undefined,
            background:
              orderSummaryLayout === "plain" ? "transparent" : "#fff",
            border:
              orderSummaryLayout === "plain"
                ? "none"
                : "1px solid #e5e7eb",
            borderRadius: orderSummaryLayout === "plain" ? 0 : 12,
            padding: orderSummaryLayout === "plain" ? 0 : 24,
          }}
        >
          {showThankYouMessage && (
            <>
              <h1 style={{ marginTop: 0 }}>{thankYouHeading}</h1>
              <p style={{ color: "#555" }}>{thankYouDescription}</p>
            </>
          )}

          {receipt && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  orderSummaryLayout === "table" ? "180px 1fr" : undefined,
                gap: orderSummaryLayout === "table" ? 10 : 6,
                marginTop: 16,
              }}
            >
              {showOrderNumber && receipt.order_number && (
                <p style={{ margin: 0 }}>
                  <strong>Order number:</strong> {receipt.order_number}
                </p>
              )}

              {showOrderDate && receipt.created_at && (
                <p style={{ margin: 0 }}>
                  <strong>Order date:</strong>{" "}
                  {new Date(receipt.created_at).toLocaleDateString()}
                </p>
              )}

              {showPaymentStatus && (
                <p style={{ margin: 0 }}>
                  <strong>Payment:</strong>{" "}
                  {receipt.payment_status === "paid"
                    ? "Confirmed"
                    : "Pending"}
                </p>
              )}

              {showOrderItems && receipt.items && receipt.items.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    gridColumn:
                      orderSummaryLayout === "table" ? "1 / -1" : undefined,
                  }}
                >
                  <strong>Items:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                    {receipt.items.map((item, idx) => (
                      <li key={`${item.name}-${idx}`}>
                        {item.name} × {item.quantity} —{" "}
                        {money(item.unit_price * item.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showOrderTotals && (
                <p
                  style={{
                    margin: 0,
                    gridColumn:
                      orderSummaryLayout === "table" ? "1 / -1" : undefined,
                  }}
                >
                  <strong>Total:</strong> {money(receipt.total)}
                </p>
              )}

              {showShippingDetails && receipt.shipping_address && (
                <div
                  style={{
                    marginTop: 8,
                    gridColumn:
                      orderSummaryLayout === "table" ? "1 / -1" : undefined,
                  }}
                >
                  <strong>Shipping to:</strong>
                  <p style={{ margin: "6px 0 0", color: "#555" }}>
                    {receipt.shipping_address}
                  </p>
                </div>
              )}

              {showBillingDetails && receipt.billing_address && (
                <div
                  style={{
                    marginTop: 8,
                    gridColumn:
                      orderSummaryLayout === "table" ? "1 / -1" : undefined,
                  }}
                >
                  <strong>Billing address:</strong>
                  <p style={{ margin: "6px 0 0", color: "#555" }}>
                    {receipt.billing_address}
                  </p>
                </div>
              )}
            </div>
          )}

          {!receipt && (
            <p>Thank you. Your order was submitted successfully.</p>
          )}

          {showContinueShoppingButton && (
            <Link
              to={continueShoppingLink}
              className="sf-button-primary"
              style={{
                ...buttonPrimary,
                marginTop: 20,
                display: "inline-flex",
              }}
            >
              {continueShoppingButtonText}
            </Link>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MY ACCOUNT                                                    */}
      {/* ============================================================ */}
      {page === "account" && (
        <>
          <h1 style={{ marginTop: 0 }}>My Account</h1>

          {showWelcomeMessage && (user?.name || customerName || user?.email) && (
            <p style={{ marginBottom: 24, fontSize: 15, color: "#555" }}>
              {welcomeText.replace(
                "{name}",
                user?.name || customerName || user?.email || "",
              )}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                (accountLayout === "sidebar" ||
                  accountLayout === "tabs-left") &&
                showAccountNav
                  ? accountNavPosition === "right"
                    ? "1fr 240px"
                    : "240px 1fr"
                  : "1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {showAccountNav && (
              <aside style={{ ...cardStyle, padding: 12 }}>
                <nav style={{ display: "grid", gap: 4 }}>
                  {showDashboardLink && (
                    <button
                      type="button"
                      className={`sf-account-tab ${
                        activeAccountTab === "dashboard" ? "active" : ""
                      }`}
                      onClick={() => setActiveAccountTab("dashboard")}
                      style={{
                        textAlign: "left",
                        background:
                          activeAccountTab === "dashboard"
                            ? "#e0e9f5"
                            : "transparent",
                        color:
                          activeAccountTab === "dashboard"
                            ? "#0c2f55"
                            : "#374151",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight:
                          activeAccountTab === "dashboard" ? 700 : 500,
                        fontFamily: "inherit",
                      }}
                    >
                      Dashboard
                    </button>
                  )}
                  {showOrdersLink && (
                    <button
                      type="button"
                      className={`sf-account-tab ${
                        activeAccountTab === "orders" ? "active" : ""
                      }`}
                      onClick={() => setActiveAccountTab("orders")}
                      style={{
                        textAlign: "left",
                        background:
                          activeAccountTab === "orders"
                            ? "#e0e9f5"
                            : "transparent",
                        color:
                          activeAccountTab === "orders"
                            ? "#0c2f55"
                            : "#374151",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight:
                          activeAccountTab === "orders" ? 700 : 500,
                        fontFamily: "inherit",
                      }}
                    >
                      Orders
                    </button>
                  )}
                  {showDownloadsLink && (
                    <button
                      type="button"
                      className={`sf-account-tab ${
                        activeAccountTab === "downloads" ? "active" : ""
                      }`}
                      onClick={() => setActiveAccountTab("downloads")}
                      style={{
                        textAlign: "left",
                        background:
                          activeAccountTab === "downloads"
                            ? "#e0e9f5"
                            : "transparent",
                        color:
                          activeAccountTab === "downloads"
                            ? "#0c2f55"
                            : "#374151",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight:
                          activeAccountTab === "downloads" ? 700 : 500,
                        fontFamily: "inherit",
                      }}
                    >
                      Downloads
                    </button>
                  )}
                  {showAddressesLink && (
                    <button
                      type="button"
                      className={`sf-account-tab ${
                        activeAccountTab === "addresses" ? "active" : ""
                      }`}
                      onClick={() => setActiveAccountTab("addresses")}
                      style={{
                        textAlign: "left",
                        background:
                          activeAccountTab === "addresses"
                            ? "#e0e9f5"
                            : "transparent",
                        color:
                          activeAccountTab === "addresses"
                            ? "#0c2f55"
                            : "#374151",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight:
                          activeAccountTab === "addresses" ? 700 : 500,
                        fontFamily: "inherit",
                      }}
                    >
                      Addresses
                    </button>
                  )}
                  {showAccountDetailsLink && (
                    <button
                      type="button"
                      className={`sf-account-tab ${
                        activeAccountTab === "account_details" ? "active" : ""
                      }`}
                      onClick={() => setActiveAccountTab("account_details")}
                      style={{
                        textAlign: "left",
                        background:
                          activeAccountTab === "account_details"
                            ? "#e0e9f5"
                            : "transparent",
                        color:
                          activeAccountTab === "account_details"
                            ? "#0c2f55"
                            : "#374151",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight:
                          activeAccountTab === "account_details" ? 700 : 500,
                        fontFamily: "inherit",
                      }}
                    >
                      Account details
                    </button>
                  )}
                  {showLogoutLink && (
                    <button
                      type="button"
                      onClick={() => void handleAccountLogout()}
                      disabled={loggingOut}
                      aria-busy={loggingOut}
                      style={{
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: "11px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "#b42318",
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        marginTop: 4,
                        borderTop: "1px solid #eef0f3",
                      }}
                    >
                      {loggingOut ? (settings.logoutText || "Logging out...") : logoutText}
                    </button>
                  )}
                </nav>
              </aside>
            )}

            <section>
              {/* DASHBOARD */}
              {activeAccountTab === "dashboard" && (
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, fontSize: 20 }}>Dashboard</h2>
                  <p style={{ color: "#555", fontSize: 14 }}>
                    Welcome to your account dashboard. From here you can view
                    your recent orders, manage your shipping and billing
                    addresses, and edit your password and account details.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 12,
                      marginTop: 20,
                    }}
                  >
                    <div
                      style={{
                        padding: 16,
                        background: "#f9fafb",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Cart items
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#0c2f55",
                        }}
                      >
                        {cartCount}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 16,
                        background: "#f9fafb",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Cart total
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#0c2f55",
                        }}
                      >
                        {money(cartTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ORDERS */}
              {activeAccountTab === "orders" && (
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, fontSize: 20 }}>Orders</h2>

                  {showOrderLookupForm && (
                    <>
                      <p style={{ color: "#555", fontSize: 14 }}>
                        Look up your order using the order number from your
                        confirmation and the email used at checkout.
                      </p>
                      <form
                        onSubmit={(event) => void lookupOrder(event)}
                        style={{
                          display: "grid",
                          gap: 14,
                          maxWidth: 480,
                          marginTop: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle} htmlFor="sf-order-num">
                            Order number
                          </label>
                          <input
                            id="sf-order-num"
                            className="sf-input"
                            required
                            value={lookupOrderNumber}
                            onChange={(event) =>
                              setLookupOrderNumber(event.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle} htmlFor="sf-order-email">
                            Email
                          </label>
                          <input
                            id="sf-order-email"
                            className="sf-input"
                            required
                            type="email"
                            value={lookupEmail}
                            onChange={(event) =>
                              setLookupEmail(event.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                        {lookupError && (
                          <p
                            role="alert"
                            style={{
                              color: "#b42318",
                              background: "#fef2f2",
                              padding: 10,
                              borderRadius: 8,
                              fontSize: 13,
                              margin: 0,
                            }}
                          >
                            {lookupError}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={lookupLoading}
                          className="sf-button-primary"
                          style={{
                            ...buttonPrimary,
                            opacity: lookupLoading ? 0.7 : 1,
                            cursor: lookupLoading ? "wait" : "pointer",
                          }}
                        >
                          {lookupLoading ? "Looking up…" : "View order"}
                        </button>
                      </form>
                    </>
                  )}

                  {lookupResult && (
                    <section
                      aria-live="polite"
                      style={{
                        marginTop: 24,
                        padding: 16,
                        background: "#f9fafb",
                        borderRadius: 10,
                        border: "1px solid #eef0f3",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>
                        Order {lookupResult.order_number}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: "#555",
                          margin: "6px 0",
                        }}
                      >
                        Status: {lookupResult.status} · Payment:{" "}
                        {lookupResult.payment_status}
                      </p>
                      <ul style={{ paddingLeft: 20, margin: "10px 0" }}>
                        {lookupResult.items.map((item, index) => (
                          <li
                            key={`${item.name}-${index}`}
                            style={{ fontSize: 14, marginBottom: 4 }}
                          >
                            {item.name} × {item.quantity} —{" "}
                            {money(item.unit_price * item.quantity)}
                          </li>
                        ))}
                      </ul>
                      <strong style={{ color: "#0c2f55" }}>
                        Total: {money(lookupResult.total)}
                      </strong>
                    </section>
                  )}
                </div>
              )}

              {/* DOWNLOADS */}
              {activeAccountTab === "downloads" && (
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, fontSize: 20 }}>Downloads</h2>
                  <p style={{ color: "#555", fontSize: 14 }}>
                    You have no downloadable products yet. Once you purchase
                    a downloadable product, it will appear here.
                  </p>
                </div>
              )}

              {/* ADDRESSES */}
              {activeAccountTab === "addresses" && (
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, fontSize: 20 }}>Addresses</h2>
                  <p
                    style={{
                      color: "#555",
                      fontSize: 14,
                      marginBottom: 24,
                    }}
                  >
                    The following addresses will be used on the checkout page
                    by default.
                  </p>

                  {/* Email identity */}
                  <div
                    style={{
                      padding: 16,
                      background: "#f9fafb",
                      border: "1px solid #eef0f3",
                      borderRadius: 10,
                      marginBottom: 24,
                      maxWidth: 480,
                    }}
                  >
                    <label style={labelStyle} htmlFor="sf-addr-email">
                      Email (used to save your addresses)
                    </label>
                    <input
                      id="sf-addr-email"
                      className="sf-input"
                      type="email"
                      placeholder="you@example.com"
                      value={addressEmail}
                      onChange={(e) => setAddressEmail(e.target.value)}
                      style={inputStyle}
                    />
                    {addressLoading && (
                      <p
                        style={{
                          color: "#6b7280",
                          fontSize: 13,
                          marginTop: 8,
                        }}
                      >
                        Loading saved addresses…
                      </p>
                    )}
                    {addressLoadError && (
                      <p
                        style={{
                          color: "#b42318",
                          fontSize: 13,
                          marginTop: 8,
                        }}
                      >
                        {addressLoadError}
                      </p>
                    )}
                    {addressSaveMessage && (
                      <p
                        style={{
                          color: addressSaveMessage.startsWith("✅")
                            ? "#065f46"
                            : "#b42318",
                          fontSize: 13,
                          marginTop: 8,
                          fontWeight: 600,
                        }}
                      >
                        {addressSaveMessage}
                      </p>
                    )}
                  </div>

                  {/* Billing + Shipping forms */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                      gap: 28,
                    }}
                  >
                    {/* BILLING FORM */}
                    <form
                      onSubmit={saveBillingAddress}
                      style={{ display: "grid", gap: 14 }}
                    >
                      <h3
                        style={{
                          fontSize: 16,
                          margin: 0,
                          color: "#0c2f55",
                          paddingBottom: 10,
                          borderBottom: "1px solid #eef0f3",
                        }}
                      >
                        Billing address
                      </h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>First name *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={billingFirstName}
                            onChange={(e) =>
                              setBillingFirstName(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Last name *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={billingLastName}
                            onChange={(e) =>
                              setBillingLastName(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>
                          Company name (optional)
                        </label>
                        <input
                          className="sf-input"
                          type="text"
                          value={billingCompany}
                          onChange={(e) => setBillingCompany(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Country / Region *</label>
                        <select
                          className="sf-input"
                          required
                          value={billingCountry}
                          onChange={(e) => setBillingCountry(e.target.value)}
                          style={selectStyle}
                        >
                          <option value="India">India</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">
                            United Kingdom
                          </option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="UAE">United Arab Emirates</option>
                          <option value="Singapore">Singapore</option>
                        </select>
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Street address *</label>
                        <input
                          className="sf-input"
                          type="text"
                          required
                          placeholder="House number and street name"
                          value={billingAddress1}
                          onChange={(e) => setBillingAddress1(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 8 }}
                        />
                        <input
                          className="sf-input"
                          type="text"
                          placeholder="Apartment, suite, unit, etc. (optional)"
                          value={billingAddress2}
                          onChange={(e) => setBillingAddress2(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Town / City *</label>
                        <input
                          className="sf-input"
                          type="text"
                          required
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>State / County *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={billingState}
                            onChange={(e) => setBillingState(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>
                            PIN / Postal code *
                          </label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={billingPostcode}
                            onChange={(e) =>
                              setBillingPostcode(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Phone *</label>
                          <input
                            className="sf-input"
                            type="tel"
                            required
                            value={billingPhone}
                            onChange={(e) => setBillingPhone(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Email address *</label>
                          <input
                            className="sf-input"
                            type="email"
                            required
                            value={billingEmail}
                            onChange={(e) => setBillingEmail(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="sf-button-primary"
                        style={{ ...buttonPrimary, marginTop: 4 }}
                      >
                        Save billing address
                      </button>
                    </form>

                    {/* SHIPPING FORM */}
                    <form
                      onSubmit={saveShippingAddress}
                      style={{ display: "grid", gap: 14 }}
                    >
                      <h3
                        style={{
                          fontSize: 16,
                          margin: 0,
                          color: "#0c2f55",
                          paddingBottom: 10,
                          borderBottom: "1px solid #eef0f3",
                        }}
                      >
                        Shipping address
                      </h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>First name *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={shippingFirstName}
                            onChange={(e) =>
                              setShippingFirstName(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Last name *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={shippingLastName}
                            onChange={(e) =>
                              setShippingLastName(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>
                          Company name (optional)
                        </label>
                        <input
                          className="sf-input"
                          type="text"
                          value={shippingCompany}
                          onChange={(e) => setShippingCompany(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Country / Region *</label>
                        <select
                          className="sf-input"
                          required
                          value={shippingCountry}
                          onChange={(e) => setShippingCountry(e.target.value)}
                          style={selectStyle}
                        >
                          <option value="India">India</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">
                            United Kingdom
                          </option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="UAE">United Arab Emirates</option>
                          <option value="Singapore">Singapore</option>
                        </select>
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Street address *</label>
                        <input
                          className="sf-input"
                          type="text"
                          required
                          placeholder="House number and street name"
                          value={shippingAddress1}
                          onChange={(e) =>
                            setShippingAddress1(e.target.value)
                          }
                          style={{ ...inputStyle, marginBottom: 8 }}
                        />
                        <input
                          className="sf-input"
                          type="text"
                          placeholder="Apartment, suite, unit, etc. (optional)"
                          value={shippingAddress2}
                          onChange={(e) =>
                            setShippingAddress2(e.target.value)
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div style={fieldWrapperStyle}>
                        <label style={labelStyle}>Town / City *</label>
                        <input
                          className="sf-input"
                          type="text"
                          required
                          value={shippingCity}
                          onChange={(e) => setShippingCity(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>State / County *</label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={shippingState}
                            onChange={(e) => setShippingState(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>
                            PIN / Postal code *
                          </label>
                          <input
                            className="sf-input"
                            type="text"
                            required
                            value={shippingPostcode}
                            onChange={(e) =>
                              setShippingPostcode(e.target.value)
                            }
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Phone *</label>
                          <input
                            className="sf-input"
                            type="tel"
                            required
                            value={shippingPhone}
                            onChange={(e) => setShippingPhone(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={fieldWrapperStyle}>
                          <label style={labelStyle}>Email address *</label>
                          <input
                            className="sf-input"
                            type="email"
                            required
                            value={shippingEmail}
                            onChange={(e) => setShippingEmail(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="sf-button-primary"
                        style={{ ...buttonPrimary, marginTop: 4 }}
                      >
                        Save shipping address
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ACCOUNT DETAILS */}
              {activeAccountTab === "account_details" && (
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, fontSize: 20 }}>
                    Account details
                  </h2>
                  <form onSubmit={(event) => void handleAccountDetailsSubmit(event)} style={{ display: "grid", gap: 14, maxWidth: 520, marginTop: 12 }}>
                    {accountError && <div role="alert" style={{ color: "#b42318", background: "#fef3f2", padding: 10, borderRadius: 6 }}>{accountError}</div>}
                    {accountMessage && <div role="status" style={{ color: "#067647", background: "#ecfdf3", padding: 10, borderRadius: 6 }}>{accountMessage}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
                      {accountProfileImage ? <img src={getImageUrl(accountProfileImage)} alt="Your profile" style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", border: "1px solid #d0d5dd" }} /> : <div aria-label="Profile image placeholder" style={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: "#eaf0f6", color: "#0c2f55", fontSize: 26, fontWeight: 700 }}>{(accountDisplayName || user?.email || "U").charAt(0).toUpperCase()}</div>}
                      <div style={{ display: "grid", gap: 6 }}><strong>Profile image</strong><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleAccountImageChange(event)} aria-label="Upload profile image" /><small style={{ color: "#667085" }}>JPG, PNG, WEBP or GIF. Maximum 5 MB.</small></div>
                    </div>
                    <div style={fieldWrapperStyle}><label style={labelStyle}>First name</label><input className="sf-input" type="text" value={accountFirstName} onChange={(event) => setAccountFirstName(event.target.value)} placeholder="First name" style={inputStyle} autoComplete="given-name" /></div>
                    <div style={fieldWrapperStyle}><label style={labelStyle}>Last name</label><input className="sf-input" type="text" value={accountLastName} onChange={(event) => setAccountLastName(event.target.value)} placeholder="Last name" style={inputStyle} autoComplete="family-name" /></div>
                    <div style={fieldWrapperStyle}><label style={labelStyle}>Display name *</label><input className="sf-input" type="text" value={accountDisplayName} onChange={(event) => setAccountDisplayName(event.target.value)} placeholder="Display name" style={inputStyle} required autoComplete="nickname" /></div>
                    <div style={fieldWrapperStyle}><label style={labelStyle}>Email address *</label><input className="sf-input" type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com" style={inputStyle} required autoComplete="email" /></div>
                    <h3 style={{ fontSize: 15, marginTop: 12, marginBottom: 0, color: "#0c2f55" }}>Password change</h3>
                    {([
                      { label: "Current password", value: accountCurrentPassword, setter: setAccountCurrentPassword, shown: showAccountCurrentPassword, toggle: setShowAccountCurrentPassword, autoComplete: "current-password" },
                      { label: "New password", value: accountNewPassword, setter: setAccountNewPassword, shown: showAccountNewPassword, toggle: setShowAccountNewPassword, autoComplete: "new-password" },
                      { label: "Confirm new password", value: accountConfirmPassword, setter: setAccountConfirmPassword, shown: showAccountConfirmPassword, toggle: setShowAccountConfirmPassword, autoComplete: "new-password" },
                    ] as const).map((field) => <div key={field.label} style={fieldWrapperStyle}><label style={labelStyle}>{field.label}</label><div style={{ position: "relative", display: "flex", alignItems: "center" }}><input className="sf-input" type={field.shown ? "text" : "password"} value={field.value} onChange={(event) => field.setter(event.target.value)} placeholder="Leave blank to keep current password" style={{ ...inputStyle, paddingRight: 48 }} autoComplete={field.autoComplete} /><button type="button" onClick={() => field.toggle((visible) => !visible)} aria-label={field.shown ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`} title={field.shown ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, border: 0, background: "transparent", cursor: "pointer", padding: 6, fontSize: 18, lineHeight: 1 }}>{field.shown ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>)}
                    <button type="submit" className="sf-button-primary" style={buttonPrimary} disabled={accountSaving}>{accountSaving ? "Saving..." : "Save changes"}</button>
                  </form>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
};

export default Storefront;