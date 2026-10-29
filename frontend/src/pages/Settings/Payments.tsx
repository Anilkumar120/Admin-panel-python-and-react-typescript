
import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { API_URL } from "../../api/config";

type GatewayMode = "test" | "live";
type GatewayId = "razorpay" | "stripe" | "paypal";
type TabId = "store" | GatewayId | "methods" | "bank-upi";

interface GatewaySettings {
  enabled: boolean;
  mode: GatewayMode;
  test_key_id: string;
  test_key_secret: string;
  test_key_secret_configured: boolean;
  live_key_id: string;
  live_key_secret: string;
  live_key_secret_configured: boolean;
}

interface PaymentMethods {
  cards: boolean;
  upi: boolean;
  net_banking: boolean;
  wallets: boolean;
  cod: boolean;
  bank_transfer: boolean;
  international_cards: boolean;
}

interface BankUpiSettings {
  upi_enabled: boolean;
  upi_id: string;
  upi_account_name: string;
  bank_transfer_enabled: boolean;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  payment_instructions: string;
}

interface PaymentSettings {
  razorpay: GatewaySettings;
  stripe: GatewaySettings;
  paypal: GatewaySettings;
  methods: PaymentMethods;
  bank_upi: BankUpiSettings;
  business_name: string;
  currency: string;
}

const emptyGateway = (): GatewaySettings => ({
  enabled: false,
  mode: "test",
  test_key_id: "",
  test_key_secret: "",
  test_key_secret_configured: false,
  live_key_id: "",
  live_key_secret: "",
  live_key_secret_configured: false,
});

const defaultSettings = (): PaymentSettings => ({
  razorpay: emptyGateway(),
  stripe: emptyGateway(),
  paypal: emptyGateway(),

  methods: {
    cards: true,
    upi: true,
    net_banking: true,
    wallets: true,
    cod: true,
    bank_transfer: true,
    international_cards: false,
  },

  bank_upi: {
    upi_enabled: false,
    upi_id: "",
    upi_account_name: "",
    bank_transfer_enabled: false,
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    payment_instructions:
      "Complete the payment and provide your transaction reference for verification.",
  },

  business_name: "",
  currency: "INR",
});

const gatewayInfo: Record<
  GatewayId,
  { title: string; description: string }
> = {
  razorpay: {
    title: "Razorpay",
    description:
      "India payments: UPI, cards, net banking and supported wallets.",
  },
  stripe: {
    title: "Stripe",
    description:
      "Cards and payment methods supported by your Stripe account.",
  },
  paypal: {
    title: "PayPal",
    description:
      "International PayPal checkout where your account is eligible.",
  },
};

const tabs: { id: TabId; label: string }[] = [
  { id: "store", label: "Store Details" },
  { id: "razorpay", label: "Razorpay" },
  { id: "stripe", label: "Stripe" },
  { id: "paypal", label: "PayPal" },
  { id: "methods", label: "Payment Methods" },
  { id: "bank-upi", label: "Bank & UPI Details" },
];

const methodLabels: {
  key: keyof PaymentMethods;
  title: string;
  description: string;
}[] = [
  {
    key: "cards",
    title: "Credit / Debit Cards",
    description:
      "Cards supported by the selected payment gateway.",
  },
  {
    key: "upi",
    title: "UPI / Google Pay / PhonePe / Paytm",
    description:
      "Online UPI availability depends on your gateway and merchant account.",
  },
  {
    key: "net_banking",
    title: "Net Banking",
    description: "Participating banks supported by your provider.",
  },
  {
    key: "wallets",
    title: "Digital Wallets",
    description: "Wallets supported by your payment provider.",
  },
  {
    key: "international_cards",
    title: "International Cards",
    description:
      "Requires a gateway and merchant account enabled for international payments.",
  },
  {
    key: "cod",
    title: "Cash on Delivery",
    description: "Customer pays when the order is delivered.",
  },
  {
    key: "bank_transfer",
    title: "Manual Bank Transfer",
    description:
      "Customer transfers money to the bank account configured in Bank & UPI Details.",
  },
];

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
});

const getErrorMessage = (
  err: unknown,
  fallback: string
): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail)) {
      return (
        detail
          .map((item: { msg?: string }) => item.msg || "")
          .filter(Boolean)
          .join(", ") || fallback
      );
    }

    if (!err.response) {
      return "Unable to connect to the backend API.";
    }
  }

  return fallback;
};

const Payments = () => {
  const [settings, setSettings] =
    useState<PaymentSettings>(defaultSettings);

  const [activeTab, setActiveTab] =
    useState<TabId>("store");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get(
          `${API_URL}/api/settings/payments`,
          { headers: getHeaders() }
        );

        if (!active) return;

        const data = response.data || {};
        const defaults = defaultSettings();
        const oldRazorpayFormat = !data.razorpay;

        setSettings({
          ...defaults,
          ...data,

          razorpay: {
            ...defaults.razorpay,
            ...(data.razorpay || {}),
            ...(oldRazorpayFormat
              ? {
                  enabled: Boolean(data.enabled),
                  mode: data.mode === "live" ? "live" : "test",
                  test_key_id: data.test_key_id || "",
                  test_key_secret_configured: Boolean(
                    data.test_key_secret_configured
                  ),
                  live_key_id: data.live_key_id || "",
                  live_key_secret_configured: Boolean(
                    data.live_key_secret_configured
                  ),
                }
              : {}),
            test_key_secret: "",
            live_key_secret: "",
          },

          stripe: {
            ...defaults.stripe,
            ...(data.stripe || {}),
            test_key_secret: "",
            live_key_secret: "",
          },

          paypal: {
            ...defaults.paypal,
            ...(data.paypal || {}),
            test_key_secret: "",
            live_key_secret: "",
          },

          methods: {
            ...defaults.methods,
            ...(data.methods || {}),
          },

          bank_upi: {
            ...defaults.bank_upi,
            ...(data.bank_upi || {}),
          },

          business_name: data.business_name || "",
          currency: data.currency || "INR",
        });
      } catch (err: unknown) {
        if (!active) return;

        setError(
          axios.isAxiosError(err) && err.response?.status === 404
            ? "Payment settings API was not found. Update the backend route first."
            : getErrorMessage(
                err,
                "Payment settings could not be loaded. Check your login and backend API."
              )
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const updateGateway = <K extends keyof GatewaySettings>(
    gateway: GatewayId,
    field: K,
    value: GatewaySettings[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [gateway]: {
        ...current[gateway],
        [field]: value,
      },
    }));

    setMessage("");
    setError("");
  };

  const updateMethod = (
    method: keyof PaymentMethods,
    enabled: boolean
  ) => {
    setSettings((current) => ({
      ...current,
      methods: {
        ...current.methods,
        [method]: enabled,
      },
    }));

    setMessage("");
    setError("");
  };

  const updateBankUpi = <K extends keyof BankUpiSettings>(
    field: K,
    value: BankUpiSettings[K]
  ) => {
    setSettings((current) => ({
      ...current,
      bank_upi: {
        ...current.bank_upi,
        [field]: value,
      },
    }));

    setMessage("");
    setError("");
  };

  const updateStoreField = (
    field: "business_name" | "currency",
    value: string
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");
    setError("");
  };

  const saveSettings = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    const submitted = {
      ...settings,
      razorpay: { ...settings.razorpay },
      stripe: { ...settings.stripe },
      paypal: { ...settings.paypal },
      methods: { ...settings.methods },
      bank_upi: { ...settings.bank_upi },
    };

    const prepareGateway = (gateway: GatewaySettings) => ({
      ...gateway,
      test_key_secret:
        gateway.test_key_secret || undefined,
      live_key_secret:
        gateway.live_key_secret || undefined,
    });

    const payload = {
      ...submitted,
      razorpay: prepareGateway(submitted.razorpay),
      stripe: prepareGateway(submitted.stripe),
      paypal: prepareGateway(submitted.paypal),
    };

    try {
      await axios.put(
        `${API_URL}/api/settings/payments`,
        payload,
        { headers: getHeaders() }
      );

      setSettings((current) => ({
        ...current,

        razorpay: {
          ...current.razorpay,
          test_key_secret: "",
          live_key_secret: "",
          test_key_secret_configured:
            current.razorpay.test_key_secret_configured ||
            Boolean(submitted.razorpay.test_key_secret),
          live_key_secret_configured:
            current.razorpay.live_key_secret_configured ||
            Boolean(submitted.razorpay.live_key_secret),
        },

        stripe: {
          ...current.stripe,
          test_key_secret: "",
          live_key_secret: "",
          test_key_secret_configured:
            current.stripe.test_key_secret_configured ||
            Boolean(submitted.stripe.test_key_secret),
          live_key_secret_configured:
            current.stripe.live_key_secret_configured ||
            Boolean(submitted.stripe.live_key_secret),
        },

        paypal: {
          ...current.paypal,
          test_key_secret: "",
          live_key_secret: "",
          test_key_secret_configured:
            current.paypal.test_key_secret_configured ||
            Boolean(submitted.paypal.test_key_secret),
          live_key_secret_configured:
            current.paypal.live_key_secret_configured ||
            Boolean(submitted.paypal.live_key_secret),
        },
      }));

      setMessage(
        "Settings submitted successfully. Reload the page to confirm the saved values."
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Settings could not be saved. The backend may need to support the new Bank & UPI fields."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const renderGateway = (gateway: GatewayId) => {
    const item = settings[gateway];

    const keyIdField =
      item.mode === "test" ? "test_key_id" : "live_key_id";

    const secretField =
      item.mode === "test"
        ? "test_key_secret"
        : "live_key_secret";

    const configuredField =
      item.mode === "test"
        ? "test_key_secret_configured"
        : "live_key_secret_configured";

    return (
      <section className="payment-card">
        <div className="payment-toggle">
          <div>
            <h2>{gatewayInfo[gateway].title}</h2>
            <p className="payment-muted">
              {gatewayInfo[gateway].description}
            </p>
          </div>

          <input
            type="checkbox"
            aria-label={`Enable ${gatewayInfo[gateway].title}`}
            checked={item.enabled}
            onChange={(event) =>
              updateGateway(
                gateway,
                "enabled",
                event.target.checked
              )
            }
          />
        </div>

        <div className="payment-grid">
          <label className="payment-field">
            Gateway Mode
            <select
              value={item.mode}
              onChange={(event) =>
                updateGateway(
                  gateway,
                  "mode",
                  event.target.value as GatewayMode
                )
              }
            >
              <option value="test">Test / Sandbox</option>
              <option value="live">Live / Production</option>
            </select>
          </label>

          <label className="payment-field">
            {item.mode === "test" ? "Test" : "Live"} Key ID
            <input
              value={item[keyIdField]}
              onChange={(event) =>
                updateGateway(
                  gateway,
                  keyIdField,
                  event.target.value
                )
              }
              autoComplete="off"
              placeholder="Enter public key ID"
            />
          </label>

          <label className="payment-field">
            {item.mode === "test" ? "Test" : "Live"} Secret Key
            <input
              type={showSecrets ? "text" : "password"}
              value={item[secretField]}
              onChange={(event) =>
                updateGateway(
                  gateway,
                  secretField,
                  event.target.value
                )
              }
              autoComplete="new-password"
              placeholder={
                item[configuredField]
                  ? "Saved — leave blank to keep existing secret"
                  : "Enter secret key"
              }
            />

            {item[configuredField] && (
              <small className="payment-muted">
                Secret configured. Leave blank to retain it.
              </small>
            )}
          </label>
        </div>

        {gateway === "razorpay" && (
          <p className="payment-muted">
            Webhook URL: {API_URL}/api/public/payments/webhook
          </p>
        )}

        <p className="payment-muted">
          Saving gateway keys alone does not implement checkout
          or payment verification.
        </p>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="payment-settings-page">
        <h1>Payments &amp; Notifications</h1>
        <p>Loading payment settings...</p>
      </div>
    );
  }

  return (
    <div className="payment-settings-page">
      <style>{`
        .payment-settings-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px;
          color: var(--text-color, #172033);
        }
        .payment-settings-page * { box-sizing: border-box; }
        .payment-settings-page .payment-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 18px 0;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border-color, #e1e6ef);
        }
        .payment-settings-page .payment-tab {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 15px;
          background: var(--card-bg, #fff);
          color: inherit;
          cursor: pointer;
        }
        .payment-settings-page .payment-tab.active {
          background: #0c2f55;
          border-color: #0c2f55;
          color: #fff;
        }
        .payment-settings-page .payment-card {
          background: var(--card-bg, #fff);
          border: 1px solid var(--border-color, #e1e6ef);
          border-radius: 12px;
          padding: 22px;
          margin: 18px 0;
          min-width: 0;
        }
        .payment-settings-page .payment-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          padding-top: 25px;
        }
        .payment-settings-page .payment-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        .payment-settings-page input:not([type="checkbox"]),
        .payment-settings-page select,
        .payment-settings-page textarea {
          width: 100%;
          min-height: 42px;
          padding: 9px 11px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: var(--input-bg, #fff);
          color: inherit;
          font: inherit;
        }
        .payment-settings-page textarea {
          min-height: 100px;
          resize: vertical;
        }
        .payment-settings-page input[type="checkbox"] {
          width: 19px;
          height: 19px;
          min-width: 19px;
          min-height: 19px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .payment-settings-page .payment-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .payment-settings-page .payment-toggle:last-child {
          border-bottom: 0;
        }
        .payment-settings-page .payment-muted {
          color: #64748b;
          font-size: 13px;
          margin: 15px 5px;
          overflow-wrap: anywhere;
        }
        .payment-settings-page .payment-alert {
          padding: 12px 14px;
          border-radius: 8px;
          margin: 12px 0;
          overflow-wrap: anywhere;
        }
        .payment-settings-page .payment-error {
          background: #fff1f2;
          color: #9f1239;
        }
        .payment-settings-page .payment-success {
          background: #ecfdf5;
          color: #065f46;
        }
        .payment-settings-page .payment-button {
          border: 0;
          border-radius: 8px;
          padding: 12px 20px;
          color: #fff;
          background: #0c2f55;
          cursor: pointer;
          font-weight: 600;
        }
        .payment-settings-page .payment-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        @media (max-width: 650px) {
          .payment-settings-page { padding: 14px; }
          .payment-settings-page .payment-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .payment-settings-page .payment-card { padding: 16px; }
          .payment-settings-page .payment-tab {
            flex: 1 1 auto;
          }
        }
      `}</style>

      <header>
        <h1>Payments &amp; Notifications</h1>
        <p>
          Configure gateways, manual bank details and checkout payment methods.
        </p>
      </header>

      {error && (
        <div className="payment-alert payment-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="payment-alert payment-success" role="status">
          {message}
        </div>
      )}

      <nav className="payment-tabs" aria-label="Payment settings tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`payment-tab ${
              activeTab === tab.id ? "active" : ""
            }`}
            aria-pressed={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setMessage("");
              setError("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <form onSubmit={saveSettings}>
        {activeTab === "store" && (
          <section className="payment-card">
            <h2>Store Details</h2>

            <div className="payment-grid">
              <label className="payment-field">
                Business / Store Name
                <input
                  value={settings.business_name}
                  onChange={(event) =>
                    updateStoreField(
                      "business_name",
                      event.target.value
                    )
                  }
                  placeholder="Your business name"
                />
              </label>

              <label className="payment-field">
                Store Currency
                <select
                  value={settings.currency}
                  onChange={(event) =>
                    updateStoreField("currency", event.target.value)
                  }
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                </select>
                <small className="payment-muted">
                  The backend and gateway must support the selected currency.
                </small>
              </label>
            </div>
          </section>
        )}

        {(activeTab === "razorpay" ||
          activeTab === "stripe" ||
          activeTab === "paypal") &&
          renderGateway(activeTab)}

        {activeTab === "methods" && (
          <section className="payment-card">
            <h2>Checkout Payment Methods</h2>
            <p className="payment-muted">
              These settings are preferences. The backend must enforce
              them and expose only supported payment methods.
            </p>

            {methodLabels.map((method) => (
              <label className="payment-toggle" key={method.key}>
                <div>
                  <strong>{method.title}</strong>
                  <p className="payment-muted">
                    {method.description}
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.methods[method.key]}
                  onChange={(event) =>
                    updateMethod(method.key, event.target.checked)
                  }
                />
              </label>
            ))}
          </section>
        )}

        {activeTab === "bank-upi" && (
          <>
            <section className="payment-card">
              <h2>Manual UPI Payment</h2>
              <p className="payment-muted">
                Enter the UPI details customers should use for manual payments.
                This is separate from automatic gateway checkout.
              </p>

              <label className="payment-toggle">
                <div>
                  <strong>Enable Manual UPI</strong>
                  <p className="payment-muted">
                    Allow customers to view your UPI details at checkout.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.bank_upi.upi_enabled}
                  onChange={(event) =>
                    updateBankUpi("upi_enabled", event.target.checked)
                  }
                />
              </label>

              <div className="payment-grid">
                <label className="payment-field">
                  Admin UPI ID
                  <input
                    value={settings.bank_upi.upi_id}
                    onChange={(event) =>
                      updateBankUpi("upi_id", event.target.value.trimStart())
                    }
                    placeholder="business@bank"
                    autoComplete="off"
                  />
                </label>

                <label className="payment-field">
                  UPI Account Holder Name
                  <input
                    value={settings.bank_upi.upi_account_name}
                    onChange={(event) =>
                      updateBankUpi("upi_account_name", event.target.value)
                    }
                    placeholder="Account holder or business name"
                  />
                </label>
              </div>
            </section>

            <section className="payment-card">
              <h2>Bank Account Details</h2>
              <p className="payment-muted">
                Customers can use these details to make a manual bank transfer.
              </p>

              <label className="payment-toggle">
                <div>
                  <strong>Enable Bank Transfer</strong>
                  <p className="payment-muted">
                    Allow customers to view your bank account details.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.bank_upi.bank_transfer_enabled}
                  onChange={(event) =>
                    updateBankUpi(
                      "bank_transfer_enabled",
                      event.target.checked
                    )
                  }
                />
              </label>

              <div className="payment-grid">
                <label className="payment-field">
                  Account Holder / Business Name
                  <input
                    value={settings.bank_upi.account_holder_name}
                    onChange={(event) =>
                      updateBankUpi(
                        "account_holder_name",
                        event.target.value
                      )
                    }
                    placeholder="Exact bank account holder name"
                  />
                </label>

                <label className="payment-field">
                  Bank Name
                  <input
                    value={settings.bank_upi.bank_name}
                    onChange={(event) =>
                      updateBankUpi("bank_name", event.target.value)
                    }
                    placeholder="Bank name"
                  />
                </label>

                <label className="payment-field">
                  Account Number
                  <input
                    type="password"
                    value={settings.bank_upi.account_number}
                    onChange={(event) =>
                      updateBankUpi(
                        "account_number",
                        event.target.value.replace(/\s/g, "")
                      )
                    }
                    autoComplete="off"
                    placeholder="Enter account number"
                  />
                </label>

                <label className="payment-field">
                  IFSC Code
                  <input
                    value={settings.bank_upi.ifsc_code}
                    onChange={(event) =>
                      updateBankUpi(
                        "ifsc_code",
                        event.target.value.toUpperCase().replace(/\s/g, "")
                      )
                    }
                    placeholder="ABCD0123456"
                    autoComplete="off"
                  />
                </label>

                <label className="payment-field">
                  Branch Name (Optional)
                  <input
                    value={settings.bank_upi.branch_name}
                    onChange={(event) =>
                      updateBankUpi("branch_name", event.target.value)
                    }
                    placeholder="Bank branch"
                  />
                </label>
              </div>

              <label className="payment-field" style={{ marginTop: 18 }}>
                Customer Payment Instructions
                <textarea
                  value={settings.bank_upi.payment_instructions}
                  onChange={(event) =>
                    updateBankUpi(
                      "payment_instructions",
                      event.target.value
                    )
                  }
                  placeholder="Explain how the customer should pay and submit a transaction reference."
                  rows={4}
                />
              </label>

              <div className="payment-alert payment-error">
                Bank details are sensitive business information. Store them
                securely on the backend and return them only to authorized
                administrators or the public checkout fields that customers
                are meant to see.
              </div>
            </section>
          </>
        )}

        <section className="payment-card">
          <label className="payment-toggle">
            <div>
              <strong>Show secret keys while editing</strong>
              <p className="payment-muted">
                Keep this disabled when possible.
              </p>
            </div>

            <input
              type="checkbox"
              checked={showSecrets}
              onChange={(event) => setShowSecrets(event.target.checked)}
            />
          </label>

          <p className="payment-muted">
            Save changes from any tab. Never share live gateway secrets
            or commit them to source control.
          </p>

          <button
            className="payment-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Payment Settings"}
          </button>
        </section>
      </form>
    </div>
  );
};

export default Payments;
