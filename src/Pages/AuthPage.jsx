import { useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { navigate } from "wouter/use-browser-location";
import { loginRequest } from "../authConfig";
import Logo from "../assets/Logo";
import { CIAM_AUTH_URL, CIAM_CLIENT_ID, CIAM_REDIRECT_URI } from "../constants";


const AuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("standalone"); // Default to standalone
  const [, setShowBranding] = useState(false);
  // const [isGuestLoading, setIsGuestLoading] = useState(false);

  const { instance, accounts } = useMsal();

  useEffect(() => {
    document.title = "Login - Seismic Connect";
    const timer = setTimeout(() => setShowBranding(true), 800);
    return () => clearTimeout(timer);
  }, []);

  function requestProfileData() {
    instance
      .acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      })
      .then((response) => console.log(response));
  }

  // MSAL Login (Clinic/Internal Users) - Feature 1.1 & 1.2
  const handleMSALLogin = () => {
    setIsLoading(true);
    // Store auth type for route guards (Feature 1.3)
    sessionStorage.setItem("authType", "msal");
    sessionStorage.setItem("authIntent", "clinic");
    
    instance
      .loginRedirect(loginRequest)
      .then(() => {
        requestProfileData();
        navigate("/");
      })
      .catch((e) => {
        console.error("MSAL login error:", e);
        setIsLoading(false);
      });
  };

  // CIAM Login (Standalone Users) - Feature 2.1 & 2.2
  const handleCIAMLogin = () => {
    setIsLoading(true);
    // Store auth type for route guards (Feature 1.3)
    sessionStorage.setItem("authType", "ciam");
    sessionStorage.setItem("authIntent", "standalone");
    
    // CIAM Authentication URL - redirect to register page after password creation flow
    // We only need an id_token (no access_token)
    const params = new URLSearchParams({
      client_id: CIAM_CLIENT_ID,
      response_type: "id_token",
      redirect_uri: CIAM_REDIRECT_URI, // Redirect to register page after account creation
      scope: "openid profile email",
      nonce: Math.random().toString(36).substring(7),
      prompt: "login"
    });

    // Redirect to CIAM for authentication
    window.location.href = `${CIAM_AUTH_URL}?${params.toString()}`;
  };

  // Handle Sign In button click based on selected type
  const handleSignIn = () => {
    if (selectedType === "standalone") {
      handleCIAMLogin();
    } else {
      handleMSALLogin();
    }
  };

  // Guest login handler - commented out
  // const handleGuest = () => {
  //   setIsGuestLoading(true);
  //   localStorage.setItem("isGuest", "true");
  //   setTimeout(() => {
  //     setIsGuestLoading(false);
  //     navigate("/dashboard");
  //   }, 800);
  // };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 overflow-hidden">

      {/* --- Light Overlay Gradient --- */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-blue-50/90 backdrop-blur-sm"></div>
       
      {/* --- Login Card --- */}
      <div className="relative max-w-md w-full bg-white/95 p-10 rounded-2xl shadow-lg backdrop-blur-md flex flex-col items-center animate-fadeIn z-10">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-32 h-32 flex items-center justify-center">
            <Logo size="large" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-extrabold text-[#1E3A8A] mb-2 text-center">
          Seismic Connect
        </h2>
        <p className="mb-6 text-[#1E40AF] font-medium text-center">
            Healthcare Intelligence Platform
        </p>

        {/* Radio Button Selection - Pill Shaped */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-full w-full">
          {/* Standalone Radio */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="accessType"
              value="standalone"
              checked={selectedType === "standalone"}
              onChange={(e) => setSelectedType(e.target.value)}
              className="hidden"
            />
            <div className={`px-4 py-2.5 rounded-full text-center text-sm font-medium transition-all ${
              selectedType === "standalone"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedType === "standalone"
                    ? "border-white bg-white"
                    : "border-gray-400 bg-white"
                }`}>
                  {selectedType === "standalone" && (
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  )}
                </div>
                <span>Standalone</span>
              </div>
            </div>
          </label>

          {/* Clinic Radio */}
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="accessType"
              value="clinic"
              checked={selectedType === "clinic"}
              onChange={(e) => setSelectedType(e.target.value)}
              className="hidden"
            />
            <div className={`px-4 py-2.5 rounded-full text-center text-sm font-medium transition-all ${
              selectedType === "clinic"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedType === "clinic"
                    ? "border-white bg-white"
                    : "border-gray-400 bg-white"
                }`}>
                  {selectedType === "clinic" && (
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  )}
                </div>
                <span>Clinic</span>
              </div>
            </div>
          </label>
        </div>
       
        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] hover:from-[#1E3A8A] hover:to-[#2563EB] text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] mb-4"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        {/* Continue as Guest Button - commented out */}
        {/* <button
          onClick={handleGuest}
          disabled={isLoading || isGuestLoading}
          className={`w-full flex items-center justify-center gap-2 bg-white
            ${isGuestLoading ? "opacity-60 cursor-not-allowed" : ""}
          `}
        >
          {isGuestLoading ? "Continuing..." : "Continue as Guest"}
        </button> */}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          © 2026 Seismic Connect. All rights reserved.
        </div>
      </div>

      {/* --- Heartbeat Animation --- */}
      <div
        className="absolute left-0 right-0 w-full pointer-events-none"
        style={{ zIndex: 5, bottom: "24px" }}
      >
        <svg
          height="80"
          width="100%"
          className="heartbeat-line"
          style={{ display: "block" }}
        >
          <path
            d="M0,60 L30,60 L40,20 L50,70 L60,20 L70,70 L80,60 L100,60 L110,20 L120,70 L130,20 L140,70 L150,60 L180,60 L200,20 L220,70 L240,20 L260,70 L280,60 L300,60"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="4"
            strokeDasharray="400"
            strokeDashoffset="400"
          />
        </svg>

        {/* --- Styles --- */}
        <style>{`
          .heartbeat-line path {
            animation: heartbeat 5s ease-in-out infinite;
          }
          @keyframes heartbeat {
            0% { stroke-dashoffset: 400; }
            50% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -400; }
          }

          .animate-fadeIn {
            animation: fadeInUp 0.6s ease-out;
          }
          .animate-fadeInSlow {
            animation: fadeInBg 1.8s ease-out;
          }

          @keyframes fadeInUp {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          @keyframes fadeInBg {
            0% { opacity: 0; transform: scale(1.05); }
            100% { opacity: 0.1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AuthPage
