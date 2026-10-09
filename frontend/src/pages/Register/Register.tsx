
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../../api/config";

interface ValidationError {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // Send form fields to the registration endpoint.
      // This format is suitable if auth.py uses Form(...).
      const formData = new FormData();

      formData.append("name", name.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("password", password);

      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        formData
      );

      console.log("REGISTER SUCCESS:", response.data);

      setSuccess("Registration successful. Please login.");

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: unknown) {
      console.error("REGISTER ERROR:", err);

      if (axios.isAxiosError(err)) {
        const responseData = err.response?.data;
        const detail = responseData?.detail;

        console.error("REGISTER RESPONSE:", responseData);

        if (Array.isArray(detail)) {
          const messages = detail.map(
            (item: ValidationError) => {
              const field = item.loc
                ?.filter((part) => part !== "body")
                .join(".");

              return `${field || "Validation error"}: ${
                item.msg || "Invalid input"
              }`;
            }
          );

          setError(messages.join(" | "));
        } else if (typeof detail === "string") {
          setError(detail);
        } else if (typeof responseData?.message === "string") {
          setError(responseData.message);
        } else if (!err.response) {
          setError(
            "Cannot connect to the server. Please check your backend."
          );
        } else {
          setError(
            `Registration failed (${err.response.status}). Please try again.`
          );
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Admin Register</h1>

        <p>Create your account</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="register-name">Name</label>

            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter name"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label htmlFor="register-email">Email</label>

            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="register-password">Password</label>

            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div>
            <label htmlFor="register-confirm-password">
              Confirm Password
            </label>

            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="login-success" role="status">
              {success}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div>
          <Link to="/login">Already have an account? Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;