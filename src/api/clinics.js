import { BACKEND_URL } from "../constants";

const BASE = (BACKEND_URL || "").replace(/\/+$/, "");
const api = (path) => `${BASE}/${String(path).replace(/^\/+/, "")}`;

function getAuthHeaders() {
  const token = sessionStorage.getItem("backendToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response, fallbackMessage) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || fallbackMessage);
  }

  return data;
}

export async function searchClinics(search) {
  const response = await fetch(
    api(`/api/clinics?search=${encodeURIComponent(search)}`),
    {
      headers: {
        ...getAuthHeaders(),
      },
    }
  );

  return parseResponse(response, "Failed to search clinics");
}
