import { useState, type FormEvent } from "react";

import { Link } from "react-router-dom";

import axios from "axios";

import { API_URL } from "../../api/config";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    setSuccess("");

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email,
      });

      setSuccess("Password reset link has been sent to your email.");
    } catch (error: any) {
      console.log("FORGOT PASSWORD ERROR:", error);

      console.log("FORGOT PASSWORD RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Forgot Password</h1>

        <p>Enter your email to reset your password</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          {success && <div>{success}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Reset Password"}
          </button>
        </form>

        <div>
          <Link to="/login">Login</Link>

          {" | "}

          <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
