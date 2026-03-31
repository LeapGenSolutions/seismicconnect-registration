import { BACKEND_URL } from "../constants";

const BASE = (BACKEND_URL || "").replace(/\/+$/, "");
const api = (path) => `${BASE}/${String(path).replace(/^\/+/, "")}`;

function getAuthHeaders() {
  if (typeof window === "undefined") {
    return {};
  }

  const token = window.sessionStorage.getItem("backendToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const INVITATION_PATHS = [
  (token) => `/api/invitations/token/${encodeURIComponent(token)}`,
  (token) => `/api/invitations/${encodeURIComponent(token)}`,
  (token) => `/api/invitations/details/${encodeURIComponent(token)}`,
  (token) => `/api/standalone/invitations/${encodeURIComponent(token)}`,
  (token) => `/api/standalone/invitations/details/${encodeURIComponent(token)}`,
];

function readInvitation(payload) {
  return payload?.invitation || payload?.data || payload;
}

export async function fetchInvitationDetails(invitationToken) {
  const trimmedToken = String(invitationToken || "").trim();
  if (!trimmedToken) {
    throw new Error("Invitation token is required");
  }

  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  let lastError = null;

  for (const makePath of INVITATION_PATHS) {
    const response = await fetch(api(makePath(trimmedToken)), { headers });
    const payload = await parseJson(response);

    if (response.ok) {
      return readInvitation(payload);
    }

    if (response.status !== 404) {
      lastError = new Error(
        payload?.message || payload?.error || "Failed to load invitation details"
      );
      break;
    }
  }

  throw lastError || new Error("Failed to load invitation details");
}
