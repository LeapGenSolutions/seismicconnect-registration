import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "wouter/use-browser-location";
import Logo from "../assets/Logo";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { BACKEND_URL, REDIRECT_URI } from "../constants";
import { fetchRegistrationRoles } from "../api/rbac";
import { searchClinics } from "../api/clinics";
import { fetchInvitationDetails } from "../api/invitations";
import { US_STATES } from "../components/ui/us-states";
import { useToast } from "../hooks/use-toast";
import TermsDialog from "../components/TermsDialog";
import { CheckCircle2, FileText, Loader2, LockKeyhole, Search, ShieldCheck, X } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { BAA_AGREEMENT_TEXT, CURRENT_BAA_VERSION } from "../constants/baaAgreement";
// Helper to safely decode a JWT without validating it (backend must still verify)
const decodeIdToken = (token) => {
  try {
    const [, payloadBase64] = token.split(".");
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = atob(normalized);
    return JSON.parse(payloadJson);
  } catch (error) {
    console.error("Failed to decode CIAM token", error);
    return null;
  }
};

// Initial form data structure
const initialFormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  primaryEmail: "",
  secondaryEmail: "",
  role: "",
  npiNumber: "",
  specialty: "",
  subSpecialty: "",
  statesOfLicense: [],
  licenseNumber: "",
  clinicName: "",
  practiceAddress: {
    street: "",
    city: "",
    state: "",
    zip: "",
  },
  transcriptPurging: "30",
};

// Initial errors structure
const initialErrors = {
  firstName: "",
  lastName: "",
  primaryEmail: "",
  secondaryEmail: "",
  role: "",
  npiNumber: "",
  specialty: "",
  statesOfLicense: "",
  clinicName: "",
  practiceAddress: {
    street: "",
    city: "",
    state: "",
    zip: "",
  },
  terms: "",
  baaSignature: "",
  transcriptPurging: "",
};

const DEFAULT_ROLE_OPTIONS = [
  { roleName: "Doctor", type: "system", skipNpiValidation: false },
  { roleName: "Nurse Practitioner", type: "system", skipNpiValidation: false },
  { roleName: "Staff", type: "system", skipNpiValidation: true },
];
const MAIN_APP_REDIRECT_BASE = (REDIRECT_URI || "").replace(/\/+$/, "");
const BACKEND_BASE = (BACKEND_URL || "").replace(/\/+$/, "");
const backendApi = (path) => `${BACKEND_BASE}/${String(path).replace(/^\/+/, "")}`;
const normalizeClinicName = (value = "") => value.trim().toLowerCase().replace(/\s+/g, " ");
const BAA_AGREEMENT_PDF_URL = `${process.env.PUBLIC_URL || ""}/baa_agreement.pdf`;
const AGREEMENT_DISPLAY_TITLE = "Clinical Data & Privacy Agreement";
const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (error) {
    return "UTC";
  }
};
const RETENTION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const RegisterPage = () => {
  const { toast } = useToast();
  // Start with loader visible until CIAM verification / initial checks complete
  const [isLoading, setIsLoading] = useState(true);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [acknowledgeClinicalResponsibility, setAcknowledgeClinicalResponsibility] = useState(false);
  const [acknowledgeRetentionPolicy, setAcknowledgeRetentionPolicy] = useState(false);
  const [baaSignature, setBaaSignature] = useState(null);
  const [baaSignerName, setBaaSignerName] = useState("");
  const [baaSignerRole, setBaaSignerRole] = useState("");
  const [isBaaAuthorized, setIsBaaAuthorized] = useState(false);
  const [isBaaAgreementOpen, setIsBaaAgreementOpen] = useState(false);
  const [hasReviewedAgreement, setHasReviewedAgreement] = useState(false);
  const [agreementNumPages, setAgreementNumPages] = useState(null);
  const [agreementPdfWidth, setAgreementPdfWidth] = useState(720);
  const [agreementPdfError, setAgreementPdfError] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [signupType, setSignupType] = useState("standalone"); // "standalone" or "clinic" - setSignupType will be used when registration type selection is re-enabled
  const [isNpiVerified, setIsNpiVerified] = useState(false);
  const [isVerifyingNpi, setIsVerifyingNpi] = useState(false);
  const [isStatesDropdownOpen, setIsStatesDropdownOpen] = useState(false);
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLE_OPTIONS);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [clinicOptions, setClinicOptions] = useState([]);
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);
  const [existingClinicMatch, setExistingClinicMatch] = useState("");
  const [invitationDetails, setInvitationDetails] = useState(null);

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState(initialErrors);
  const currentRoleRef = useRef(formData.role);
  const currentSkipNpiValidationRef = useRef(false);
  const loadedClinicNameRef = useRef("");
  const clinicDropdownRef = useRef(null);
  const agreementScrollRef = useRef(null);
  const invitationToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("invitation")
      : null;
  const roleOptions = useMemo(() => {
    if (!invitationDetails?.roleName) {
      return availableRoles;
    }

    if (availableRoles.some((role) => role.roleName === invitationDetails.roleName)) {
      return availableRoles;
    }

    return [
      ...availableRoles,
      {
        roleName: invitationDetails.roleName,
        type: "invited",
        skipNpiValidation: Boolean(invitationDetails.skipNpiValidation),
      },
    ];
  }, [availableRoles, invitationDetails]);
  const selectedRoleConfig = useMemo(
    () =>
      roleOptions.find((role) => role.roleName === formData.role) ||
      DEFAULT_ROLE_OPTIONS.find((role) => role.roleName === formData.role) ||
      null,
    [formData.role, roleOptions]
  );
  const skipNpiValidation = Boolean(selectedRoleConfig?.skipNpiValidation);
  const isStaffRole = skipNpiValidation;
  const shouldValidateNpi = formData.role ? !skipNpiValidation : true;
  const areProfessionalDetailsDisabled = isStaffRole;
  const shouldRequireSpecialty = !isStaffRole;
  const specialtyValue = formData.specialty.trim()
    || (!shouldRequireSpecialty ? formData.role.trim() : undefined);
  const baaUserDraft = useMemo(
    () => ({
      fullName: [formData.firstName, formData.lastName].filter(Boolean).join(" "),
      name: [formData.firstName, formData.lastName].filter(Boolean).join(" "),
      email: formData.primaryEmail,
      role: formData.role,
      clinicName: formData.clinicName,
    }),
    [formData.clinicName, formData.firstName, formData.lastName, formData.primaryEmail, formData.role]
  );
  const allAgreementAcknowledgementsChecked =
    agreeToTerms &&
    acknowledgeClinicalResponsibility &&
    acknowledgeRetentionPolicy &&
    isBaaAuthorized;

  const updateAgreementReviewProgress = useCallback(() => {
    const element = agreementScrollRef.current;
    if (!element) return;

    const scrollBottom = element.scrollTop + element.clientHeight;
    if (scrollBottom >= element.scrollHeight - 20) {
      setHasReviewedAgreement(true);
    }
  }, []);

  const handleAgreementOpen = () => {
    setHasReviewedAgreement(false);
    setAgreementPdfError("");
    if (agreementScrollRef.current) agreementScrollRef.current.scrollTop = 0;
    setIsBaaAgreementOpen(true);
  };

  const handleAgreementClose = () => {
    setIsBaaAgreementOpen(false);
  };

  const handleAgreementDocumentLoadSuccess = ({ numPages: loadedPages }) => {
    setAgreementNumPages(loadedPages);
    setAgreementPdfError("");
    setHasReviewedAgreement(false);
    if (agreementScrollRef.current) agreementScrollRef.current.scrollTop = 0;
    requestAnimationFrame(updateAgreementReviewProgress);
  };

  const handleAgreementDocumentLoadError = () => {
    setAgreementPdfError("Unable to render the agreement PDF here.");
  };

  const handleAllAgreementAcknowledgementsChange = (checkedValue) => {
    const checked = Boolean(checkedValue);
    setAgreeToTerms(checked);
    setAcknowledgeClinicalResponsibility(checked);
    setAcknowledgeRetentionPolicy(checked);
    setIsBaaAuthorized(checked);
    if (checked) {
      setErrors((prev) => ({ ...prev, baaSignature: "", terms: "" }));
    }
  };

  const handleBaaAccepted = () => {
    const signerName = baaSignerName.trim().replace(/\s+/g, " ");
    const signedTimeZone = getBrowserTimeZone();

    if (!signerName || signerName.length < 2) {
      setErrors((prev) => ({ ...prev, baaSignature: "Enter your full legal name to accept the agreement." }));
      return;
    }

    if (!hasReviewedAgreement) {
      setErrors((prev) => ({
        ...prev,
        baaSignature: "Scroll to the end of the agreement before accepting.",
      }));
      setIsBaaAgreementOpen(true);
      return;
    }

    if (!isBaaAuthorized) {
      setErrors((prev) => ({
        ...prev,
        baaSignature: "Acknowledge and accept the clinical data and privacy terms.",
      }));
      return;
    }

    if (!agreeToTerms || !acknowledgeClinicalResponsibility || !acknowledgeRetentionPolicy) {
      setErrors((prev) => ({
        ...prev,
        terms: "Complete all required acknowledgements",
        baaSignature: "Complete the acknowledgements before accepting the agreement.",
      }));
      return;
    }

    setBaaSignature({
      signed: true,
      signerName,
      manualSignature: baaSignerRole.trim(),
      authorizedRepresentative: true,
      agreementTitle: AGREEMENT_DISPLAY_TITLE,
      displayTitle: AGREEMENT_DISPLAY_TITLE,
      agreementText: BAA_AGREEMENT_TEXT,
      signedAt: new Date().toISOString(),
      signedTimeZone,
      timeZone: signedTimeZone,
      baaVersion: CURRENT_BAA_VERSION,
    });
    setErrors((prev) => ({ ...prev, baaSignature: "", terms: "" }));
    setIsBaaAgreementOpen(false);
  };

  useEffect(() => {
    if (baaSignature?.signed) {
      setBaaSignature(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baaUserDraft.fullName, baaUserDraft.email]);

  useEffect(() => {
    if (baaSignature?.signed) {
      setBaaSignature(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baaSignerName, baaSignerRole, isBaaAuthorized]);

  useEffect(() => {
    if (baaSignature?.signed) {
      setBaaSignature(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreeToTerms, acknowledgeClinicalResponsibility, acknowledgeRetentionPolicy]);

  useEffect(() => {
    if (!isBaaAgreementOpen) return undefined;

    const element = agreementScrollRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setAgreementPdfWidth(Math.max(280, Math.min(element.clientWidth - 32, 820)));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isBaaAgreementOpen]);

  useEffect(() => {
    currentRoleRef.current = formData.role;
    currentSkipNpiValidationRef.current = skipNpiValidation;

    if (skipNpiValidation) {
      setIsNpiVerified(false);
      setIsVerifyingNpi(false);
      setErrors((prev) => ({ ...prev, npiNumber: "", specialty: "" }));
    }
  }, [formData.role, skipNpiValidation]);

  const loadRolesForClinic = useCallback(
    async (clinicNameInput) => {
      const trimmedClinicName = clinicNameInput.trim();

      if (!trimmedClinicName) {
        loadedClinicNameRef.current = "";
        setAvailableRoles(DEFAULT_ROLE_OPTIONS);
        if (
          currentRoleRef.current &&
          !DEFAULT_ROLE_OPTIONS.some(
            (role) => role.roleName === currentRoleRef.current
          )
        ) {
          setFormData((prev) => ({ ...prev, role: "" }));
        }
        return;
      }

      if (loadedClinicNameRef.current === trimmedClinicName) {
        return;
      }

      setIsLoadingRoles(true);

      try {
        const roles = await fetchRegistrationRoles(trimmedClinicName);
        const nextRoles = roles.length > 0 ? roles : DEFAULT_ROLE_OPTIONS;
        loadedClinicNameRef.current = trimmedClinicName;
        setAvailableRoles(nextRoles);

        if (
          currentRoleRef.current &&
          !nextRoles.some((role) => role.roleName === currentRoleRef.current) &&
          currentRoleRef.current !== invitationDetails?.roleName
        ) {
          setFormData((prev) => ({ ...prev, role: "" }));
        }
      } catch (error) {
        console.error("Failed to load registration roles:", error);
        loadedClinicNameRef.current = "";
        setAvailableRoles(DEFAULT_ROLE_OPTIONS);
      } finally {
        setIsLoadingRoles(false);
      }
    },
    [invitationDetails?.roleName]
  );

  const redirectToMainApp = () => {
    const idToken = sessionStorage.getItem("ciamIdToken");
    if (!idToken) {
      return;
    }

    const fullUrl = `${MAIN_APP_REDIRECT_BASE}/?token=${encodeURIComponent(idToken)}`;
    window.location.assign(fullUrl);
  };

  useEffect(() => {
    if (invitationDetails?.clinicName) {
      setFormData((prev) => ({
        ...prev,
        clinicName: invitationDetails.clinicName,
        role: invitationDetails.roleName || prev.role,
      }));
      setClinicOptions([]);
      setIsClinicDropdownOpen(false);
      void loadRolesForClinic(invitationDetails.clinicName);
    }
  }, [invitationDetails, loadRolesForClinic]);

  useEffect(() => {
    const trimmedClinicName = formData.clinicName.trim();
    const normalizedClinicName = normalizeClinicName(trimmedClinicName);

    if (invitationDetails || !trimmedClinicName) {
      setClinicOptions([]);
      setIsSearchingClinics(false);
      setExistingClinicMatch("");
      return undefined;
    }

    const backendToken = sessionStorage.getItem("backendToken");
    if (!backendToken || trimmedClinicName.length < 2) {
      setClinicOptions([]);
      setIsSearchingClinics(false);
      setExistingClinicMatch("");
      return undefined;
    }

    let active = true;
    setExistingClinicMatch("");
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingClinics(true);
      try {
        const clinics = await searchClinics(trimmedClinicName);
        if (!active) return;

        const results = Array.isArray(clinics) ? clinics : [];
        setClinicOptions(results);

        const matchedClinic = results.find((clinic) =>
          normalizeClinicName(clinic?.clinicName) === normalizedClinicName
        );
        setExistingClinicMatch(matchedClinic?.clinicName || "");
      } catch (error) {
        if (!active) return;
        console.error("Clinic search failed:", error);
        setClinicOptions([]);
        setExistingClinicMatch("");
      } finally {
        if (active) setIsSearchingClinics(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [formData.clinicName, invitationDetails]);

  useEffect(() => {
    if (!invitationToken || invitationDetails) {
      return;
    }

    const backendToken = sessionStorage.getItem("backendToken");
    if (!backendToken) {
      return;
    }

    fetchInvitationDetails(invitationToken)
      .then((invitation) => {
        setInvitationDetails(invitation);
      })
      .catch((error) => {
        console.error("Failed to load invitation details:", error);
      });
  }, [invitationDetails, invitationToken]);

  useEffect(() => {
    document.title = "Register - Seismic Connect";

    // CIAM redirects here with id_token in the URL hash: #id_token=...
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : "";
    const params = new URLSearchParams(hash);

    let idToken = params.get("id_token");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // If no token in URL (e.g. page refresh), fall back to sessionStorage
    if (!idToken) {
      idToken = sessionStorage.getItem("ciamIdToken");
    }

    if (idToken) {
      const payload = decodeIdToken(idToken);
      if (!payload) {
        const errorMsg = "Invalid token. Please try logging in again.";
        setErrors((prev) => ({
          ...prev,
          general: errorMsg,
        }));
        toast({
          title: "Authentication Error",
          description: errorMsg,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const email = payload.email || payload.emails?.[0] || "";
      const userId = payload.sub || payload.oid || "";

      // Store token + auth metadata
      sessionStorage.setItem("ciamIdToken", idToken);
      sessionStorage.setItem("authType", "ciam");
      sessionStorage.setItem("authIntent", "standalone");

      // Pre-fill email
      if (email) {
        setFormData((prev) => ({ ...prev, primaryEmail: email }));
      }

      // Check if token came from URL (not from sessionStorage on refresh)
      const tokenFromUrl = params.get("id_token");

      // Verify email/token when token comes from CIAM redirect (not from refresh)
      if (tokenFromUrl) {
        // Verify token and user (email verification)
        fetch(backendApi("api/standalone/auth/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            email,
            userId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              // Try to read error details from API (e.g. expired token)
              const errorData = await res.json().catch(() => ({}));
              const backendMessage =
                errorData.error ||
                errorData.message ||
                `Verification failed: ${res.status}`;
              throw new Error(backendMessage);
            }
            return res.json();
          })
          .then(async (data) => {
            // Store the backend token for registration
            if (data.token) {
              sessionStorage.setItem("backendToken", data.token);
            }

            if (invitationToken && data.token) {
              const invitation = await fetchInvitationDetails(invitationToken);
              setInvitationDetails(invitation);
            }

            // Check profileComplete status to determine redirect
            if (data.profileComplete === true) {
              // Profile is complete - redirect to main app, which now owns pending-vs-approved state
              setIsLoading(true);
              if (window.history && window.history.replaceState) {
                window.history.replaceState(
                  null,
                  document.title,
                  window.location.pathname + window.location.search
                );
              }
              //  navigate("/");
              // Force absolute redirect - use assign for proper navigation
              redirectToMainApp();
            } else {
              // Keep hash in URL for page refresh support
              // Hash will be removed after successful registration
              setIsLoading(false);
            }
          })
          .catch((err) => {
            console.error("Token verification failed:", err);

            // If backend reports invalid/expired ID token, redirect to login with a toast
            if (
              err.message?.includes("Invalid or expired ID token") ||
              err.message?.includes("ID token has expired")
            ) {
              // Keep full-screen loader visible during redirect
              setIsLoading(true);

              const errorMsg = "Your session has expired. Please log in again.";
              toast({
                title: "Session Expired",
                description: errorMsg,
                variant: "destructive",
              });

              // Clear any stale CIAM / backend tokens
              sessionStorage.removeItem("ciamIdToken");
              sessionStorage.removeItem("backendToken");

              // Navigate back to login page (AuthPage)
              navigate("/");
              return;
            }

            const errorMsg =
              err.message || "Token verification failed. Please try logging in again.";
            setErrors((prev) => ({
              ...prev,
              general: errorMsg,
            }));
            toast({
              title: "Verification Failed",
              description: errorMsg,
              variant: "destructive",
            });
            setIsLoading(false);
          });
      } else {
        if (invitationToken && !sessionStorage.getItem("backendToken")) {
          navigate(`/?invitation=${encodeURIComponent(invitationToken)}`);
          return;
        }

        // Token came from sessionStorage (page refresh) - show the form
        setIsLoading(false);
      }
    } else if (error) {
      // CIAM reported an error instead of returning a token
      const errorMsg = errorDescription || error || "Login failed. Please try again.";
      setErrors((prev) => ({
        ...prev,
        general: errorMsg,
      }));
      toast({
        title: "Login Error",
        description: errorMsg,
        variant: "destructive",
      });
      setIsLoading(false);
    } else if (invitationToken) {
      navigate(`/?invitation=${encodeURIComponent(invitationToken)}`);
    } else {
      setIsLoading(false);
    }
  }, [invitationToken, toast]);

  // Clear all fields except email when signup type changes
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear all fields except email
    setFormData((prev) => ({
      ...initialFormData,
      primaryEmail: prev.primaryEmail, // Keep the email
    }));

    // Clear all errors
    setErrors(initialErrors);

    // Reset terms checkbox
    setAgreeToTerms(false);
    setAcknowledgeClinicalResponsibility(false);
    setAcknowledgeRetentionPolicy(false);
    setBaaSignature(null);
    setBaaSignerName("");
    setBaaSignerRole("");
    setIsBaaAuthorized(false);
    setHasReviewedAgreement(false);

    // Reset NPI verification status
    setIsNpiVerified(false);
    setIsVerifyingNpi(false);
  }, [signupType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isStatesDropdownOpen && !event.target.closest('.states-dropdown-container')) {
        setIsStatesDropdownOpen(false);
      }

      if (
        isClinicDropdownOpen &&
        clinicDropdownRef.current &&
        !clinicDropdownRef.current.contains(event.target)
      ) {
        setIsClinicDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isClinicDropdownOpen, isStatesDropdownOpen]);

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Name validation (letters, spaces, hyphens only)
  const validateName = (name) => {
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    return nameRegex.test(name) && name.trim().length > 0;
  };

  // NPI Number validation (10 digits)
  const validateNPI = (npi) => {
    const npiRegex = /^\d{10}$/;
    return npiRegex.test(npi);
  };

  // Handle input changes with validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when typing
    setErrors(prev => ({ ...prev, [name]: "" }));

    if (name === "clinicName") {
      setIsClinicDropdownOpen(true);
      setExistingClinicMatch("");
      const trimmedClinicName = value.trim();
      if (!trimmedClinicName) {
        loadedClinicNameRef.current = "";
        setAvailableRoles(DEFAULT_ROLE_OPTIONS);
        setClinicOptions([]);
        if (
          currentRoleRef.current &&
          !DEFAULT_ROLE_OPTIONS.some(
            (role) => role.roleName === currentRoleRef.current
          )
        ) {
          setFormData((prev) => ({ ...prev, role: "" }));
        }
      } else if (loadedClinicNameRef.current !== trimmedClinicName) {
        loadedClinicNameRef.current = "";
      }
    }
  };

  const handleClinicNameBlur = () => {
    window.setTimeout(() => {
      setIsClinicDropdownOpen(false);
      void loadRolesForClinic(formData.clinicName);
    }, 100);
  };

  const handleClinicSelect = (clinicName, isExisting = false) => {
    setFormData((prev) => ({
      ...prev,
      clinicName,
    }));
    setErrors((prev) => ({ ...prev, clinicName: "" }));
    setClinicOptions([]);
    setIsClinicDropdownOpen(false);
    setExistingClinicMatch(isExisting ? clinicName : "");
    void loadRolesForClinic(clinicName);
  };

  // Handle name input (letters, spaces, hyphens, apostrophes only - no numbers)
  const handleNameChange = (e) => {
    const { name, value } = e.target;
    const nameValue = value.replace(/[^a-zA-Z\s\-']/g, '');
    setFormData(prev => ({ ...prev, [name]: nameValue }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  // NPI verification function
  const verifyNPI = async (npiNumber) => {
    if (
      currentSkipNpiValidationRef.current ||
      !npiNumber ||
      !validateNPI(npiNumber)
    ) {
      return;
    }

    setIsVerifyingNpi(true);
    setErrors(prev => ({ ...prev, npiNumber: "" }));

    try {
      const response = await fetch(backendApi("api/verify-npi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npiNumber: npiNumber,
        }),
      });

      if (currentSkipNpiValidationRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || "NPI verification failed";
        setErrors(prev => ({ ...prev, npiNumber: errorMessage }));
        setIsNpiVerified(false);
        toast({
          title: "NPI Verification Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        const data = await response.json();

        if (currentSkipNpiValidationRef.current) {
          return;
        }

        if (data.valid === true) {
          setIsNpiVerified(true);
          setErrors(prev => ({ ...prev, npiNumber: "" }));
          toast({
            title: "NPI Verified",
            description: "Your NPI number has been verified successfully.",
            variant: "default",
          });
        } else {
          // NPI is not valid
          const errorMessage = data.reason || "NPI not found or invalid";
          setErrors(prev => ({ ...prev, npiNumber: errorMessage }));
          setIsNpiVerified(false);
          toast({
            title: "NPI Verification Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      if (currentSkipNpiValidationRef.current) {
        return;
      }

      console.error("NPI verification error:", error);
      const errorMessage = error.message || "Failed to verify NPI. Please try again.";
      setErrors(prev => ({
        ...prev,
        npiNumber: errorMessage
      }));
      setIsNpiVerified(false);
      toast({
        title: "NPI Verification Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingNpi(false);
    }
  };

  // Handle constrained identifiers. NPI remains numeric; license number can be alphanumeric.
  const handleNumericChange = async (e) => {
    const { name, value } = e.target;
    const nextValue =
      name === "licenseNumber"
        ? value.replace(/[^a-zA-Z0-9]/g, '')
        : value.replace(/\D/g, '');

    if (name === "npiNumber" && nextValue !== formData.npiNumber) {
      setIsNpiVerified(false);
    }

    setFormData(prev => ({ ...prev, [name]: nextValue }));
    setErrors(prev => ({ ...prev, [name]: "" }));

    if (name === "npiNumber" && isStaffRole) {
      return;
    }

    // Automatically verify NPI when 10 digits are entered
    if (name === "npiNumber" && nextValue.length === 10 && validateNPI(nextValue)) {
      await verifyNPI(nextValue);
    }
  };

  // Validate fields on blur
  const handleFirstNameBlur = () => {
    if (formData.firstName && !validateName(formData.firstName)) {
      setErrors(prev => ({ ...prev, firstName: "Please enter a valid first name" }));
    }
  };

  const handleLastNameBlur = () => {
    if (formData.lastName && !validateName(formData.lastName)) {
      setErrors(prev => ({ ...prev, lastName: "Please enter a valid last name" }));
    }
  };

  const handleSecondaryEmailBlur = () => {
    if (formData.secondaryEmail && !validateEmail(formData.secondaryEmail)) {
      setErrors(prev => ({ ...prev, secondaryEmail: "Please enter a valid email address" }));
    }
  };

  const handleNPIBlur = () => {
    if (isStaffRole) {
      setErrors(prev => ({ ...prev, npiNumber: "" }));
      setIsNpiVerified(false);
      return;
    }

    if (formData.npiNumber && !validateNPI(formData.npiNumber)) {
      setErrors(prev => ({ ...prev, npiNumber: "NPI must be exactly 10 digits" }));
      setIsNpiVerified(false);
      return;
    }

    // If NPI is valid but not verified yet, verify it
    if (formData.npiNumber && validateNPI(formData.npiNumber) && !isNpiVerified && !isVerifyingNpi) {
      verifyNPI(formData.npiNumber);
    } else if (formData.npiNumber && validateNPI(formData.npiNumber)) {
      // Clear error if format is valid
      setErrors(prev => ({ ...prev, npiNumber: "" }));
    }
  };

  const handleZipCodeBlur = () => {
    // Validate zip code format (exactly 5 digits)
    if (formData.practiceAddress.zip) {
      if (formData.practiceAddress.zip.length !== 5) {
        setErrors(prev => ({
          ...prev,
          practiceAddress: {
            ...prev.practiceAddress,
            zip: "Zip code must be exactly 5 digits"
          }
        }));
      } else if (!/^\d{5}$/.test(formData.practiceAddress.zip)) {
        setErrors(prev => ({
          ...prev,
          practiceAddress: {
            ...prev.practiceAddress,
            zip: "Zip code must contain only numbers"
          }
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          practiceAddress: {
            ...prev.practiceAddress,
            zip: ""
          }
        }));
      }
    }
  };

  // Handle practice address field changes
  const handlePracticeAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      practiceAddress: {
        ...prev.practiceAddress,
        [field]: value
      }
    }));
    setErrors(prev => ({
      ...prev,
      practiceAddress: {
        ...prev.practiceAddress,
        [field]: ""
      }
    }));
  };

  // Handle state selection toggle
  const handleStateToggle = (state) => {
    setFormData(prev => {
      const currentStates = prev.statesOfLicense || [];
      const isSelected = currentStates.includes(state);

      return {
        ...prev,
        statesOfLicense: isSelected
          ? currentStates.filter(s => s !== state)
          : [...currentStates, state]
      };
    });

    // Clear error when a state is selected
    setErrors(prev => ({ ...prev, statesOfLicense: "" }));
  };

  const getFirstValidationError = (validationErrors) =>
    validationErrors.firstName ||
    validationErrors.lastName ||
    validationErrors.primaryEmail ||
    validationErrors.secondaryEmail ||
    validationErrors.role ||
    validationErrors.npiNumber ||
    validationErrors.specialty ||
    validationErrors.statesOfLicense ||
    validationErrors.clinicName ||
    validationErrors.practiceAddress?.street ||
    validationErrors.practiceAddress?.city ||
    validationErrors.practiceAddress?.state ||
    validationErrors.practiceAddress?.zip ||
    validationErrors.transcriptPurging ||
    validationErrors.baaSignature ||
    validationErrors.terms ||
    "Please complete the required fields before submitting.";

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset errors
    const newErrors = { ...initialErrors };

    let hasError = false;

    // Validate mandatory fields
    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
      hasError = true;
    } else if (!validateName(formData.firstName)) {
      newErrors.firstName = "Please enter a valid first name";
      hasError = true;
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
      hasError = true;
    } else if (!validateName(formData.lastName)) {
      newErrors.lastName = "Please enter a valid last name";
      hasError = true;
    }

    if (!formData.primaryEmail) {
      newErrors.primaryEmail = "Primary email is required";
      hasError = true;
    } else if (!validateEmail(formData.primaryEmail)) {
      newErrors.primaryEmail = "Please enter a valid email address";
      hasError = true;
    }

    // Validate secondary email if provided
    if (formData.secondaryEmail && !validateEmail(formData.secondaryEmail)) {
      newErrors.secondaryEmail = "Please enter a valid email address";
      hasError = true;
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
      hasError = true;
    }

    if (shouldValidateNpi) {
      if (!formData.npiNumber) {
        newErrors.npiNumber = "NPI number is required";
        hasError = true;
      } else if (!validateNPI(formData.npiNumber)) {
        newErrors.npiNumber = "NPI must be exactly 10 digits";
        hasError = true;
      } else if (!isNpiVerified) {
        newErrors.npiNumber = "Please verify your NPI number before submitting";
        hasError = true;
      }
    }

    if (shouldRequireSpecialty && !formData.specialty) {
      newErrors.specialty = "Specialty is required";
      hasError = true;
    }

    if (!formData.statesOfLicense || formData.statesOfLicense.length === 0) {
      newErrors.statesOfLicense = "At least one state of license is required";
      hasError = true;
    }

    if (!formData.transcriptPurging) {
      newErrors.transcriptPurging = "Please select a transcript retention period";
      hasError = true;
    }

    // Clinic/Practice name is always mandatory
    if (!formData.clinicName) {
      newErrors.clinicName = "Clinic/Practice name is required";
      hasError = true;
    }

    // Practice state is always mandatory
    if (!formData.practiceAddress.state) {
      newErrors.practiceAddress.state = "State is required";
      hasError = true;
    }

    // Validate additional clinic fields for clinic signup type
    if (signupType === "clinic") {
      if (!formData.practiceAddress.street) {
        newErrors.practiceAddress.street = "Street address is required";
        hasError = true;
      }
      if (!formData.practiceAddress.city) {
        newErrors.practiceAddress.city = "City is required";
        hasError = true;
      }
      if (!formData.practiceAddress.zip) {
        newErrors.practiceAddress.zip = "Zip code is required";
        hasError = true;
      } else if (formData.practiceAddress.zip.length !== 5) {
        newErrors.practiceAddress.zip = "Zip code must be exactly 5 digits";
        hasError = true;
      } else if (!/^\d{5}$/.test(formData.practiceAddress.zip)) {
        newErrors.practiceAddress.zip = "Zip code must contain only numbers";
        hasError = true;
      }
    }

    // Validate zip code format if provided (regardless of signup type)
    if (formData.practiceAddress.zip && formData.practiceAddress.zip.length > 0) {
      if (formData.practiceAddress.zip.length !== 5) {
        newErrors.practiceAddress.zip = "Zip code must be exactly 5 digits";
        hasError = true;
      } else if (!/^\d{5}$/.test(formData.practiceAddress.zip)) {
        newErrors.practiceAddress.zip = "Zip code must contain only numbers";
        hasError = true;
      }
    }

    if (!agreeToTerms || !acknowledgeClinicalResponsibility || !acknowledgeRetentionPolicy) {
      newErrors.terms = "Complete all required acknowledgements";
      hasError = true;
    }

    if (!baaSignature?.signed) {
      newErrors.baaSignature = "You must review and accept the Clinical Data & Privacy Agreement before registering";
      hasError = true;
    }

    // Set all errors to display validation messages
    setErrors(newErrors);

    // If there are validation errors, stop form submission
    if (hasError) {
      toast({
        title: "Please review required fields",
        description: getFirstValidationError(newErrors),
        variant: "destructive",
      });

      // Scroll to first error field for better UX
      setTimeout(() => {
        const firstErrorField = document.querySelector('.border-red-500');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setIsLoading(true);

    try {
      const backendToken = sessionStorage.getItem("backendToken");

      if (!backendToken) {
        const errorMsg = "Authentication token not found. Please log in again.";
        setErrors((prev) => ({
          ...prev,
          general: errorMsg,
        }));
        toast({
          title: "Authentication Required",
          description: errorMsg,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      let practiceAddressData = null;
      if (signupType === "clinic" ||
        formData.practiceAddress.street ||
        formData.practiceAddress.city ||
        formData.practiceAddress.state ||
        formData.practiceAddress.zip) {
        practiceAddressData = formData.practiceAddress;
      }

      const payload = {
        firstName: formData.firstName,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName,
        primaryEmail: formData.primaryEmail,
        secondaryEmail: formData.secondaryEmail || undefined,
        role: formData.role,
        npiNumber: shouldValidateNpi ? formData.npiNumber || undefined : undefined,
        specialty: specialtyValue,
        subSpecialty: formData.subSpecialty || undefined,
        statesOfLicense: formData.statesOfLicense,
        licenseNumber: formData.licenseNumber || undefined,
        clinicName: formData.clinicName || undefined,
        practiceAddress: practiceAddressData,
        termsAccepted: agreeToTerms,
        privacyAccepted: agreeToTerms,
        clinicalResponsibilityAccepted: acknowledgeClinicalResponsibility,
        baaAccepted: Boolean(baaSignature?.signed),
        baaVersion: baaSignature?.baaVersion,
        baaSignedAt: baaSignature?.signedAt,
        baaSignedTimeZone: baaSignature?.signedTimeZone || getBrowserTimeZone(),
        baaSignerName: baaSignature?.signerName,
        baaManualSignature: baaSignature?.manualSignature || undefined,
        baaAgreementTitle: baaSignature?.agreementTitle || AGREEMENT_DISPLAY_TITLE,
        baaSignature,
        signupType: signupType,
        invitationToken: invitationToken || undefined,
        transcript_purging: [
          {
            enabled: formData.transcriptPurging === "never" ? "no" : "yes",
            time_line: formData.transcriptPurging === "never" ? "" : formData.transcriptPurging
          }
        ],
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      // Call /api/standalone/register with registration data
      const response = await fetch(backendApi("api/standalone/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${backendToken}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const missingFieldsMessage = Array.isArray(errorData.fields) && errorData.fields.length > 0
          ? ` Missing fields: ${errorData.fields.join(", ")}.`
          : "";
        const baseMessage =
          errorData.message ||
          errorData.error ||
          `Registration failed: ${response.status}`;
        throw new Error(`${baseMessage}${missingFieldsMessage}`);
      }

      const registeredUser = await response.json();


      // Mark registration as complete
      sessionStorage.setItem("standaloneRegistrationComplete", "true");

      // Show success message
      toast({
        title: "Registration Successful!",
        description:
          registeredUser.approvalStatus === "approved"
            ? `Welcome ${formData.firstName}! Your account has been created successfully.`
            : "Please contact your clinic admin to approve your request.",
        variant: "default",
      });

      // Remove hash from URL before navigating
      if (window.history && window.history.replaceState) {
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search
        );
      }

      // Hand off to the main app for both approved and pending users.
      setTimeout(() => {
        redirectToMainApp();
      }, 1500);

    } catch (error) {
      const errorMsg = error.message || "Registration failed. Please try again or contact support if the issue persists.";
      setErrors((prev) => ({
        ...prev,
        general: errorMsg,
      }));
      toast({
        title: "Registration Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#EFF6FF] via-white to-[#EFF6FF] px-4 py-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-[#EFF6FF]/90 backdrop-blur-sm"></div>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <Loader2 className="h-12 w-12 animate-spin text-[#3B82F6]" />
        </div>
      )}

      {!isLoading && (
        <div className="relative z-10 flex w-full max-w-6xl animate-fadeIn flex-col items-center rounded-2xl border border-white/70 bg-white/95 px-4 py-5 shadow-xl shadow-[#1E3A8A]/10 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 flex items-center justify-center">
              <Logo size="large" />
            </div>
          </div>

          <h2 className="mb-1 text-center text-2xl font-extrabold text-[#1E3A8A]">
            Complete secure onboarding
          </h2>
          <p className="mb-4 max-w-2xl text-center text-sm leading-6 text-gray-600">
            Configure your clinical profile, practice details, and compliance preferences for Seismic Connect.
          </p>
          <div className="mb-6 flex w-full max-w-2xl items-center justify-center rounded-full border border-[#DBEAFE] bg-[#EFF6FF]/70 px-3 py-2 text-xs font-semibold text-[#1E40AF] shadow-sm sm:text-sm">
            <span>Account & Credentials</span>
            <span className="mx-2 h-px w-8 bg-[#BFDBFE] sm:w-14" />
            <span>Practice</span>
            <span className="mx-2 h-px w-8 bg-[#BFDBFE] sm:w-14" />
            <span>Security & Compliance</span>
          </div>

          {/*
        <div className="flex justify-center mb-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-full">
            <label className="cursor-pointer flex-1 min-w-[180px]">
              <input
                type="radio"
                name="signupType"
                value="standalone"
                checked={signupType === "standalone"}
                onChange={(e) => setSignupType(e.target.value)}
                className="hidden"
              />
              <div className={`px-6 py-2.5 rounded-full text-center text-sm font-medium transition-all ${
                signupType === "standalone"
                    ? "bg-[#1E40AF] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    signupType === "standalone"
                      ? "border-white bg-white"
                      : "border-gray-400 bg-white"
                  }`}>
                    {signupType === "standalone" && (
                    <div className="w-2 h-2 rounded-full bg-[#1E40AF]"></div>
                    )}
                  </div>
                  <span>Standalone</span>
                </div>
              </div>
            </label>

            <label className="cursor-pointer flex-1 min-w-[180px]">
              <input
                type="radio"
                name="signupType"
                value="clinic"
                checked={signupType === "clinic"}
                onChange={(e) => setSignupType(e.target.value)}
                className="hidden"
              />
              <div className={`px-6 py-2.5 rounded-full text-center text-sm font-medium transition-all ${
                signupType === "clinic"
                    ? "bg-[#1E40AF] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    signupType === "clinic"
                      ? "border-white bg-white"
                      : "border-gray-400 bg-white"
                  }`}>
                    {signupType === "clinic" && (
                    <div className="w-2 h-2 rounded-full bg-[#1E40AF]"></div>
                    )}
                  </div>
                  <span>Clinic / LeapGen</span>
                </div>
              </div>
            </label>
          </div>
        </div>
        */}
          <form onSubmit={handleSubmit} className="w-full space-y-6" autoComplete="off">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">Step 1 of 3</p>
                <h3 className="text-lg font-semibold text-slate-950">Account & Credentials</h3>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleNameChange}
                    onBlur={handleFirstNameBlur}
                    placeholder="First Name"
                    className={`w-full ${errors.firstName ? "border-red-500" : ""}`}
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
                </div>

                <div>
                  <Label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Name
                  </Label>
                  <Input
                    id="middleName"
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleNameChange}
                    placeholder="Middle Name"
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleNameChange}
                    onBlur={handleLastNameBlur}
                    placeholder="Last Name"
                    className={`w-full ${errors.lastName ? "border-red-500" : ""}`}
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="primaryEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Email<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="primaryEmail"
                    type="email"
                    name="primaryEmail"
                    value={formData.primaryEmail}
                    readOnly
                    disabled
                    placeholder="Primary Email"
                    className={`w-full bg-gray-50 ${errors.primaryEmail ? "border-red-500" : ""}`}
                  />
                  {errors.primaryEmail && <p className="mt-1 text-xs text-red-500">{errors.primaryEmail}</p>}
                </div>

                <div>
                  <Label htmlFor="secondaryEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Email
                  </Label>
                  <Input
                    id="secondaryEmail"
                    type="email"
                    name="secondaryEmail"
                    value={formData.secondaryEmail}
                    onChange={handleChange}
                    onBlur={handleSecondaryEmailBlur}
                    placeholder="Secondary Email"
                    className={`w-full ${errors.secondaryEmail ? "border-red-500" : ""}`}
                  />
                  {errors.secondaryEmail && <p className="mt-1 text-xs text-red-500">{errors.secondaryEmail}</p>}
                </div>

                <div className="relative">
                  <Label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Role<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, role: value }));
                      setErrors(prev => ({ ...prev, role: "" }));
                    }}
                    disabled={Boolean(invitationDetails)}
                  >
                    <SelectTrigger
                      className={`w-full ${errors.role ? "border-red-500" : ""}`}
                    >
                      <SelectValue
                        placeholder={isLoadingRoles ? "Loading roles..." : "Role"}
                      />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-white border border-gray-200 shadow-lg">
                      {roleOptions.map((role) => (
                        <SelectItem
                          key={role.roleName}
                          value={role.roleName}
                          className="cursor-pointer hover:bg-gray-100"
                        >
                          {role.roleName}
                          {role.type === "custom" ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {invitationDetails ? (
                    <p className="mt-1 text-xs text-[#1D4ED8]">
                      This role was prefilled from your invitation.
                    </p>
                  ) : null}
                  {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role}</p>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="npiNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    NPI Number{shouldValidateNpi && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="npiNumber"
                    type="text"
                    name="npiNumber"
                    value={formData.npiNumber}
                    onChange={handleNumericChange}
                    onBlur={handleNPIBlur}
                    placeholder="NPI Number"
                    maxLength={10}
                    inputMode="numeric"
                    disabled={isVerifyingNpi || isStaffRole}
                    className={`w-full ${isStaffRole ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""} ${errors.npiNumber ? "border-red-500" : isNpiVerified ? "border-green-500" : ""}`}
                  />
                  {isVerifyingNpi && <p className="mt-1 text-xs text-[#3B82F6]">Verifying NPI...</p>}
                  {!isVerifyingNpi && errors.npiNumber && <p className="mt-1 text-xs text-red-500">{errors.npiNumber}</p>}
                  {!isVerifyingNpi && !errors.npiNumber && isNpiVerified && formData.npiNumber && (
                    <p className="mt-1 text-xs text-green-600">NPI verified successfully</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                    Specialty{shouldRequireSpecialty && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="specialty"
                    type="text"
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleNameChange}
                    placeholder="Specialty"
                    disabled={areProfessionalDetailsDisabled}
                    className={`w-full ${areProfessionalDetailsDisabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""} ${errors.specialty ? "border-red-500" : ""}`}
                  />
                  {errors.specialty && <p className="mt-1 text-xs text-red-500">{errors.specialty}</p>}
                </div>

                <div>
                  <Label htmlFor="subSpecialty" className="block text-sm font-medium text-gray-700 mb-1">
                    Sub-specialty
                  </Label>
                  <Input
                    id="subSpecialty"
                    type="text"
                    name="subSpecialty"
                    value={formData.subSpecialty}
                    onChange={handleNameChange}
                    placeholder="Sub-specialty"
                    disabled={areProfessionalDetailsDisabled}
                    className={`w-full ${areProfessionalDetailsDisabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="relative states-dropdown-container">
                  <Label htmlFor="statesOfLicense" className="block text-sm font-medium text-gray-700 mb-1">
                    State(s) of License<span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatesDropdownOpen(!isStatesDropdownOpen)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-white ${errors.statesOfLicense ? "border-red-500" : "border-gray-300"} hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]`}
                    >
                      <span className={formData.statesOfLicense.length > 0 ? "text-gray-900" : "text-gray-400"}>
                        {formData.statesOfLicense.length > 0
                          ? `${formData.statesOfLicense.length} state${formData.statesOfLicense.length > 1 ? 's' : ''} selected`
                          : "Select states"}
                      </span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isStatesDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {US_STATES.map(state => (
                          <label
                            key={state}
                            className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          >
                            <Checkbox
                              checked={formData.statesOfLicense.includes(state)}
                              onCheckedChange={() => handleStateToggle(state)}
                              className="w-4 h-4 border-2 border-gray-300 rounded bg-white data-[state=checked]:bg-[#1E40AF] data-[state=checked]:border-[#1E40AF] data-[state=checked]:text-white"
                            />
                            <span className="ml-2 text-sm text-gray-700">{state}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.statesOfLicense.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {formData.statesOfLicense.map(state => (
                        <span
                          key={state}
                          className="inline-flex items-center px-2 py-1 text-xs bg-[#DBEAFE] text-[#1E3A8A] rounded"
                        >
                          {state}
                          <button
                            type="button"
                            onClick={() => handleStateToggle(state)}
                            className="ml-1 hover:text-[#1E3A8A]"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {errors.statesOfLicense && <p className="mt-1 text-xs text-red-500">{errors.statesOfLicense}</p>}
                </div>

                <div>
                  <Label htmlFor="licenseNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    License Number
                  </Label>
                  <Input
                    id="licenseNumber"
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleNumericChange}
                    placeholder="License Number"
                    disabled={areProfessionalDetailsDisabled}
                    className={`w-full ${areProfessionalDetailsDisabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">Step 2 of 3</p>
                <h3 className="text-lg font-semibold text-slate-950">Practice</h3>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div ref={clinicDropdownRef} className="relative">
                  <Label htmlFor="clinicName" className="block text-sm font-medium text-gray-700 mb-1">
                    Clinic/Practice Name<span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="clinicName"
                      type="text"
                      name="clinicName"
                      value={formData.clinicName}
                      onChange={handleChange}
                      onBlur={handleClinicNameBlur}
                      onFocus={() => setIsClinicDropdownOpen(true)}
                      placeholder="Search clinics or add a new one"
                      disabled={Boolean(invitationDetails)}
                      className={`w-full pr-9 ${errors.clinicName ? "border-red-500" : ""}`}
                    />
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                  {isClinicDropdownOpen && !invitationDetails && (
                    <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                      {isSearchingClinics ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Searching clinics...</div>
                      ) : (
                        <>
                          {clinicOptions.map((clinic) => (
                            <button
                              key={clinic.id || clinic.clinicName}
                              type="button"
                              onMouseDown={() => handleClinicSelect(clinic.clinicName, true)}
                              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {clinic.clinicName}
                            </button>
                          ))}
                          {formData.clinicName.trim() ? (
                            <button
                              type="button"
                              onMouseDown={() => handleClinicSelect(formData.clinicName.trim(), false)}
                              className="block w-full px-3 py-2 text-left text-sm font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                            >
                              Use "{formData.clinicName.trim()}" as a new clinic
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                  {!isSearchingClinics &&
                    normalizeClinicName(existingClinicMatch) === normalizeClinicName(formData.clinicName) &&
                    formData.clinicName.trim().length > 2 &&
                    !invitationDetails && (
                      <div className="mt-2 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] p-2 text-xs font-semibold text-[#1D4ED8] shadow-sm">
                        This clinic already exists in the system.
                      </div>
                    )}
                  {invitationDetails ? (
                    <p className="mt-1 text-xs text-[#1D4ED8]">
                      This clinic was prefilled from your invitation.
                    </p>
                  ) : null}
                  {errors.clinicName && <p className="mt-1 text-xs text-red-500">{errors.clinicName}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="practiceAddressStreet" className="block text-sm font-medium text-gray-700 mb-1">
                    {signupType === "clinic" ? (
                      <>Address<span className="text-red-500">*</span></>
                    ) : (
                      "Address"
                    )}
                  </Label>
                  <Input
                    id="practiceAddressStreet"
                    type="text"
                    name="street"
                    value={formData.practiceAddress.street}
                    onChange={(e) => handlePracticeAddressChange("street", e.target.value)}
                    placeholder="Street Address"
                    className={`w-full ${errors.practiceAddress?.street ? "border-red-500" : ""}`}
                  />
                  {errors.practiceAddress?.street && <p className="mt-1 text-xs text-red-500">{errors.practiceAddress.street}</p>}
                </div>
              </div>

              {/* Row 2: Practice Address - Street, City, State */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Street Address */}


                {/* City */}
                <div>
                  <Label htmlFor="practiceAddressCity" className="block text-sm font-medium text-gray-700 mb-1">
                    {signupType === "clinic" ? (
                      <>City<span className="text-red-500">*</span></>
                    ) : (
                      "City"
                    )}
                  </Label>
                  <Input
                    id="practiceAddressCity"
                    type="text"
                    name="city"
                    value={formData.practiceAddress.city}
                    onChange={(e) => handlePracticeAddressChange("city", e.target.value)}
                    placeholder="City"
                    className={`w-full ${errors.practiceAddress?.city ? "border-red-500" : ""}`}
                  />
                  {errors.practiceAddress?.city && <p className="mt-1 text-xs text-red-500">{errors.practiceAddress.city}</p>}
                </div>

                {/* State */}
                <div className="relative">
                  <Label htmlFor="practiceAddressState" className="block text-sm font-medium text-gray-700 mb-1">
                    State<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.practiceAddress.state}
                    onValueChange={(value) => handlePracticeAddressChange("state", value)}
                  >
                    <SelectTrigger className={`w-full ${errors.practiceAddress?.state ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-60 bg-white border border-gray-200 shadow-lg">
                      {US_STATES.map(state => (
                        <SelectItem key={state} value={state} className="cursor-pointer hover:bg-gray-100">
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.practiceAddress?.state && <p className="mt-1 text-xs text-red-500">{errors.practiceAddress.state}</p>}
                </div>
                <div>
                  <Label htmlFor="practiceAddressZip" className="block text-sm font-medium text-gray-700 mb-1">
                    {signupType === "clinic" ? (
                      <>Zip Code<span className="text-red-500">*</span></>
                    ) : (
                      "Zip Code"
                    )}
                  </Label>
                  <Input
                    id="practiceAddressZip"
                    type="text"
                    name="zip"
                    value={formData.practiceAddress.zip}
                    onChange={(e) => {
                      const zipValue = e.target.value.replace(/\D/g, '').slice(0, 5);
                      handlePracticeAddressChange("zip", zipValue);
                    }}
                    onBlur={handleZipCodeBlur}
                    placeholder="Zip Code"
                    maxLength={5}
                    inputMode="numeric"
                    className={`w-full ${errors.practiceAddress?.zip ? "border-red-500" : ""}`}
                  />
                  {errors.practiceAddress?.zip && <p className="mt-1 text-xs text-red-500">{errors.practiceAddress.zip}</p>}
                </div>
              </div>


            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">Step 3 of 3</p>
                  <h3 className="text-lg font-semibold text-slate-950">Security & Compliance</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Set your clinical data retention preference and complete secure agreement acknowledgements.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1E40AF]">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  HIPAA-aware onboarding
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className={`rounded-xl border p-4 ${errors.transcriptPurging ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50/70"}`}>
                  <div className="mb-3 flex items-start gap-3">
                    <div className="rounded-md bg-white p-2 text-[#1D4ED8] shadow-sm">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-slate-950">
                        Transcript Retention<span className="text-red-500">*</span>
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Clinical transcripts are automatically deleted after the selected retention period.
                      </p>
                    </div>
                  </div>
                  <Select
                    value={formData.transcriptPurging}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, transcriptPurging: value }));
                      setErrors(prev => ({ ...prev, transcriptPurging: "" }));
                    }}
                  >
                    <SelectTrigger className={`w-full bg-white ${errors.transcriptPurging ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select retention period" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-white border border-gray-200 shadow-lg">
                      {RETENTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="cursor-pointer hover:bg-gray-100">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.transcriptPurging && <p className="mt-2 text-xs text-red-500">{errors.transcriptPurging}</p>}
                </div>

                <div className={`rounded-xl border bg-white p-4 shadow-sm ${errors.baaSignature || errors.terms ? "border-red-200" : "border-slate-200"}`}>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-[#EFF6FF] p-2 text-[#1D4ED8]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-slate-950">
                          Clinical Data & Privacy Agreement<span className="text-red-500">*</span>
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Please review and accept the clinical data and privacy terms to continue setup.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAgreementOpen}
                      className="inline-flex items-center justify-center rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#1E40AF] hover:bg-[#DBEAFE]"
                    >
                      View Agreement
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="baaSignerName" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Legal Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="baaSignerName"
                        value={baaSignerName}
                        onChange={(event) => {
                          setBaaSignerName(event.target.value);
                          setErrors(prev => ({ ...prev, baaSignature: "" }));
                        }}
                        placeholder={baaUserDraft.fullName || "Full legal name"}
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="baaSignerRole" className="block text-sm font-medium text-gray-700 mb-1">
                        Optional Title/Role
                      </Label>
                      <Input
                        id="baaSignerRole"
                        value={baaSignerRole}
                        onChange={(event) => setBaaSignerRole(event.target.value)}
                        placeholder="e.g., Practice Administrator"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-600">
                      The agreement opens in a focused review window. Acknowledgements and final acceptance appear after you scroll through the PDF.
                    </p>
                    <button
                      type="button"
                      onClick={handleAgreementOpen}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1E3A8A]"
                    >
                      <FileText className="h-4 w-4" />
                      Review and Accept
                    </button>
                  </div>
                  {baaSignature?.signed && (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1E3A8A] ring-1 ring-[#BFDBFE]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Agreement accepted {baaSignature.baaVersion}
                    </span>
                  )}
                  {errors.baaSignature && <p className="mt-2 text-xs text-red-500">{errors.baaSignature}</p>}
                {errors.terms && <p className="mt-2 text-xs text-red-500">{errors.terms}</p>}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 pt-1">
              <div className="text-center text-xs font-semibold text-slate-500">
                HIPAA Compliant • Encrypted Infrastructure • Secure Clinical Data
              </div>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  isVerifyingNpi ||
                  (shouldValidateNpi && !isNpiVerified) ||
                  !baaSignature?.signed ||
                  !agreeToTerms ||
                  !acknowledgeClinicalResponsibility ||
                  !acknowledgeRetentionPolicy
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] py-3 font-semibold text-white transition-all duration-200 hover:from-[#1E3A8A] hover:to-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[320px]"
              >
                {isLoading ? "Completing..." : "Complete Secure Registration"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Heartbeat Animation (Same as Login Page) --- */}
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

          /* Scrollbar styling for Select dropdowns */
          [data-radix-select-viewport] {
            overflow-y: auto !important;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
          }

          [data-radix-select-viewport]::-webkit-scrollbar {
            width: 8px;
          }

          [data-radix-select-viewport]::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }

          [data-radix-select-viewport]::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }

          [data-radix-select-viewport]::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
      </div>

      {/* Terms Dialog */}
      {isBaaAgreementOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-0 sm:p-6">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-950">{AGREEMENT_DISPLAY_TITLE}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Scroll through the PDF. Acknowledgements and acceptance unlock at the end.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAgreementClose}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close agreement"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              ref={agreementScrollRef}
              onScroll={updateAgreementReviewProgress}
              className="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-4 sm:px-6 sm:py-6"
            >
              <Document
                file={BAA_AGREEMENT_PDF_URL}
                onLoadSuccess={handleAgreementDocumentLoadSuccess}
                onLoadError={handleAgreementDocumentLoadError}
                loading={
                  <div className="flex min-h-[280px] items-center justify-center rounded-lg bg-white text-sm text-slate-600 shadow-sm">
                    Rendering agreement...
                  </div>
                }
                error={
                  <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {agreementPdfError || "Unable to render the agreement PDF here."}{" "}
                    <a className="font-semibold underline" href={BAA_AGREEMENT_PDF_URL} target="_blank" rel="noreferrer">
                      Open PDF in a new tab
                    </a>
                  </div>
                }
                className="mx-auto flex w-full flex-col items-center gap-5"
              >
                {Array.from(new Array(agreementNumPages || 0), (_, index) => (
                  <div key={`registration-agreement-page-${index + 1}`} className="overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-slate-200">
                    <Page
                      pageNumber={index + 1}
                      width={agreementPdfWidth}
                      loading={
                        <div className="flex h-80 items-center justify-center text-sm text-slate-500">
                          Rendering page {index + 1}...
                        </div>
                      }
                    />
                  </div>
                ))}
              </Document>

              <div className={`mx-auto mt-5 max-w-[820px] rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${hasReviewedAgreement ? "border-[#BFDBFE]" : "border-[#DBEAFE]"}`}>
                <div className="mb-4 flex items-start gap-3">
                  <div className={`rounded-md p-2 ${hasReviewedAgreement ? "bg-[#EFF6FF] text-[#1E40AF]" : "bg-[#EFF6FF] text-[#1D4ED8]"}`}>
                    {hasReviewedAgreement ? <CheckCircle2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">
                      {hasReviewedAgreement ? "Acknowledgements" : "Continue reviewing"}
                      <span className="text-red-500">*</span>
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {hasReviewedAgreement
                        ? "Confirm the required items below, then accept the agreement."
                        : `Scroll to the end of the ${agreementNumPages || ""}-page PDF to unlock final acceptance.`}
                    </p>
                  </div>
                </div>

                {hasReviewedAgreement && (
                  <>
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                      <Checkbox
                        id="agreementMasterAcknowledgement"
                        checked={allAgreementAcknowledgementsChecked}
                        onCheckedChange={handleAllAgreementAcknowledgementsChange}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-gray-300 bg-white data-[state=checked]:border-[#1E40AF] data-[state=checked]:bg-[#1E40AF] data-[state=checked]:text-white"
                      />
                      <Label htmlFor="agreementMasterAcknowledgement" className="text-sm font-medium leading-5 text-slate-800 cursor-pointer">
                        Select all required acknowledgements for this agreement.
                      </Label>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          id: "terms",
                          checked: agreeToTerms,
                          onChange: setAgreeToTerms,
                          content: (
                            <>
                              I agree to the{" "}
                              <button type="button" onClick={() => setIsTermsDialogOpen(true)} className="font-medium text-[#1E40AF] hover:underline">
                                Terms of Service and Privacy Policy
                              </button>
                              .
                            </>
                          ),
                        },
                        {
                          id: "clinicalResponsibility",
                          checked: acknowledgeClinicalResponsibility,
                          onChange: setAcknowledgeClinicalResponsibility,
                          content: "I acknowledge AI-assisted clinical documentation responsibilities.",
                        },
                        {
                          id: "retentionPolicy",
                          checked: acknowledgeRetentionPolicy,
                          onChange: setAcknowledgeRetentionPolicy,
                          content: "I understand the selected transcript retention policy.",
                        },
                        {
                          id: "baaAuthorized",
                          checked: isBaaAuthorized,
                          onChange: setIsBaaAuthorized,
                          content: "I acknowledge and accept the clinical data and privacy terms.",
                        },
                      ].map((item) => (
                        <div key={item.id} className="flex items-start gap-3">
                          <Checkbox
                            id={item.id}
                            checked={item.checked}
                            onCheckedChange={(checked) => {
                              item.onChange(Boolean(checked));
                              if (checked) setErrors(prev => ({ ...prev, baaSignature: "", terms: "" }));
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-2 border-gray-300 bg-white data-[state=checked]:border-[#1E40AF] data-[state=checked]:bg-[#1E40AF] data-[state=checked]:text-white"
                          />
                          <Label htmlFor={item.id} className="text-sm leading-5 text-slate-700 cursor-pointer">
                            {item.content}<span className="text-red-500">*</span>
                          </Label>
                        </div>
                      ))}
                    </div>

                    {(errors.baaSignature || errors.terms) && (
                      <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                        {errors.baaSignature || errors.terms}
                      </div>
                    )}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={BAA_AGREEMENT_PDF_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-[#1E40AF] hover:underline"
                      >
                        Open PDF in a new tab
                      </a>
                      <button
                        type="button"
                        onClick={handleBaaAccepted}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1E3A8A]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept Agreement
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <TermsDialog open={isTermsDialogOpen} onOpenChange={setIsTermsDialogOpen} />
    </div>
  );
};

export default RegisterPage
