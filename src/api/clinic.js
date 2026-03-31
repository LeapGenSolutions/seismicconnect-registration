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

function readClinicResults(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.clinics)) {
    return payload.clinics;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const CLINIC_SEARCH_PATHS = [
  (query) => `/api/clinics/search?query=${encodeURIComponent(query)}`,
  (query) => `/api/clinics/search?q=${encodeURIComponent(query)}`,
  (query) => `/api/clinics?query=${encodeURIComponent(query)}`,
  (query) => `/api/clinics?search=${encodeURIComponent(query)}`,
];

export async function searchClinics(search) {
  const trimmedSearch = String(search || "").trim();
  if (!trimmedSearch) {
    return [];
  }

  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  let lastError = null;

  for (const makePath of CLINIC_SEARCH_PATHS) {
    const response = await fetch(api(makePath(trimmedSearch)), { headers });
    const payload = await parseJson(response);

    if (response.ok) {
      return readClinicResults(payload);
    }

    if (response.status !== 404) {
      lastError = new Error(
        payload?.message || payload?.error || "Failed to search clinics"
      );
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}
