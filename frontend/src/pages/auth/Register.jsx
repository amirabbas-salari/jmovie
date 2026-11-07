import { useState, useMemo } from "react";
import { User, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { register } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import SideImages from "../../components/ui/SideImages";


import for_login from "../../assets/for-login.webp";
// import کردن همه آواتارها
import avatar1 from "../../assets/avatars/1.webp";
import avatar2 from "../../assets/avatars/2.webp";
import avatar3 from "../../assets/avatars/3.webp";
import avatar4 from "../../assets/avatars/4.webp";
import avatar5 from "../../assets/avatars/5.webp";
import avatar6 from "../../assets/avatars/6.webp";
import avatar7 from "../../assets/avatars/7.webp";
import avatar8 from "../../assets/avatars/8.webp";
import avatar9 from "../../assets/avatars/9.webp";


function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState("auth");
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const avatarList = useMemo(
    () => [
      avatar1,
      avatar2,
      avatar3,
      avatar4,
      avatar5,
      avatar6,
      avatar7,
      avatar8,
      avatar9,
    ],
    []
  );

  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupNext = (e) => {
    e.preventDefault();

    if (
      !signupData.username.trim() ||
      !signupData.email.trim() ||
      !signupData.password.trim() ||
      !signupData.confirmPassword.trim()
    ) {
      alert("Please fill in all signup fields.");
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setStep("avatar");
  };

  const handleUploadAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    setUploadedAvatar({ file, previewUrl });
    setSelectedAvatar({ type: "file", value: previewUrl, file });
  };

  const handleFinalSignup = async (e) => {
    e.preventDefault();

    if (
      !signupData.username ||
      !signupData.email ||
      !signupData.password ||
      !signupData.confirmPassword
    ) {
      alert("Please fill in all signup fields.");
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (!selectedAvatar) {
      alert("Please choose your profile avatar.");
      return;
    }

    try {
      const formData = new FormData();

      formData.append("username", signupData.username);
      formData.append("email", signupData.email);
      formData.append("password", signupData.password);
      formData.append("password2", signupData.confirmPassword);

      if (selectedAvatar.type === "file" && selectedAvatar.file) {
        formData.append("avatar", selectedAvatar.file);
      } else if (selectedAvatar.type === "url" && selectedAvatar.value) {
        const response = await fetch(selectedAvatar.value);
        const blob = await response.blob();
        const fileName = selectedAvatar.value.split("/").pop() || "avatar.jpg";
        const file = new File([blob], fileName, { type: blob.type });
        formData.append("avatar", file);
      }

      await register(formData);
      setStep("success");
    } catch (err) {
      console.error("Signup error:", err.response?.data || err);
      alert("Signup failed: " + JSON.stringify(err.response?.data || {}));
    }
  };


  if (step === "success") {
    return (
      <div className="max-h-screen overflow-hidden bg-[#020826] text-white">
        <div className="overflow-hidden relative min-h-screen bg-[radial-gradient(circle_at_bottom_left,rgba(60,40,120,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(40,60,140,0.30),transparent_30%),linear-gradient(180deg,#0a1240_0%,#050a26_55%,#020618_100%)] px-5 py-5">
          <SideImages showMinions={false}/>

          <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center text-center mt-28">
            <div className="flex h-60 w-60 items-center justify-center overflow-hidden rounded-full bg-[#2d9aed] ring-1 ring-[#4aa3ff]/70 shadow-[0_0_22px_rgba(45,154,237,0.5)]">
              {selectedAvatar ? (
                <img
                  src={selectedAvatar.value}
                  alt="Profile avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User size={96} className="text-white/90" />
              )}
            </div>

            <p className="mt-5 text-base font-medium text-white/85">
              {signupData.username || "کاربر"}
            </p>

            <h1 className="mt-16 text-3xl font-bold tracking-tight text-white md:text-4xl">
              حساب کاربری شما با موفقیت ایجاد شد
            </h1>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-14 w-44 rounded-xl bg-[#3498eb] px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-lg transition hover:bg-[#2587d8]"
            >
              ورود
            </button>


          </div>
        </div>
      </div>
    );
  }


  else if (step === "avatar") {
    return (
      <div className="min-h-screen overflow-hidden bg-[#020826] text-white">
        <div className="relative min-h-screen bg-[radial-gradient(circle_at_bottom_left,rgba(87,47,174,0.48),transparent_30%),linear-gradient(90deg,#040b2c_0%,#020720_45%,#020720_100%)] px-5 py-5">
          <button
            type="button"
            onClick={() => setStep("auth")}
            className="absolute left-5 top-5 z-20 text-white/80 transition hover:text-white"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center pt-14">
            <h1 className="mb-10 text-center text-4xl font-normal tracking-wide text-white md:text-5xl">
              سلام {signupData.username || "کاربر"}
            </h1>

            <div className="mb-16 flex h-32 w-32 items-center justify-center rounded-full bg-[#2d9aed] shadow-[0_0_18px_rgba(45,154,237,0.45)]">
              {selectedAvatar ? (
                <img
                  src={selectedAvatar.value}
                  alt="Selected avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User size={92} className="text-white/90" />
              )}
            </div>

            <p className="mb-8 text-lg font-semibold text-white/95">
              پروفایل خود را انتخاب کنید
            </p>

            <div className="grid grid-cols-3 gap-x-8 gap-y-8 sm:grid-cols-4 md:grid-cols-5 md:gap-x-12">
              {avatarList.map((avatar, index) => {
                const isSelected =
                  selectedAvatar?.type === "url" &&
                  selectedAvatar?.value === avatar;

                return (
                  <button
                    key={avatar}
                    type="button"
                    onClick={() =>
                      setSelectedAvatar({ type: "url", value: avatar })
                    }
                    className={`h-24 w-24 overflow-hidden rounded-full transition md:h-28 md:w-28 ${
                      isSelected
                        ? "scale-105 ring-4 ring-[#2d9aed] ring-offset-4 ring-offset-[#020826]"
                        : "ring-2 ring-transparent hover:scale-105 hover:ring-[#2d9aed]/70"
                    }`}
                  >
                    <img
                      src={avatar}
                      alt={`avatar-${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}

              <label
                className={`flex h-24 w-24 cursor-pointer items-center justify-center rounded-full bg-[#2d9aed] transition md:h-28 md:w-28 ${
                  selectedAvatar?.type === "file"
                    ? "scale-105 ring-4 ring-[#2d9aed] ring-offset-4 ring-offset-[#020826]"
                    : "hover:scale-105"
                }`}
              >
                {uploadedAvatar ? (
                  <img
                    src={uploadedAvatar.previewUrl}
                    alt="Uploaded avatar"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <ImageIcon size={52} className="text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleFinalSignup}
              className="mt-14 w-36 rounded-lg bg-[#3498eb] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#3498eb]/20 transition hover:bg-[#2587d8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "صبر..." : "تایید"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020b2b] text-white">
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_bottom_left,rgba(83,48,170,0.45),transparent_28%),linear-gradient(90deg,#030b2f_0%,#020726_45%,#020726_100%)]">
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
              مووی<span className="text-[#2f8fe8]">ورس</span>
            </h1>
            <br />
            <div className="mb-14 flex items-center gap-10 text-xl font-semibold uppercase">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="relative pb-2 text-white/75 transition hover:text-white"
              >
                ورود
              </button>

              <button
                type="button"
                className="relative pb-2 text-white"
              >
                ثبت نام
                <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-[#2f8fe8]" />
              </button>
            </div>

            <form onSubmit={handleSignupNext} className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  name="username"
                  value={signupData.username}
                  onChange={handleSignupChange}
                  placeholder="نام کاربری"
                  className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                />
              </div>

              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={signupData.email}
                  onChange={handleSignupChange}
                  placeholder="ایمیل"
                  className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                />
              </div>

              <div className="relative">
                <input
                  type="password"
                  name="password"
                  value={signupData.password}
                  onChange={handleSignupChange}
                  placeholder="رمز عبور"
                  className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                />
              </div>

              <div className="relative">
                <input
                  type="password"
                  name="confirmPassword"
                  value={signupData.confirmPassword}
                  onChange={handleSignupChange}
                  placeholder="تکرار رمز عبور"
                  className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="mx-auto block w-full max-w-[170px] rounded-xl bg-[#3498eb] px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-lg shadow-[#3498eb]/20 transition hover:bg-[#2587d8] focus:outline-none focus:ring-2 focus:ring-[#57aaf0]"
                >
                  تایید
                </button>
              </div>
            </form>
          </div>

          {/* Right Side Image */}
          <div className="">
            <div className="overflow-hidden rounded-[28px] bg-[#06113a] shadow-2xl">
              <img
                src={for_login}
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

export default Register;
