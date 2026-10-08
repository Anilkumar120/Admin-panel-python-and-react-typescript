import { useState, type FormEvent } from "react";

import { Link, useNavigate, useSearchParams } from "react-router-dom";

import axios from "axios";

import { API_URL } from "../../api/config";

const ResetPassword = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");

      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");

      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        password,
      });

      setSuccess("Password reset successfully. Please login.");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error: any) {
      console.log("RESET PASSWORD ERROR:", error);

      console.log("RESET PASSWORD RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Reset Password</h1>

        <p>Create a new password</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label>New Password</label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>

          <div>
            <label>Confirm Password</label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          {success && <div>{success}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div>
          <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
