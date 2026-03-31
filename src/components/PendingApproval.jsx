import { ShieldAlert } from "lucide-react";
import { navigate } from "wouter/use-browser-location";
import Logo from "../assets/Logo";

const COPY_BY_STATUS = {
  pending: {
    title: "Registration Complete",
    description:
      "Your account is pending approval from your clinic administrator.",
  },
  rejected: {
    title: "Access Not Yet Approved",
    description:
      "Your registration was reviewed, but access has not been approved yet. Please contact your clinic administrator for next steps.",
  },
};

function clearStandaloneSession() {
  sessionStorage.removeItem("ciamIdToken");
  sessionStorage.removeItem("backendToken");
  sessionStorage.removeItem("standaloneRegistrationComplete");
}

const PendingApproval = ({
  status = "pending",
  clinicName = "",
  role = "",
}) => {
  const copy = COPY_BY_STATUS[status] || COPY_BY_STATUS.pending;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-6">
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-blue-50/90 backdrop-blur-sm" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl bg-white/95 p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Logo size="medium" />
          </div>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#1E3A8A]">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{copy.description}</p>
          {(clinicName || role) && (
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-left text-sm text-gray-700">
              {clinicName ? (
                <div>
                  <span className="font-medium text-gray-900">Clinic:</span> {clinicName}
                </div>
              ) : null}
              {role ? (
                <div className={clinicName ? "mt-2" : ""}>
                  <span className="font-medium text-gray-900">Role:</span> {role}
                </div>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              clearStandaloneSession();
              navigate("/");
            }}
            className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
