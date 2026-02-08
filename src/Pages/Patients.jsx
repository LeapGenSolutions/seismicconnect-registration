import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

import { Eye } from "lucide-react";
import AdvancedSearch from "../components/search/AdvancedSearch";
import { format } from "date-fns";
import { useDispatch, useSelector } from "react-redux";
import { fetchPatientsDetails } from "../redux/patient-actions";
import { fetchAppointmentDetails } from "../redux/appointment-actions";
import DoctorMultiSelect from "../components/DoctorMultiSelect";
import { Link } from "wouter";
import { PageNavigation } from "../components/ui/page-navigation";
import CreateAppointmentModal from "../components/appointments/CreateAppointmentModal";
import { checkAppointments } from "../api/callHistory";
import { formatUsDate } from "../lib/dateUtils";

const maskInsuranceId = (id) => {
  if (!id || typeof id !== "string") return "Not Available";
  if (id.length < 4) return "Not Available";
  return `XXXXX${id.slice(-4)}`;
};


const getPatientDob = (p) => {
  return (
    p.dob ||
    p.date_of_birth ||
    p.birthDate ||
    p.details?.dob ||
    p.original_json?.details?.dob ||
    p.original_json?.original_json?.details?.dob ||
    null
  );
};



function Patients() {
  const dispatch = useDispatch();
  const patients = useSelector((state) => state.patients.patients || []);
  const appointments = useSelector(
    (state) => state.appointments.appointments || []
  );
  const loggedInDoctor = useSelector((state) => state.me.me);

  const today = new Date().toISOString().split("T")[0];

  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showPatients, setShowPatients] = useState([]);

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [appointmentFilters, setAppointmentFilters] = useState({
    selectedDoctors: loggedInDoctor?.doctor_email
      ? [loggedInDoctor?.doctor_email]
      : [],
    startDate: today,
    endDate: today,
  });

  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [seismifiedIds, setSeismifiedIds] = useState([]);   /* ✅ ADDED */

  useEffect(() => {
    if (loggedInDoctor?.clinicName) {
      dispatch(fetchPatientsDetails(loggedInDoctor.clinicName));
    } else {
      dispatch(fetchPatientsDetails());
    }
  }, [dispatch, loggedInDoctor?.clinicName]);

  useEffect(() => {
    if (
      (!appointmentFilters.selectedDoctors ||
        appointmentFilters.selectedDoctors.length === 0) &&
      loggedInDoctor?.doctor_email
    ) {
      setAppointmentFilters((prev) => ({
        ...prev,
        selectedDoctors: [loggedInDoctor.doctor_email],
      }));
    }
  }, [appointmentFilters.selectedDoctors, loggedInDoctor]);

  useEffect(() => {
    if (appointmentFilters.selectedDoctors.length > 0) {
      dispatch(fetchAppointmentDetails(appointmentFilters.selectedDoctors));
    }
  }, [appointmentFilters.selectedDoctors, dispatch]);

  useEffect(() => {
    if (!appointments.length) return;

    const ids = appointments.map((a) => a.id).filter(Boolean);
    if (!ids.length) return;

    const run = async () => {
      try {
        const result = await checkAppointments(ids); // { found, notFound }
        setSeismifiedIds(result?.found || []);
      } catch (error) {
        console.error("Failed to load Seismified appointments", error);
      }
    };

    run();
  }, [appointments]);


  const normalizeDate = (date) => (date ? date.split("T")[0] : null);

  const getUnifiedApptDate = (appt) =>
    appt.appointment_date || appt.date || appt.timestamp || appt.created_at;

  const matchPatient = (appt, list) => {
    return list.find((p) => {
      if (
        p.patient_id &&
        appt.patient_id &&
        String(p.patient_id) === String(appt.patient_id)
      )
        return true;

      if (p.mrn && appt.mrn && p.mrn === appt.mrn) return true;

      if (
        p.email &&
        appt.email &&
        p.email.toLowerCase() === appt.email.toLowerCase()
      )
        return true;

      const fullName = `${(p.firstname || p.first_name || "").trim()} ${(p.lastname || p.last_name || "").trim()}`.toLowerCase();
      return (appt.full_name || "").trim().toLowerCase() === fullName;
    });
  };



  const enrichPatients = useCallback(() => {
    const { selectedDoctors, startDate, endDate } = appointmentFilters;

    const startStr = normalizeDate(startDate);
    const endStr = normalizeDate(endDate);

    const filteredAppointments = appointments.filter((appt) => {
      const normalize = (s) => (s || "").trim().toLowerCase();
      const userClinic = normalize(loggedInDoctor?.clinicName);
      const apptClinic = normalize(
        appt.clinicName ||
        appt.details?.clinicName ||
        appt.original_json?.clinicName ||
        appt.original_json?.details?.clinicName
      );

      const clinicMatch = !userClinic || !apptClinic || apptClinic === userClinic;

      // If user has a clinic, we show ALL clinic appointments, ignoring specific selected doctors
      // UNLESS the user explicitly wants to filter within their clinic.
      // Current requirement: "Entire website filtered based on clinicName" implied we show EVERYTHING for that clinic.

      const doctorMatch = userClinic
        ? true // If clinic is set, we show all clinic data (primary filter)
        : (!selectedDoctors.length || selectedDoctors.includes(appt.doctor_email));

      const apptDateStr = normalizeDate(getUnifiedApptDate(appt));

      const dateMatch =
        (!startStr || apptDateStr >= startStr) &&
        (!endStr || apptDateStr <= endStr);

      return clinicMatch && doctorMatch && dateMatch;
    });

    const latestByPatient = {};

    filteredAppointments.forEach((appt) => {
      const matchedPatient = matchPatient(appt, patients);

      if (matchedPatient) {
        const pid = matchedPatient.patient_id;
        const unifiedDate = getUnifiedApptDate(appt);

        if (
          !latestByPatient[pid] ||
          new Date(unifiedDate) >
          new Date(getUnifiedApptDate(latestByPatient[pid].appointment))
        ) {
          latestByPatient[pid] = {
            patient: matchedPatient,
            appointment: appt,
          };
        }
      }
    });

    const results = Object.values(latestByPatient).map(
      ({ patient, appointment }) => {
        const unifiedDate = getUnifiedApptDate(appointment);
        return {
          ...patient,
          lastVisit: unifiedDate,
          appointment, /* <-- keep appointment info for Seismified check */
          doctorName:
            appointment.doctor_name ||
            appointment.full_name ||
            appointment.providerName ||
            appointment.doctor_email?.split("@")[0],
        };
      }
    );

    setShowPatients(results);
  }, [patients, appointments, appointmentFilters, loggedInDoctor?.clinicName]);

  useEffect(() => {
    if (patients.length && appointments.length) enrichPatients();
  }, [patients, appointments, enrichPatients]);


  const handleSearchChange = (e) => {
    const q = e.target.value.toLowerCase().trim();
    setSearchQuery(q);
    setVisibleCount(PAGE_SIZE);

    if (!q) {
      enrichPatients();
      return;
    }

    setShowPatients((prev) =>
      prev.filter((p) => {
        const full =
          `${p.firstname || p.first_name} ${p.lastname || p.last_name}`
            .trim()
            .toLowerCase();
        return full.includes(q);
      })
    );
  };

  const handleToggleAdvanced = () => setShowAdvancedSearch((s) => !s);

  const displayedPatients = showPatients.slice(0, visibleCount);



  return (
    <div className="space-y-6 px-4">
      <PageNavigation
        title="Patients"
        subtitle="View, search, and organize all patients."
        showDate={false}
        rightSlot={
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white"
          >
            + Add Patient
          </Button>
        }
      />


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Patient Search</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input
              className="flex-1"
              placeholder="Search Patients..."
              value={searchQuery}
              onChange={handleSearchChange}
            />

            <Button variant="outline" onClick={handleToggleAdvanced}>
              {showAdvancedSearch ? "Basic Search" : "Advanced Search"}
            </Button>
          </div>

          {showAdvancedSearch && (
            <AdvancedSearch
              submitHandler={(query, action) => {
                if (action === "close") {
                  setShowAdvancedSearch(false);
                  enrichPatients();
                  return;
                }

                if (!query) {
                  enrichPatients();
                  return;
                }

                setShowPatients(
                  patients.filter((p) => {
                    const dobMatch = query.dateOfBirth
                      ? p.dob === query.dateOfBirth
                      : true;

                    const emailMatch = query.email
                      ? (p.email || "")
                        .toLowerCase()
                        .includes(query.email.toLowerCase())
                      : true;

                    const phone = p.contactmobilephone || p.phone || "";
                    const phoneMatch = query.phoneNumber
                      ? phone.includes(query.phoneNumber)
                      : true;

                    return dobMatch && emailMatch && phoneMatch;
                  })
                );
              }}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appointment Filters</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Doctor</label>
            <DoctorMultiSelect
              selectedDoctors={appointmentFilters.selectedDoctors}
              isDropdownOpen={isDoctorDropdownOpen}
              setDropdownOpen={setIsDoctorDropdownOpen}
              onDoctorSelect={(emails) =>
                setAppointmentFilters((prev) => ({
                  ...prev,
                  selectedDoctors: emails.length
                    ? emails
                    : [loggedInDoctor.doctor_email],
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={appointmentFilters.startDate}
              onChange={(e) =>
                setAppointmentFilters((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={appointmentFilters.endDate}
              onChange={(e) =>
                setAppointmentFilters((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>MRN</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayedPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center">
                    No Patients Found
                  </TableCell>
                </TableRow>
              ) : (
                displayedPatients.map((p) => {
                  const fullName = `${p.firstname || p.first_name} ${p.lastname || p.last_name
                    }`.trim();

                  const rawDob = getPatientDob(p);
                  const formattedDob = formatUsDate(rawDob);

                  return (
                    <TableRow key={p.patient_id}>
                      {/* NAME */}
                      <TableCell>{fullName}</TableCell>

                      {/* MRN */}
                      <TableCell>{p.mrn || "N/A"}</TableCell>

                      {/* INSURANCE COLUMN */}
                      <TableCell className="space-y-1">
                        <div className="font-medium">
                          {p.insurance_provider || "Not Available"}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {maskInsuranceId(p.insurance_id)}
                        </div>
                      </TableCell>

                      {/* DOB (MMM YYYY) */}
                      <TableCell>{formattedDob}</TableCell>

                      {/* LAST VISIT */}
                      <TableCell>
                        {p.lastVisit ? (
                          <div className="flex flex-col">
                            <span>
                              {format(
                                new Date(
                                  `${String(p.lastVisit).split("T")[0]}T12:00:00`
                                ),
                                "MMM dd, yyyy"
                              )}
                            </span>
                            {p.appointment?.id &&
                              seismifiedIds.includes(p.appointment.id) && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded mt-1 inline-block">

                                </span>
                              )}
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>

                      {/* DOCTOR */}
                      <TableCell>{p.doctorName}</TableCell>

                      {/* ACTIONS */}
                      <TableCell className="text-right whitespace-nowrap">
                        <Link
                          href={`/patients/${p.patient_id}`}
                          title="View Patient Reports"
                          className="inline-flex items-center justify-center text-blue-600"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {visibleCount < showPatients.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}
          >
            Load More
          </Button>
        </div>
      )}

      {showAddModal && (
        <CreateAppointmentModal
          username={loggedInDoctor?.doctor_email}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            enrichPatients();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

export default Patients