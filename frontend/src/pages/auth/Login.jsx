import { useState } from "react";
import { User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../../services/authService";
import { saveTokens } from "../../utils/token";
import { useAuth } from "../../context/AuthContext";
import login_image from "../../assets/login-1.jpg";
import { useSeo } from "../../seo/useSeo";

function Login() {
  useSeo({
    title: "ورود به حساب کاربری | مووی‌ورس",
    description: "وارد حساب مووی‌ورس شوید تا به لیست علاقه‌مندی‌ها و دانلودهای VIP دسترسی داشته باشید.",
    path: "/login",
    noindex: true,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const from = location.state?.from || "/";
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  const { refreshUser } = useAuth();

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!loginData.username || !loginData.password) {
      alert("Please fill in all login fields.");
      return;
    }

    try {
      const data = await login(loginData.username, loginData.password);
      saveTokens(data.access, data.refresh);
      await refreshUser();
      navigate(from, { replace: true });
      // window.location.href = "/";
    } catch (err) {
      console.error("Login error:", err.response?.data || err);
      alert("Login failed: " + JSON.stringify(err.response?.data || {}));
    }
  };

  return (
    <div className="min-h-screen bg-[#1e0c0d] text-white">
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_bottom_left,[#08040d],transparent_28%),linear-gradient(90deg,#030b2f_0%,#020726_45%,#020726_100%)]">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="absolute left-5 top-5 z-20 text-white/80 transition hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="mx-auto flex min-h-screen flex-col items-center gap-28 px-6 py-10 lg:flex-row lg:items-center lg:justify-center lg:px-10">
          {/* Left Side */}
          <div className="z-10 w-full max-w-sm lg:max-w-md">
            <h1 className="mb-8 text-5xl font-semibold tracking-tight text-white lg:text-6xl">
              مووی<span className="text-rose-500">ورس</span>
            </h1>

            <br />

            <div className="mb-14 flex items-center gap-10 text-xl font-semibold uppercase">
              <button
                type="button"
                className="relative pb-2 text-white transition"
              >
                ورود
                <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-rose-500" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/register")}
                className="relative pb-2 text-white/75 transition hover:text-white"
              >
                ثبت نام
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-8">
              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    name="username"
                    value={loginData.username}
                    onChange={handleLoginChange}
                    placeholder="نام کاربری"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 pr-12 text-white placeholder:text-white/45 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  />
                  <User
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="رمز عبور"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 pr-12 text-white placeholder:text-white/45 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-white/70 transition hover:text-white"
                >
                  رمز عبورم را فراموش کرده‌ام
                </button>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="mx-auto block w-full max-w-[170px] rounded-xl bg-rose-500 px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                >
                  ورود
                </button>
              </div>
            </form>
          </div>

          {/* Right Side Image */}
          <div className="">
            <div className="overflow-hidden rounded-[28px] bg-[#06113a] shadow-2xl">
              <img
                src={login_image}
                alt="Fantasy visual"
                className="h-[300px] w-full max-w-[1300px] object-cover md:h-[500px] lg:h-[500px] xl:h-[800px] mx-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
