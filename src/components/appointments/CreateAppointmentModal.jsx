import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSelector, useDispatch } from "react-redux";
import { BACKEND_URL } from "../../constants";
import { createAppointment } from "../../api/appointment";
import { fetchPatientsDetails } from "../../redux/patient-actions";
import { useToast } from "../../hooks/use-toast";
import UnsavedChangesModal from "../UnsavedChangesModal";
import { Calendar, User2, Clock } from "lucide-react";
import SeismicTimeDropdown from "./SeismicTimeDropdown";

const extractMRN = (p) =>
  p.mrn ||
  p.original_json?.mrn ||
  p.original_json?.details?.mrn ||
  p.original_json?.original_json?.details?.mrn ||
  "";

const extractPatientId = (p) =>
  p.patient_id ||
  p.patientID ||
  p.details?.patient_id ||
  p.details?.patientID ||
  p.original_json?.patient_id ||
  p.original_json?.patientID ||
  p.original_json?.details?.patient_id ||
  p.original_json?.details?.patientID ||
  p.original_json?.original_json?.details?.patient_id ||
  p.original_json?.original_json?.details?.patientID ||
  "";

const extractPracticeId = (p) =>
  p.practice_id ||
  p.practiceID ||
  p.details?.practice_id ||
  p.details?.practiceID ||
  p.original_json?.details?.practice_id ||
  p.original_json?.details?.practiceID ||
  "";

const extractDetails = (p) =>
  p.details ||
  p.original_json?.details ||
  p.original_json?.original_json?.details ||
  p;

const CreateAppointmentModal = ({ onClose, onSuccess }) => {
  const { toast } = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchPatientsDetails());
  }, [dispatch]);

  const loggedInDoctor = useSelector((state) => state.me.me);
  const patientsList = useSelector((state) => state.patients.patients);

  const [existingPatient, setExistingPatient] = useState(null);

  const resolvedDoctorName = loggedInDoctor?.doctor_name;
  const resolvedDoctorEmail =
    loggedInDoctor?.doctor_email || loggedInDoctor?.email;
  const resolvedSpecialization = loggedInDoctor?.specialization;
  const resolvedDoctorId = loggedInDoctor?.doctor_id;

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    dob: "",
    gender: "",
    email: "",
    phone: "",
    ehr: "",
    mrn: "",
    appointment_date: "",
    time: "",
    specialization: resolvedSpecialization || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const [nameSearchTerm, setNameSearchTerm] = useState("");
  const [nameMatches, setNameMatches] = useState([]);

  const requiredFields = [
    "first_name",
    "last_name",
    "dob",
    "appointment_date",
    "time",
  ];

  const norm = (str) => (str || "").toLowerCase().trim();
  const getFirstName = (d) => d.first_name || d.firstname || "";
  const getMiddleName = (d) => d.middle_name || d.middlename || "";
  const getLastName = (d) => d.last_name || d.lastname || "";
  const getGender = (d) => d.gender || d.sex || "";
  const getPhone = (d) => d.phone || d.contactmobilephone || "";

  const resetPatientAndForm = () => {
    setExistingPatient(null);
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      dob: "",
      gender: "",
      email: "",
      phone: "",
      ehr: "",
      mrn: "",
      appointment_date: "",
      time: "",
      specialization: resolvedSpecialization || "",
    });
    setErrors({});
    setTouched({});
    setNameSearchTerm("");
    setNameMatches([]);
  };

  const handleNameInputChange = (e) => {
    const value = e.target.value;
    setNameSearchTerm(value);

    const term = norm(value);
    if (!term) {
      resetPatientAndForm();
      return;
    }

    const matches = patientsList.filter((p) => {
      const normalizeClinic = (s) => (s || "").trim().toLowerCase();
      const userClinic = normalizeClinic(loggedInDoctor?.clinicName);
      const patientClinic = normalizeClinic(
        p.clinicName ||
        p.details?.clinicName ||
        p.original_json?.clinicName ||
        p.original_json?.details?.clinicName
      );

      // Clinic Name check
      if (userClinic && patientClinic !== userClinic) {
        return false;
      }

      const d = extractDetails(p);
      const full = norm(
        [getFirstName(d), getMiddleName(d), getLastName(d)]
          .filter(Boolean)
          .join(" ")
      );
      return full.includes(term);
    });

    setNameMatches(matches);
  };

  const applyExistingPatient = (p) => {
    setExistingPatient(p);
    const d = extractDetails(p);

    setFormData((prev) => ({
      ...prev,
      first_name: getFirstName(d),
      middle_name: getMiddleName(d),
      last_name: getLastName(d),
      dob: d.dob ?? "",
      gender: getGender(d),
      email: d.email || "",
      phone: getPhone(d),
      ehr: d.ehr || "",
      mrn: extractMRN(p),
    }));

    setTouched({
      first_name: true,
      last_name: true,
      dob: true,
    });

    setErrors({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);

    setFormData((p) => ({ ...p, phone: digitsOnly }));
    setTouched((p) => ({ ...p, phone: true }));
    setErrors((prev) => {
      if (!prev.phone) return prev;
      const updated = { ...prev };
      delete updated.phone;
      return updated;
    });
  };

  const validateForm = () => {
    const errs = {};
    const newTouched = {};

    requiredFields.forEach((field) => {
      if (
        existingPatient &&
        ["first_name", "last_name", "dob"].includes(field)
      ) {
        return;
      }

      newTouched[field] = true;

      if (!formData[field] || String(formData[field]).trim() === "") {
        errs[field] = "Required";
      }
    });

    // ✅ Phone validation (inline)
    if (!existingPatient) {
      newTouched.phone = true;

      if (!formData.phone || formData.phone.trim() === "") {
        errs.phone = "Required";
      } else if (formData.phone.length !== 10) {
        errs.phone = "Invalid phone number";
      }
    }

    setTouched((prev) => ({ ...prev, ...newTouched }));
    setErrors(errs);

    return errs;
  };

  const scrollToFirstError = (errs) => {
    const firstField = Object.keys(errs)[0];
    if (!firstField) return;

    const el = document.querySelector(`[name="${firstField}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  const convertTo24Hour = (t) => {
    if (!t) return "";
    const d = new Date(`1970-01-01 ${t}`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toTimeString().slice(0, 5);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    //console.log("DEBUG: CreateAppointmentModal - Submitting with formData:", formData);
    //console.log("DEBUG: CreateAppointmentModal - LoggedInDoctor:", loggedInDoctor);

    const requiredErrors = validateForm();
    if (Object.keys(requiredErrors).length > 0) {
      scrollToFirstError(requiredErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      let patient_id;
      let practice_id;

      if (existingPatient) {
        patient_id = extractPatientId(existingPatient);
        practice_id = extractPracticeId(existingPatient);

        if (!patient_id) {
          toast({
            title: "Patient selection error",
            description:
              "Unable to link selected patient. Please reselect the patient.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await fetch(`${BACKEND_URL}api/patients/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            dob: formData.dob,
            gender: formData.gender,
            email: formData.email,
            phone: formData.phone?.replace(/\D/g, ""),
            ehr: formData.ehr,
            mrn: formData.mrn,
            clinicName: loggedInDoctor?.clinicName || "", // Added clinicName with fallback
          }),
        });

        const saved = await res.json();
        patient_id =
          saved?.chatbotPatient?.patientID ||
          saved?.chatbotPatient?.original_json?.details?.patient_id;
        practice_id =
          saved?.chatbotPatient?.practiceID ||
          saved?.chatbotPatient?.original_json?.details?.practice_id;
      }

      const full_name = [
        formData.first_name,
        formData.middle_name,
        formData.last_name,
      ]
        .filter(Boolean)
        .join(" ");

      const appointmentData = {
        type: "appointment",
        full_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        dob: formData.dob,
        gender: formData.gender,
        mrn: formData.mrn,
        ehr: formData.ehr,
        doctor_name: resolvedDoctorName,
        doctor_id: resolvedDoctorId,
        doctor_email: resolvedDoctorEmail,
        specialization: formData.specialization,
        time: convertTo24Hour(formData.time),
        appointment_date: formData.appointment_date,
        status: "scheduled",
        email: formData.email,
        phone: formData.phone?.replace(/\D/g, ""),
        patient_id,
        practice_id,
        clinicName: loggedInDoctor?.clinicName || "", // Added clinicName with fallback
      };

      const created = await createAppointment(
        resolvedDoctorEmail,
        appointmentData
      );

      toast({
        title: "Appointment created",
        description: "Appointment scheduled successfully.",
      });

      onSuccess(created?.data?.at(-1));
      onClose();
    } catch (err) {
      toast({
        title: "Error creating appointment",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formHasAnyValue = Object.values(formData).some(
    (v) => v !== undefined && v !== null && String(v).trim() !== ""
  );

  // ✅ MODAL JSX (wrapped in portal)
  const modalUI = (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 flex justify-end items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (formHasAnyValue) setShowUnsavedConfirm(true);
          else onClose();
        }
      }}
    >
      <div
        className="
          bg-white shadow-xl rounded-xl 
          w-[960px] max-h-[90vh]
          mr-16 mt-10 mb-6 
          overflow-y-auto h-full 
          flex flex-col 
          border border-black-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-3 bg-blue-600 rounded-t-xl">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar size={18} /> Schedule Appointment
          </h2>
          <button onClick={onClose} className="text-white text-2xl">
            ×
          </button>
        </div>

        <div className="flex h-full">
          <div className="w-[40%] border-r border-black-200 p-4 overflow-y-auto">
            <h3 className="text-md font-semibold text-blue-700 mb-3">
              Find Existing Patient
            </h3>

            <div className="mb-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-black-600 mb-1">
                  Search by Patient Name
                </label>
                <button
                  type="button"
                  onClick={resetPatientAndForm}
                  className="text-xs text-blue-700 hover:text-blue-900 underline underline-offset-2"
                >
                  Reset
                </button>
              </div>

              <input
                value={nameSearchTerm}
                onChange={handleNameInputChange}
                placeholder="Start typing name..."
                className="border rounded-md w-full p-2 text-sm border-black-300"
              />
            </div>

            {nameMatches.length > 0 && (
              <div className="border rounded-md max-h-80 overflow-y-auto">
                {nameMatches.map((p) => {
                  const d = extractDetails(p);

                  const displayName = [getFirstName(d), getMiddleName(d), getLastName(d)]
                    .filter(Boolean)
                    .join(" ");

                  let formattedDOB = "—";

                  if (d?.dob) {
                    const cleanDOB = d.dob.split("T")[0];
                    const parts = cleanDOB.split("-");
                    if (parts.length === 3) {
                      const [yyyy, mm, dd] = parts;
                      formattedDOB = `${mm}/${dd}/${yyyy}`;
                    }
                  }

                  const resolvedMRN = extractMRN(p) || "—";

                  return (
                    <div
                      key={p.patient_id}
                      className="px-3 py-2 border-b hover:bg-blue-50 cursor-pointer text-sm"
                      onClick={() => {
                        applyExistingPatient(p);
                        setNameSearchTerm(displayName);
                        setNameMatches([]);
                      }}
                    >
                      <div className="font-medium">
                        {displayName || "Unnamed Patient"}
                      </div>

                      <div className="text-xs text-black-600 flex gap-2 mt-1">
                        <span>DOB: {formattedDOB}</span>
                        <span>|</span>
                        <span>MRN: {resolvedMRN}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-[60%] p-4 overflow-y-auto bg-black-50">
            <form onSubmit={handleSubmit} className="space-y-5">
              <section className="bg-white border rounded-xl p-4">
                <h3 className="text-md font-semibold text-blue-700 flex items-center gap-2 mb-3">
                  <Clock size={16} /> Appointment Details
                </h3>

                <div className="grid grid-cols-2 gap-3 min-w-[0]">
                  <Input
                    label="Appointment Date *"
                    type="date"
                    name="appointment_date"
                    value={formData.appointment_date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={handleChange}
                    error={errors.appointment_date}
                    touched={touched.appointment_date}
                  />

                  <div className="min-w-[180px]">
                    <SeismicTimeDropdown
                      label="Appointment Time *"
                      name="time"
                      value={formData.time}
                      onChange={handleChange}
                      error={errors.time}
                      touched={touched.time}
                      toast={toast}
                    />
                  </div>

                  <Input
                    label="Doctor Specialty"
                    name="specialization"
                    value={formData.specialization}
                    readOnly
                    className="bg-blue-50 cursor-not-allowed"
                  />
                </div>
              </section>

              <section className="bg-white border rounded-xl p-4">
                <h3 className="text-md font-semibold text-blue-700 flex items-center gap-2 mb-3">
                  <User2 size={16} /> Patient Information
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="First Name *"
                    name="first_name"
                    value={formData.first_name}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handleChange}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                    error={errors.first_name}
                    touched={touched.first_name}
                  />

                  <Input
                    label="Middle Name"
                    name="middle_name"
                    value={formData.middle_name}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handleChange}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                  />

                  <Input
                    label="Last Name *"
                    name="last_name"
                    value={formData.last_name}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handleChange}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                    error={errors.last_name}
                    touched={touched.last_name}
                  />

                  <Input
                    type="date"
                    label="Date of Birth *"
                    name="dob"
                    value={formData.dob}
                    max={new Date().toISOString().split("T")[0]}
                    readOnly={!!existingPatient}
                    onChange={
                      existingPatient
                        ? undefined
                        : (e) =>
                          handleChange({
                            target: { name: "dob", value: e.target.value },
                          })
                    }
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                    error={errors.dob}
                    touched={touched.dob}
                  />

                  <Select
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={existingPatient ? () => { } : handleChange}
                    options={["Male", "Female", "Other"]}
                    disabled={!!existingPatient}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                  />

                  <Input
                    label="Email"
                    name="email"
                    value={formData.email}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handleChange}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                  />

                  <Input
                    label="Phone Number"
                    name="phone"
                    value={formData.phone}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handlePhoneChange}
                    placeholder="Enter 10-digit phone number"
                    maxLength={10}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                    error={errors.phone}
                    touched={touched.phone}
                  />

                  <Input
                    label="MRN"
                    name="mrn"
                    value={formData.mrn}
                    readOnly={!!existingPatient}
                    onChange={existingPatient ? undefined : handleChange}
                    className={existingPatient ? "bg-blue-50 cursor-not-allowed" : ""}
                    error={errors.mrn}
                    touched={touched.mrn}
                  />
                </div>
              </section>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (formHasAnyValue) setShowUnsavedConfirm(true);
                    else onClose();
                  }}
                  className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600"
                >
                  {isSubmitting ? "Saving..." : "Save Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {showUnsavedConfirm && (
          <UnsavedChangesModal
            onConfirm={() => {
              setShowUnsavedConfirm(false);
              onClose();
            }}
            onCancel={() => setShowUnsavedConfirm(false)}
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalUI, document.body);
};

const Input = ({
  label,
  type = "text",
  name,
  value,
  onChange,
  readOnly,
  placeholder,
  className = "",
  error,
  touched,
  ...rest
}) => {
  const isInvalid = touched && !!error;

  return (
    <div>
      <label className="block text-xs font-semibold text-black-600 mb-1">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
        className={`
          border rounded-md w-full p-2 text-sm 
          ${isInvalid ? "border-red-500 bg-red-50" : "border-black-300"}
          ${className}
        `}
      />

      {isInvalid && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};

const Select = ({
  label,
  name,
  value,
  onChange,
  options = [],
  disabled,
  className = "",
}) => (
  <div>
    <label className="block text-xs font-semibold text-black-600 mb-1">
      {label}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`border border-blue-300 rounded-md w-full p-2 text-sm bg-white ${className}`}
    >
      <option value="">Select</option>
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export default CreateAppointmentModal
