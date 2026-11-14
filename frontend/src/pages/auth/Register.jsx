import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ChevronRight, ImagePlus, Loader2, Lock, Mail, PartyPopper, SkipForward, User, UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../../services/authService";
import { saveTokens } from "../../utils/token";
import { useAuth } from "../../context/AuthContext";
import { useSeo } from "../../seo/useSeo";
import AuthShell, { GeneralError, PasswordField, TextField } from "./authShared";
import { BRAND, parseApiErrors, passwordStrength } from "./authUtils";

import for_login from "../../assets/for-login.webp";
import avatar1 from "../../assets/avatars/1.webp";
import avatar2 from "../../assets/avatars/2.webp";
import avatar3 from "../../assets/avatars/3.webp";
import avatar4 from "../../assets/avatars/4.webp";
import avatar5 from "../../assets/avatars/5.webp";
import avatar6 from "../../assets/avatars/6.webp";
import avatar7 from "../../assets/avatars/7.webp";
import avatar8 from "../../assets/avatars/8.webp";
import avatar9 from "../../assets/avatars/9.webp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Register() {
  useSeo({
    title: "ثبت‌نام | مووی‌ورس",
    description: "در مووی‌ورس رایگان ثبت‌نام کنید و لیست علاقه‌مندی‌ها و تماشای خود را بسازید.",
    path: "/register",
    noindex: true,
  });

  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [step, setStep] = useState("auth"); // auth | avatar | success
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null); // {type: 'url'|'file', value, file?}

  const avatarList = useMemo(
    () => [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8, avatar9],
    []
  );
  const strength = passwordStrength(form.password);

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [authLoading, user, navigate]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setGeneralError("");
  };

  const validateAuthStep = () => {
    const errors = {};
    const username = form.username.trim();
    if (!username) errors.username = "نام کاربری را وارد کنید.";
    else if (username.length < 3) errors.username = "نام کاربری باید حداقل ۳ نویسه باشد.";
    else if (/\s/.test(username)) errors.username = "نام کاربری نمی‌تواند فاصله داشته باشد.";
    if (!form.email.trim()) errors.email = "ایمیل را وارد کنید.";
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = "ایمیل معتبر نیست.";
    if (!form.password) errors.password = "رمز عبور را وارد کنید.";
    else if (form.password.length < 8) errors.password = "رمز عبور باید حداقل ۸ نویسه باشد.";
    if (!form.confirmPassword) errors.confirmPassword = "تکرار رمز عبور را وارد کنید.";
    else if (form.password !== form.confirmPassword) errors.confirmPassword = "رمز عبور و تکرار آن با هم مطابقت ندارند.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goAvatarStep = (e) => {
    e.preventDefault();
    if (validateAuthStep()) setStep("avatar");
  };

  const handleUploadAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedAvatar({ type: "file", value: URL.createObjectURL(file), file });
    e.target.value = "";
  };

  const finalSignup = async (e) => {
    e?.preventDefault();
    if (!validateAuthStep()) {
      setStep("auth");
      return;
    }
    setSubmitting(true);
    setGeneralError("");
    try {
      const formData = new FormData();
      formData.append("username", form.username.trim());
      formData.append("email", form.email.trim());
      formData.append("password", form.password);
      formData.append("password2", form.confirmPassword);
      if (selectedAvatar?.type === "file" && selectedAvatar.file) {
        formData.append("avatar", selectedAvatar.file);
      } else if (selectedAvatar?.type === "url" && selectedAvatar.value) {
        try {
          const resp = await fetch(selectedAvatar.value);
          const blob = await resp.blob();
          const fileName = selectedAvatar.value.split("/").pop() || "avatar.webp";
          formData.append("avatar", new File([blob], fileName, { type: blob.type }));
        } catch { /* آواتار پیش‌فرض اختیاری است؛ بدون آن ادامه بده */ }
      }
      await register(formData);

      // ورود خودکار بعد از ثبت‌نام موفق؛ اگر نشد، صفحه‌ی موفقیت با دکمه‌ی ورود
      try {
        const data = await login(form.username.trim(), form.password);
        saveTokens(data.access, data.refresh);
        await refreshUser();
        navigate("/", { replace: true });
      } catch {
        setStep("success");
      }
    } catch (err) {
      const { general, fields } = parseApiErrors(err, "ثبت‌نام ناموفق بود؛ دوباره تلاش کنید.");
      setFieldErrors(fields);
      setGeneralError(general);
      // خطاهای فیلدهای مرحله‌ی اول (نام کاربری تکراری و…) باید همان‌جا دیده شوند
      if (fields.username || fields.email || fields.password || fields.password2) setStep("auth");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- مرحله‌ی موفقیت (فقط وقتی ورود خودکار ممکن نشده) ----------
  if (step === "success") {
    return (
      <AuthShell
        activeTab="register"
        image={for_login}
        imageAlt="ثبت‌نام در مووی‌ورس"
        title="حسابت ساخته شد! 🎉"
        subtitle="ثبت‌نام با موفقیت انجام شد. حالا می‌توانی وارد حسابت شوی."
      >
        <div className="flex flex-col items-center text-center">
          <div className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-full ${BRAND} shadow-[0_20px_50px_rgba(225,29,72,0.35)] ring-4 ring-white/10`}>
            {selectedAvatar
              ? <img src={selectedAvatar.value} alt="آواتار شما" className="h-full w-full object-cover" />
              : <PartyPopper className="h-12 w-12 text-white" />}
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/80">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            {form.username} عزیز، به مووی‌ورس خوش آمدی
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className={`mt-6 w-full rounded-2xl ${BRAND} px-5 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(225,29,72,0.3)] transition hover:opacity-90`}
          >
            ورود به حساب
          </button>
        </div>
      </AuthShell>
    );
  }

  // ---------- مرحله‌ی انتخاب آواتار ----------
  if (step === "avatar") {
    return (
      <AuthShell
        activeTab="register"
        image={for_login}
        imageAlt="ثبت‌نام در مووی‌ورس"
        title="یک آواتار انتخاب کن"
        subtitle="این تصویر کنار اسمت نمایش داده می‌شود. آواتار اختیاری است و بعداً هم می‌توانی عوضش کنی."
      >
        <form onSubmit={finalSignup} className="space-y-5">
          <GeneralError message={generalError} />

          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-rose-400/40">
              {selectedAvatar
                ? <img src={selectedAvatar.value} alt="آواتار انتخابی" className="h-full w-full object-cover" />
                : <User className="h-9 w-9 text-white/60" />}
            </div>
            <div className="text-sm leading-6 text-white/65">
              <p className="font-semibold text-white">{form.username}</p>
              <p>{selectedAvatar ? "آواتار انتخاب شد؛ اگر خواستی از گالری زیر عوضش کن." : "از گالری زیر انتخاب کن یا عکس خودت را آپلود کن."}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {avatarList.map((src, i) => {
              const active = selectedAvatar?.type === "url" && selectedAvatar.value === src;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedAvatar({ type: "url", value: src })}
                  aria-pressed={active}
                  className={`overflow-hidden rounded-2xl ring-2 transition hover:scale-[1.03] ${active ? "ring-rose-400" : "ring-white/10 hover:ring-white/30"}`}
                >
                  <img src={src} alt={`آواتار ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3.5 text-sm text-white/75 transition hover:border-rose-400/40 hover:text-white">
            <ImagePlus className="h-4 w-4" />
            آپلود عکس از دستگاه
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("auth")}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              بازگشت
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl ${BRAND} px-5 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(225,29,72,0.3)] transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? "در حال ساخت حساب..." : "ساخت حساب کاربری"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedAvatar(null); finalSignup(); }}
            disabled={submitting}
            className="mx-auto flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white disabled:opacity-50"
          >
            <SkipForward className="h-3.5 w-3.5" />
            بدون آواتار ثبت‌نام کن
          </button>
        </form>
      </AuthShell>
    );
  }

  // ---------- مرحله‌ی اطلاعات حساب ----------
  return (
    <AuthShell
      activeTab="register"
      image={for_login}
      imageAlt="ثبت‌نام در مووی‌ورس"
      title="ساخت حساب جدید"
      subtitle="رایگان ثبت‌نام کن؛ لیست تماشا بساز، فیلم‌ها را ذخیره کن و به دانلودهای VIP دسترسی داشته باش."
    >
      <form onSubmit={goAvatarStep} noValidate className="space-y-4">
        <GeneralError message={generalError} />

        <TextField
          icon={User}
          type="text"
          name="username"
          value={form.username}
          onChange={change}
          placeholder="نام کاربری (انگلیسی)"
          autoComplete="username"
          autoFocus
          error={fieldErrors.username}
        />

        <TextField
          icon={Mail}
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          placeholder="ایمیل"
          autoComplete="email"
          dir="ltr"
          error={fieldErrors.email}
        />

        <div>
          <PasswordField
            value={form.password}
            onChange={change}
            placeholder="رمز عبور (حداقل ۸ نویسه)"
            autoComplete="new-password"
            error={fieldErrors.password}
            show={showPassword}
            onToggleShow={() => setShowPassword((p) => !p)}
          />
          {form.password && (
            <div className="mt-2.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
              </div>
              <span className="text-[11px] text-white/55">قدرت رمز: {strength.label}</span>
            </div>
          )}
        </div>

        <PasswordField
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={change}
          placeholder="تکرار رمز عبور"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((p) => !p)}
        />
        {form.confirmPassword && form.password !== form.confirmPassword && !fieldErrors.confirmPassword && (
          <p className="-mt-2 text-xs text-amber-300">رمز عبور و تکرار آن هنوز یکی نیستند.</p>
        )}

        <button
          type="submit"
          className={`flex w-full items-center justify-center gap-2 rounded-2xl ${BRAND} px-5 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(225,29,72,0.3)] transition hover:opacity-90 active:scale-[0.99]`}
        >
          ادامه و انتخاب آواتار
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-white/40">
          <Lock className="h-3.5 w-3.5" />
          رمز عبور شما به‌صورت رمزنگاری‌شده نگهداری می‌شود.
        </p>
      </form>
    </AuthShell>
  );
}

export default Register;
