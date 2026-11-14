import { useEffect, useState } from "react";
import { LifeBuoy, Loader2, Lock, LogIn, User } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../../services/authService";
import { saveTokens } from "../../utils/token";
import { useAuth } from "../../context/AuthContext";
import login_image from "../../assets/login-1.jpg";
import { useSeo } from "../../seo/useSeo";
import AuthShell, { GeneralError, PasswordField, TextField } from "./authShared";
import { BRAND, parseApiErrors } from "./authUtils";

function Login() {
  useSeo({
    title: "ورود به حساب کاربری | مووی‌ورس",
    description: "وارد حساب مووی‌ورس شوید تا به لیست علاقه‌مندی‌ها و دانلودهای VIP دسترسی داشته باشید.",
    path: "/login",
    noindex: true,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const from = location.state?.from || "/";

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // اگر از قبل وارد شده، فرم را نشان نده
  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [authLoading, user, from, navigate]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setGeneralError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.username.trim()) errors.username = "نام کاربری را وارد کنید.";
    if (!form.password) errors.password = "رمز عبور را وارد کنید.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    setGeneralError("");
    try {
      const data = await login(form.username.trim(), form.password);
      saveTokens(data.access, data.refresh);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      const { general, fields } = parseApiErrors(err, "ورود ناموفق بود؛ دوباره تلاش کنید.");
      // خطای اعتبارنامه (رمز اشتباه/حساب ناموجود) را هم زیر رمز عبور نشان بده
      // هم به‌صورت بنر، تا کاربر حتماً متوجه شود.
      if (err?.response?.status === 401) {
        setFieldErrors({ password: general || "نام کاربری یا رمز عبور اشتباه است." });
      } else {
        setFieldErrors(fields);
      }
      setGeneralError(general);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      activeTab="login"
      image={login_image}
      imageAlt="ورود به مووی‌ورس"
      title="خوش برگشتی! 👋"
      subtitle="برای ادامه وارد حسابت شو تا به لیست تماشا، علاقه‌مندی‌ها و دانلودهای VIP دسترسی داشته باشی."
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <GeneralError message={generalError} />

        <TextField
          icon={User}
          type="text"
          name="username"
          value={form.username}
          onChange={change}
          placeholder="نام کاربری"
          autoComplete="username"
          autoFocus
          error={fieldErrors.username}
        />

        <PasswordField
          value={form.password}
          onChange={change}
          placeholder="رمز عبور"
          autoComplete="current-password"
          error={fieldErrors.password}
          show={showPassword}
          onToggleShow={() => setShowPassword((p) => !p)}
        />

        <div className="flex items-center justify-between text-sm">
          <Link to="/support" className="inline-flex items-center gap-1.5 text-white/60 transition hover:text-white">
            <LifeBuoy className="h-4 w-4" />
            رمز عبورم را فراموش کرده‌ام
          </Link>
          <Link to="/register" className="font-semibold text-rose-300 transition hover:text-rose-200">
            حساب ندارم؛ ثبت‌نام
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl ${BRAND} px-5 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(225,29,72,0.3)] transition hover:opacity-90 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {submitting ? "در حال بررسی..." : "ورود به حساب"}
        </button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-white/40">
          <Lock className="h-3.5 w-3.5" />
          اطلاعات ورود شما به‌صورت امن ارسال می‌شود.
        </p>
      </form>
    </AuthShell>
  );
}

export default Login;
