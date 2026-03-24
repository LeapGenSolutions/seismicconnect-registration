import { BACKEND_URL } from "../constants";

const BASE = (BACKEND_URL || "").replace(/\/+$/, "");
const api = (path) => `${BASE}/${String(path).replace(/^\/+/, "")}`;

export async function fetchRegistrationRoles(clinicName) {
  const response = await fetch(
    api(`/api/rbac/roles/registration/${encodeURIComponent(clinicName)}`)
  );

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Failed to fetch registration roles"
    );
  }

  return Array.isArray(data) ? data : [];
}
