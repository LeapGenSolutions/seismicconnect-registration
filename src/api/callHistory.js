import { BACKEND_URL } from "../constants";
// FIX for test env double-slash/missing-slash issues:
// ensure exactly one "/" between base and path in every request.
const BASE = (BACKEND_URL || "").replace(/\/+$/, "");
const api = (p) => `${BASE}/${String(p).replace(/^\/+/, "")}`;

export const insertCallHistory = async (sessionId, reqBody) => {
  const response = await fetch(
    api(`/api/call-history/${sessionId}`),
    {
      method: "POST",
      body: JSON.stringify(reqBody),
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (!response.ok) {
    console.log("New call History not inserted. Call history and id might exist");
  }
};

export const fetchCallHistory = async (emails) => {
  if (!emails || emails.length === 0) {
    return
  }
  const response = await fetch(
    api(`/api/call-history?userIDs=${emails.join(",")}`)
  );
  if (!response.ok) {
    throw new Error("Failed to fetch Call History data");
  }
  return response.json();
};

export const fetchDoctorsFromHistory = async (clinicName) => {
  let url = `/api/call-history/doctors`;
  if (clinicName) {
    url += `?clinicName=${encodeURIComponent(clinicName)}`;
  }
  const response = await fetch(api(url));
  if (!response.ok) {
    throw new Error("Failed to fetch Call History data");
  }
  return response.json();
};

export const fetchAppointmentsByDoctorEmails = async (emails, clinicName = "") => {
  // If clinicName is provided, we fetch by clinic using the new efficient endpoint
  // AND we ignore the emails list because the clinic filter is paramount.

  if ((!emails || emails.length === 0) && !clinicName) return [];

  try {
    let url;
    if (clinicName) {
      // Use the new dedicated endpoint for clinic-wide fetching
      url = `/api/appointments/all?clinicName=${encodeURIComponent(clinicName)}`;
    } else {
      // Fallback to existing email-based fetching
      const emailPath = (emails && emails.length > 0) ? emails.join(",") : "all";
      url = `/api/appointments/${emailPath}`;
    }

    const response = await fetch(api(url));
    if (!response.ok) throw new Error("Failed to fetch appointments");

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error fetching appointments:", err);
    return [];
  }
};

// Helper to check Seismified status. Backend returns: { found: [ids], notFound: [ids] }
export const checkAppointments = async (appointmentIDs) => {
  if (!appointmentIDs || appointmentIDs.length === 0)
    return { found: [], notFound: [] };
  if (!appointmentIDs || appointmentIDs.length === 0)
    return { found: [], notFound: [] };

  try {
    const response = await fetch(
      api(`/api/call-history/checkAppointments`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentIDs }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to check appointment seismification status");
    }

    return await response.json(); // { found: [...], notFound: [...] }
  } catch (error) {
    console.error("checkAppointments error:", error);
    return { found: [], notFound: [] };
  }
};
