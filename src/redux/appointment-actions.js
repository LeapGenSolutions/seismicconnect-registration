import { BACKEND_URL } from "../constants";
import { appointmentActions } from "./appointment-slice";


export const fetchAppointmentDetails = (email, clinicName = "") => {
  return async (dispatch) => {
    const fetchAppointments = async () => {
      let url = `${BACKEND_URL}api/appointments/${email}`;
      if (clinicName) {
        // Ensure we don't double-slash if BACKEND_URL ends with /
        const base = (BACKEND_URL || "").replace(/\/+$/, "");
        url = `${base}/api/appointments/all?clinicName=${encodeURIComponent(clinicName)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Could not fetch appointment data!');
      }

      const data = await response.json();

      let flatData = data;
      // Handle nested structures similar to callHistory.js logic
      if (Array.isArray(data) && data.length > 0 && data[0]?.data && Array.isArray(data[0].data)) {
        flatData = data.flatMap(day => day.data || []);
      } else if (!Array.isArray(data) && data.data && Array.isArray(data.data)) {
        flatData = data.data;
      }
      return flatData;
    };


    try {
      const appointmentData = await fetchAppointments();


      // existing dispatch (unchanged)
      dispatch(appointmentActions.setAppointments(appointmentData));



      dispatch(appointmentActions.markAppointmentsFetched());


    } catch (error) {
      dispatch(appointmentActions.setAppointments([]));
      dispatch(appointmentActions.markAppointmentsFetched());
    }
  };
};
