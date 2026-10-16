import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../api/config";

interface PaymentSettings {
  enabled: boolean;
  mode: "test" | "live";
  test_key_id: string;
  test_key_secret: string;
  test_key_secret_configured: boolean;
  live_key_id: string;
  live_key_secret: string;
  live_key_secret_configured: boolean;
  webhook_secret: string;
  webhook_secret_configured: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_password_configured: boolean;
  smtp_from_email: string;
  admin_notification_email: string;
}

const emptySettings: PaymentSettings = {
  enabled: false,
  mode: "test",
  test_key_id: "",
  test_key_secret: "",
  test_key_secret_configured: false,
  live_key_id: "",
  live_key_secret: "",
  live_key_secret_configured: false,
  webhook_secret: "",
  webhook_secret_configured: false,
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_password_configured: false,
  smtp_from_email: "",
  admin_notification_email: "",
};

const headers = () => ({
  Authorization: `******`,
});

const Payments = () => {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_URL}/api/settings/payments`, { headers: headers() })
      .then(({ data }) => setSettings({ ...emptySettings, ...data }))
      .catch((loadError) => {
        console.error("LOAD PAYMENT SETTINGS ERROR:", loadError);
        setError("Unable to load payment settings.");
      })
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await axios.put(`${API_URL}/api/settings/payments`, settings, {
        headers: headers(),
      });
      setMessage("Payment settings saved. Secrets are stored encrypted and are never sent back to the browser.");
      setSettings((current) => ({
        ...current,
        test_key_secret: "",
        live_key_secret: "",
        webhook_secret: "",
        smtp_password: "",
        test_key_secret_configured: current.test_key_secret_configured || Boolean(current.test_key_secret),
        live_key_secret_configured: current.live_key_secret_configured || Boolean(current.live_key_secret),
        webhook_secret_configured: current.webhook_secret_configured || Boolean(current.webhook_secret),
        smtp_password_configured: current.smtp_password_configured || Boolean(current.smtp_password),
      }));
    } catch (saveError) {
      console.error("SAVE PAYMENT SETTINGS ERROR:", saveError);
      setError(
        axios.isAxiosError(saveError)
          ? String(saveError.response?.data?.detail || "Unable to save payment settings.")
          : "Unable to save payment settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="content-page"><p>Loading payment settings…</p></div>;

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Payments</h1>
          <p>Configure Razorpay checkout and order email notifications.</p>
        </div>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>Razorpay</h2>
            <p>Use test keys for testing. Switch to live only after verifying your account and webhook.</p>
          </div>
        </div>
        <div className="content-form">
          <label>
            <input type="checkbox" checked={settings.enabled} onChange={(event) => set("enabled", event.target.checked)} />
            {" "}Enable Razorpay online payments
          </label>
          <div className="content-form-group">
            <label htmlFor="razorpay-mode">Mode</label>
            <select id="razorpay-mode" value={settings.mode} onChange={(event) => set("mode", event.target.value as "test" | "live")}>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div className="content-form-group">
            <label htmlFor="test-key-id">Test key ID</label>
            <input id="test-key-id" value={settings.test_key_id} onChange={(event) => set("test_key_id", event.target.value)} autoComplete="off" />
            <label htmlFor="test-key-secret">Test key secret</label>
            <input id="test-key-secret" type="password" value={settings.test_key_secret} onChange={(event) => set("test_key_secret", event.target.value)} placeholder={settings.test_key_secret_configured ? "Saved; leave blank to keep current secret" : "Enter test secret"} autoComplete="new-password" />
          </div>
          <div className="content-form-group">
            <label htmlFor="live-key-id">Live key ID</label>
            <input id="live-key-id" value={settings.live_key_id} onChange={(event) => set("live_key_id", event.target.value)} autoComplete="off" />
            <label htmlFor="live-key-secret">Live key secret</label>
            <input id="live-key-secret" type="password" value={settings.live_key_secret} onChange={(event) => set("live_key_secret", event.target.value)} placeholder={settings.live_key_secret_configured ? "Saved; leave blank to keep current secret" : "Enter live secret"} autoComplete="new-password" />
          </div>
          <div className="content-form-group">
            <label htmlFor="razorpay-webhook-secret">Webhook secret</label>
            <input id="razorpay-webhook-secret" type="password" value={settings.webhook_secret} onChange={(event) => set("webhook_secret", event.target.value)} placeholder={settings.webhook_secret_configured ? "Saved; leave blank to keep current secret" : "Enter webhook secret"} autoComplete="new-password" />
            <small>Webhook URL: <code>{API_URL}/api/public/payments/webhook</code></small>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h2>Order Email Notifications</h2>
            <p>When SMTP is configured, a new-order notification is sent to the customer and the admin recipient.</p>
          </div>
        </div>
        <div className="content-form">
          <div className="content-form-group">
            <label htmlFor="smtp-host">SMTP host</label>
            <input id="smtp-host" value={settings.smtp_host} onChange={(event) => set("smtp_host", event.target.value)} />
            <label htmlFor="smtp-port">SMTP port</label>
            <input id="smtp-port" type="number" min={1} max={65535} value={settings.smtp_port} onChange={(event) => set("smtp_port", Number(event.target.value))} />
          </div>
          <div className="content-form-group">
            <label htmlFor="smtp-username">SMTP username</label>
            <input id="smtp-username" value={settings.smtp_username} onChange={(event) => set("smtp_username", event.target.value)} autoComplete="off" />
            <label htmlFor="smtp-password">SMTP password</label>
            <input id="smtp-password" type="password" value={settings.smtp_password} onChange={(event) => set("smtp_password", event.target.value)} placeholder={settings.smtp_password_configured ? "Saved; leave blank to keep current password" : "Enter SMTP password"} autoComplete="new-password" />
          </div>
          <div className="content-form-group">
            <label htmlFor="smtp-from">From email</label>
            <input id="smtp-from" type="email" value={settings.smtp_from_email} onChange={(event) => set("smtp_from_email", event.target.value)} />
            <label htmlFor="admin-notification-email">Admin notification email</label>
            <input id="admin-notification-email" type="email" value={settings.admin_notification_email} onChange={(event) => set("admin_notification_email", event.target.value)} />
          </div>
        </div>
      </div>

      {error && <div role="alert" className="content-message-error">{error}</div>}
      {message && <div className="content-message-success">{message}</div>}
      <div className="content-form-actions">
        <button type="button" className="content-primary-button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default Payments;
