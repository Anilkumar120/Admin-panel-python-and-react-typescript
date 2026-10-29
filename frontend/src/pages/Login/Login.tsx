import { Eye, EyeOff } from "lucide-react";
import {
    useState,
    type FormEvent
} from "react";

import {
    Link,
    useNavigate
} from "react-router-dom";

import {
    useAuth
} from "../../context/AuthContext";

import {
    loginUser
} from "../../api/auth";


const Login = () => {

    const navigate = useNavigate();

    const {
        login
    } = useAuth();

    const [email, setEmail] = useState("");

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState("");

    const [loading, setLoading] = useState(false);


    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>
    ) => {

        event.preventDefault();

        setError("");

        setLoading(true);

        try {

            const response = await loginUser(
                email,
                password
            );

            login(
                response.access_token,
                response.user,
                response.refresh_token
            );

            navigate(
                "/admin/dashboard"
            );

        } catch (error: any) {

            console.log(
                "LOGIN ERROR:",
                error
            );

            console.log(
                "LOGIN RESPONSE:",
                error.response?.data
            );

            setError(
                error.response?.data?.detail ||
                "Login failed"
            );

        } finally {

            setLoading(false);

        }
    };


    return (

        <div className="login-page">

            <div className="login-box">

                <h1>
                    Admin Login
                </h1>

                <p>
                    Smart Inventory
                </p>

                <form
                    onSubmit={handleSubmit}
                >

                    <div>

                        <label>
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(
                                    event.target.value
                                )
                            }
                            placeholder="Enter email"
                            required
                        />

                    </div>


                    <div>

                        <label>
                            Password
                        </label>

                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                required
                                style={{ paddingRight: 48, width: "100%" }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((visible) => !visible)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                title={showPassword ? "Hide password" : "Show password"}
                                style={{ position: "absolute", right: 8, border: 0, background: "transparent", cursor: "pointer", padding: 6, fontSize: 18, lineHeight: 1 }}
                            >{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        </div>

                    </div>


                    {error && (

                        <div className="login-error">

                            {error}

                        </div>

                    )}


                    <button
                        type="submit"
                        disabled={loading}
                    >

                        {loading
                            ? "Logging in..."
                            : "Login"
                        }

                    </button>

                </form>


                <div>

                    <Link
                        to="/register"
                    >

                        <button
                            type="button"
                        >
                            Register
                        </button>

                    </Link>

                </div>


                <div>

                    <Link
                        to="/forgot-password"
                    >
                        Forgot Password?
                    </Link>

                </div>

            </div>
        </div>
    );
};

export default Login;