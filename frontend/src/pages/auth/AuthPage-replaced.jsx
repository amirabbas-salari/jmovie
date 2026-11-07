import { useEffect, useState, useMemo } from "react";
import { User, Eye, EyeOff, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { login, register} from "../../services/authService";
import { saveTokens } from "../../utils/token";
import { useLocation } from "react-router-dom";

function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const [step, setStep] = useState("auth");
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  
  const avatarList = useMemo(
    () => [
      "/avatars/1.png",
      "/avatars/2.png",
      "/avatars/3.png",
      "/avatars/4.png",
      "/avatars/5.png",
      "/avatars/6.png",
      "/avatars/7.png",
      "/avatars/8.png",
      "/avatars/9.png",
    ],
    []
  );

  // ✅ NEW
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

  // ✅ NEW
  const handleUploadAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    setUploadedAvatar({
      file,
      previewUrl,
    });

    setSelectedAvatar({
      type: "file",
      value: previewUrl,
      file,
    });
  };

  
  
  

  
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    
    if (!loginData.username || !loginData.password) {
      alert("Please fill in all login fields.");
      return;
    }
    
    console.log("Login Data:", loginData);

    try {
      const data = await login(loginData.username, loginData.password);
      saveTokens(data.access, data.refresh);
      
      window.location.href = "/"
      // navigate("/");

    } catch (err) {
      console.error("Login error:", err.response?.data || err);
      alert("Login failed: " + JSON.stringify(err.response?.data || {}));
    }
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

      alert("Signup successful!");
      window.location.href = "/login";
    } catch (err) {
      console.error("Signup error:", err.response?.data || err);
      alert("Signup failed: " + JSON.stringify(err.response?.data || {}));
    }
  };



  useEffect(() => {
    if (location.pathname === "/register") {
      setActiveTab("signup");
    } else {
      setActiveTab("login");
    }
  }, [location.pathname]);


  // ✅ NEW
  if (step === "avatar") {
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
              Hi {signupData.username || "User"}
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
              choose your profile
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
                      setSelectedAvatar({
                        type: "url",
                        value: avatar,
                      })
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
              {loading ? "Loading..." : "Confirm"}
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

        <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          {/* Left Side */}
          <div className="z-10 w-full max-w-sm lg:max-w-md">
            <h1 className="mb-8 text-5xl font-semibold tracking-tight text-white lg:text-6xl">
              Welcome
            </h1>

            <div className="mb-14 flex items-center gap-10 text-xl font-semibold uppercase">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`relative pb-2 transition ${
                  activeTab === "login"
                    ? "text-white"
                    : "text-white/75 hover:text-white"
                }`}
              >
                Login
                {activeTab === "login" && (
                  <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-[#2f8fe8]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className={`relative pb-2 transition ${
                  activeTab === "signup"
                    ? "text-white"
                    : "text-white/75 hover:text-white"
                }`}
              >
                signup
                {activeTab === "signup" && (
                  <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-[#2f8fe8]" />
                )}
              </button>
            </div>

            {activeTab === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      name="username"
                      value={loginData.username}
                      onChange={handleLoginChange}
                      placeholder="Username"
                      className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 pr-12 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
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
                      placeholder="Password"
                      className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 pr-12 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
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

                <div className="pt-[-6px] text-center">
                  <button
                    type="button"
                    className="text-sm text-white/70 transition hover:text-white"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="mx-auto block w-full max-w-[170px] rounded-xl bg-[#3498eb] px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-lg shadow-[#3498eb]/20 transition hover:bg-[#2587d8] focus:outline-none focus:ring-2 focus:ring-[#57aaf0]"
                  >
                    Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignupNext} className="space-y-5">
                <div className="relative">
                  <input
                    type="text"
                    name="username"
                    value={signupData.username}
                    onChange={handleSignupChange}
                    placeholder="Username"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                  />
                </div>

                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={signupData.email}
                    onChange={handleSignupChange}
                    placeholder="Email"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                  />
                </div>

                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={signupData.password}
                    onChange={handleSignupChange}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                  />
                </div>

                <div className="relative">
                  <input
                    type="password"
                    name="confirmPassword"
                    value={signupData.confirmPassword}
                    onChange={handleSignupChange}
                    placeholder="Confirm Password"
                    className="w-full rounded-2xl border border-white/50 bg-transparent px-5 py-4 text-white placeholder:text-white/45 outline-none transition focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/20"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="mx-auto block w-full max-w-[170px] rounded-xl bg-[#3498eb] px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-lg shadow-[#3498eb]/20 transition hover:bg-[#2587d8] focus:outline-none focus:ring-2 focus:ring-[#57aaf0]"
                  >
                    confirm
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Side Image */}
          <div className="w-full max-w-4xl">
            <div className="overflow-hidden rounded-[28px] bg-[#06113a] shadow-2xl">
              <img
                src="../src/assets/for-login.webp"
                alt="Fantasy visual"
                className="h-[420px] w-full object-cover md:h-[560px] lg:h-[600px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
