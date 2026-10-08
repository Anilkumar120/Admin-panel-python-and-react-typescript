import { useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router-dom";

import axios from "axios";

import { API_URL } from "../../api/config";

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

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

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/register`, {
        name,
        email,
        password,
      });

      setSuccess("Registration successful. Please login.");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error: any) {
      console.log("REGISTER ERROR:", error);

      console.log("REGISTER RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Registration failed");
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
            <label>Name</label>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter name"
              required
            />
          </div>

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

          <div>
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <div>
            <label>Confirm Password</label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          {success && <div>{success}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div>
          <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
