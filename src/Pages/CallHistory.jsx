import { useState, useRef, useEffect } from "react";
import { Eye } from "lucide-react";
import { navigate } from "wouter/use-browser-location";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useQuery } from "@tanstack/react-query";
import { fetchCallHistory } from "../api/callHistory";
import { useDispatch, useSelector } from "react-redux";
import { fetchDoctors } from "../redux/doctors-actions";
import DoctorMultiSelect from "../components/DoctorMultiSelect";

const norm = (str) =>
  (str || "").toString().toLowerCase().trim().replace(/\s+/g, "");

const dateOnly = (iso) => {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const CallHistoryCard = ({ entry }) => (
  <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-6 py-4 flex items-center gap-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6 text-sm text-gray-900 flex-1">
      <div>
        <span className="font-semibold">Patient Name:</span>
        <span className="ml-2">{entry.patientName}</span>
      </div>

      <div>
        <span className="font-semibold">Dr Name:</span>
        <span className="ml-2">{entry.fullName}</span>
      </div>

      <div>
        <span className="font-semibold">Date:</span>
        <span className="ml-2">{entry.startTime?.split("T")[0]}</span>
      </div>

      <div>
        <span className="font-semibold">Start Time:</span>
        <span className="ml-2">
          {new Date(entry.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div>
        <span className="font-semibold">End Time:</span>
        <span className="ml-2">
          {new Date(entry.endTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>

    <button
      onClick={() =>
        navigate(`/post-call/${entry.appointmentID}?username=${entry.userID}`, {
          state: {
            startTime: entry.startTime,
            endTime: entry.endTime,
          },
        })
      }
      title="View Post-Call Documentation"
      className="text-blue-600 hover:text-blue-800 ml-auto"
    >
      <Eye className="w-5 h-5" />
    </button>
  </div>
);

function CallHistory() {
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const dispatch = useDispatch();
  const doctors = useSelector((state) => state.doctors?.doctors || []);

  const doctorEmail = useSelector(
    (state) => state.me.me.email?.toLowerCase()
  );

  const clinicName = useSelector(
    (state) => state.me.me.clinicName
  );

  const dropdownRef = useRef(null);

  useEffect(() => {
    if (doctors.length === 0) dispatch(fetchDoctors(clinicName));
  }, [doctors.length, dispatch, clinicName]);

  useEffect(() => {
    if (doctorEmail && selectedDoctors.length === 0) {
      setSelectedDoctors([doctorEmail]);
    }
  }, [doctorEmail, selectedDoctors.length]);

  const { data: callHistoryData = [], isLoading } = useQuery({
    queryKey: ["call-history", selectedDoctors],
    queryFn: () => fetchCallHistory(selectedDoctors),
    enabled: selectedDoctors.length > 0,
  });

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    let data = [...callHistoryData];
    const searchValue = norm(patientSearch);

    data = data.filter((item) => {
      const providerMatch = selectedDoctors.includes(
        item.userID?.toLowerCase()
      );

      const d = dateOnly(item.startTime);
      const dateMatch =
        (!startDate || d >= dateOnly(startDate)) &&
        (!endDate || d <= dateOnly(endDate));

      const patientMatch =
        !searchValue || norm(item.patientName).includes(searchValue);

      const normalize2 = (s) => (s || "").trim().toLowerCase();
      const userClinic = normalize2(clinicName);
      const entryClinic = normalize2(
        item.clinicName ||
        item.details?.clinicName ||
        item.original_json?.clinicName
      );

      // If user has a clinic, only show entries that match that clinic
      const clinicMatch = !userClinic || entryClinic === userClinic;

      return providerMatch && dateMatch && patientMatch && clinicMatch;
    });

    data.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    setFilteredData(data);
  }, [callHistoryData, selectedDoctors, startDate, endDate, patientSearch, clinicName]);

  const resetFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setPatientSearch("");
    if (doctorEmail) {
      setSelectedDoctors([doctorEmail.toLowerCase()]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Call History Overview
        </h1>
        <p className="text-sm text-gray-500">
          Review previous consultations filtered by provider, date, and patient.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div ref={dropdownRef}>
          <DoctorMultiSelect
            selectedDoctors={selectedDoctors}
            onDoctorSelect={(_, list) =>
              setSelectedDoctors(list.map((d) => d.email.toLowerCase()))
            }
            isDropdownOpen={showDropdown}
            setDropdownOpen={setShowDropdown}
          />
        </div>

        {/* Date range – future dates disabled */}
        <DatePicker
          selectsRange
          startDate={startDate}
          endDate={endDate}
          onChange={([s, e]) => {
            setStartDate(s);
            setEndDate(e);
          }}
          placeholderText="Select date range"
          className="h-10 border border-gray-300 rounded-md px-4 text-sm w-64"
          isClearable
          maxDate={new Date()}
        />

        <input
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
          placeholder="Patient name"
          className="h-10 border rounded-md px-4 text-sm w-64"
        />

        <button
          onClick={resetFilters}
          className="text-sm text-gray-500 hover:underline"
        >
          Reset Filters
        </button>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {isLoading && (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        )}

        {!isLoading && filteredData.length > 0 ? (
          filteredData.map((entry) => (
            <CallHistoryCard key={entry.id} entry={entry} />
          ))
        ) : (
          <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 border rounded-lg">
            No past video calls found for this provider and filter.
          </div>
        )}
      </div>
    </div>
  );
}

export default CallHistory