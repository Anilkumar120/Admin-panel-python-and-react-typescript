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

                        <input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(
                                    event.target.value
                                )
                            }
                            placeholder="Enter password"
                            required
                        />

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