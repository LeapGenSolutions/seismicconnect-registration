import { useState, useEffect } from "react";
import { FaVideo, FaCopy } from "react-icons/fa";
import { navigate } from "wouter/use-browser-location";
import { useDispatch, useSelector } from "react-redux";
import { format, parse } from "date-fns";
import { DOCTOR_PORTAL_URL } from "../constants";
import { fetchAppointmentDetails } from "../redux/appointment-actions";
import { checkAppointments } from "../api/callHistory";
import CallHistory from "./CallHistory";
import { useToast } from "../hooks/use-toast";
import { PageNavigation } from "../components/ui/page-navigation";
import CreateAppointmentModal from "../components/appointments/CreateAppointmentModal";

const VideoCallPage = () => {
  const [room, setRoom] = useState("");
  const isHost = useState(true)[0];
  const [showShareLink, setShowShareLink] = useState(false);
  const [joinLink, setJoinLink] = useState("");

  const [activeTab, setActiveTab] = useState("upcoming");
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentType, setAppointmentType] = useState("in-person");
  const [seismifiedIds, setSeismifiedIds] = useState([]);
  const isLoadingUpcoming = useState(false)[0];
  const dispatch = useDispatch();
  const userName = useSelector((state) => state.me.me.given_name);
  const myEmail = useSelector((state) => state.me.me.email);
  const clinicName = useSelector((state) => state.me.me.clinicName);
  const appointments = useSelector((state) => state.appointments.appointments);
  const { toast } = useToast();

  const today = format(new Date(), "yyyy-MM-dd");
  const isAppointmentSelected = Boolean(appointmentId);
  const isOnlineAppointment = appointmentType === "online";
  const canStartVideoCall = isAppointmentSelected, canShowVideoControls = isAppointmentSelected && isOnlineAppointment;

  useEffect(() => {
    document.title = "VideoCall - Seismic Connect";
  }, []);

  useEffect(() => {
    if (myEmail) {
      dispatch(fetchAppointmentDetails(myEmail, clinicName));
    }
  }, [dispatch, myEmail, clinicName]);

  useEffect(() => {
    const todayAppointments = appointments.filter(
      (appt) => appt.appointment_date === today && appt.status !== "cancelled"
    );
    const ids = todayAppointments.map((appt) => appt.id).filter(Boolean);

    if (!ids.length) {
      setSeismifiedIds([]);
      return;
    }

    const run = async () => {
      try {
        const result = await checkAppointments(ids); // { found: [...], notFound: [...] }
        setSeismifiedIds(result?.found || []);
      } catch (error) {
        console.error("Failed to check seismified status:", error);
        setSeismifiedIds([]);
      }
    };

    run();
  }, [appointments, today]);

  const now = new Date();
  const upcomingAppointments = appointments.filter((appt) => {
    if (appt.appointment_date !== today) return false;
    if (appt.status === "cancelled") return false;
    if (seismifiedIds.includes(appt.id)) return false;
    const apptDateTime = new Date(`${appt.appointment_date}T${appt.time}`);
    if (apptDateTime < now) return false;

    const normalize = (s) => (s || "").trim().toLowerCase();
    const userClinic = normalize(clinicName);
    const apptClinic = normalize(
      appt.clinicName ||
      appt.details?.clinicName ||
      appt.original_json?.clinicName ||
      appt.original_json?.details?.clinicName
    );

    if (userClinic && apptClinic !== userClinic) return false;

    return true;
  });

  const sortedAppointments = [...upcomingAppointments].sort(
    (a, b) =>
      new Date(`${a.appointment_date}T${a.time}`) -
      new Date(`${b.appointment_date}T${b.time}`)
  );

  const selectedAppointment =
    sortedAppointments.find((app) => app.id === appointmentId) || null;

  const [invalidMeetingId, setInvalidMeetingId] = useState(false);
  const setAppointmentDetails = useState(null)[1];

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const roomParam = queryParams.get("room");

    if (roomParam) {
      setRoom(roomParam);
      setActiveTab("join");

      const appointment = sortedAppointments.find((app) => app.id === roomParam);

      if (appointment) {
        setAppointmentDetails(appointment);
      } else {
        setInvalidMeetingId(true);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedAppointments]);

  const queryParams = new URLSearchParams(window.location.search);
  const role = queryParams.get("role") || "doctor";
  useEffect(() => {
    if (appointmentType === "in-person") {
      setShowShareLink(false);
      setJoinLink("");
    }

    // If user switches to Online AFTER selecting appointment, generate link
    if (appointmentType === "online" && appointmentId) {
      generateJoinLink(appointmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentType, appointmentId]);

  const handleAppointmentSelect = (selectedAppointmentId) => {
    // if user chooses the placeholder option again, reset fields
    if (!selectedAppointmentId) {
      setAppointmentId("");
      setRoom("");
      setShowShareLink(false);
      setJoinLink("");
      setAppointmentDetails(null);
      setInvalidMeetingId(false);
      return;
    }

    const appointment = sortedAppointments.find(
      (app) => app.id === selectedAppointmentId
    );

    if (!appointment) {
      setInvalidMeetingId(true);
      return;
    }

    setAppointmentId(selectedAppointmentId);
    setRoom(selectedAppointmentId);
    setAppointmentDetails(appointment);
    if (appointmentType === "online") {
      generateJoinLink(selectedAppointmentId);
    } else {
      setShowShareLink(false);
      setJoinLink("");
    }
  };

  const generateJoinLink = (selectedAppointmentId) => {
    const link = `${DOCTOR_PORTAL_URL}${selectedAppointmentId}`;
    setJoinLink(link);
    setShowShareLink(true);
    return link;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinLink);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard.",
    });
  };

  const joinAsParticipant = (room, name) => {
    navigate(
      `/meeting-room/${encodeURIComponent(room)}?role=patient&name=${encodeURIComponent(
        userName
      )}`
    );
  };

  const joinAsDoctor = (room) => {
    navigate(
      `/meeting-room/${encodeURIComponent(room)}?patient=${encodeURIComponent(
        selectedAppointment.full_name
      )}`
    );
  };

  const SortedAppointmentsComponent = () =>
    sortedAppointments.map((appointment) => {
      let formattedStart = "Time not set";
      if (appointment.time && typeof appointment.time === "string") {
        const parsedTime = parse(appointment.time.trim(), "HH:mm", new Date());
        if (!Number.isNaN(parsedTime.getTime())) {
          formattedStart = format(parsedTime, "h:mm a");
        }
      }
      const capitalizedStatus = appointment.status
        ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)
        : "Unknown";
      return (
        <option key={appointment.id} value={appointment.id}>
          {appointment.full_name} – {formattedStart} ({capitalizedStatus})
        </option>
      );
    });

  return (
    <div className="space-y-6 px-4">
      <PageNavigation
        title="Seismic Video Call"
        subtitle="Connect with patients through secure video consultations"
        showBackButton={true}
        showDate={false}
        rightSlot={
          role === "doctor" && activeTab === "upcoming" ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 shadow-sm"
            >
              + Add
            </button>
          ) : null
        }
      />

      <div className="bg-gray-50 flex flex-col items-center min-h-screen p-4">
        <div className="rounded-lg border bg-white shadow-sm w-full">
          <div className="p-6 pt-4">
            <div className="space-y-4">
              {/* Tabs */}
              <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 mb-4">
                {role === "doctor" && (
                  <button
                    onClick={() => setActiveTab("upcoming")}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${activeTab === "upcoming"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "hover:text-gray-900"
                      }`}
                  >
                    Upcoming Calls
                  </button>
                )}

                {role === "patient" && (
                  <button
                    onClick={() => setActiveTab("join")}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${activeTab === "join"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "hover:text-gray-900"
                      }`}
                  >
                    Join by ID
                  </button>
                )}

                {role === "doctor" && (
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${activeTab === "history"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "hover:text-gray-900"
                      }`}
                  >
                    Call History
                  </button>
                )}
              </div>

              {/* Upcoming tab */}
              {activeTab === "upcoming" && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label
                      htmlFor="appointment"
                      className="text-sm font-medium text-gray-700"
                    >
                      Select An Appointment
                    </label>
                    <div className="relative">
                      <select
                        value={appointmentId}
                        onChange={(e) => handleAppointmentSelect(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select An Appointment</option>
                        {isLoadingUpcoming ? (
                          <option disabled>Loading appointments...</option>
                        ) : sortedAppointments.length > 0 ? (
                          <SortedAppointmentsComponent />
                        ) : (
                          <option disabled>No upcoming video calls</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {appointmentId && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Appointment Type
                      </label>

                      <div className="flex space-x-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="in-person"
                            name="appointmentType"
                            value="in-person"
                            checked={appointmentType === "in-person"}
                            onChange={() => setAppointmentType("in-person")}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="in-person"
                            className="text-sm font-medium text-gray-700 cursor-pointer"
                          >
                            In-Person
                          </label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="online"
                            name="appointmentType"
                            value="online"
                            checked={appointmentType === "online"}
                            onChange={() => setAppointmentType("online")}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="online"
                            className="text-sm font-medium text-gray-700 cursor-pointer"
                          >
                            Online
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {appointmentId && selectedAppointment && (
                    <div className="bg-gray-50 p-4 rounded-md mt-4">
                      <h3 className="font-medium mb-2">Appointment Details</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Patient:</span>
                          <span className="ml-2 font-medium">
                            {selectedAppointment.full_name}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Appointment ID:</span>
                          <span className="ml-2 font-medium">
                            {selectedAppointment.id}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Date & Time:</span>
                          <span className="ml-2 font-medium">
                            {selectedAppointment.appointment_date} at{" "}
                            {selectedAppointment.time}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Reason:</span>
                          <span className="ml-2 font-medium">
                            {selectedAppointment.reason || "Not specified"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="w-full mb-6">
                    <div className="flex flex-row justify-between w-full gap-4">
                      <label className="block text-gray-700 mb-2 flex-1">
                        Your Name
                        <input
                          type="text"
                          placeholder="Enter your name"
                          value={userName}
                          readOnly
                          className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                        />
                      </label>

                      {canShowVideoControls && (
                        <label className="block text-gray-700 mb-2 flex-1">
                          {isHost ? "Meeting ID" : "Meeting ID (from invite link)"}
                          <input
                            placeholder="Meeting ID"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            readOnly
                            className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4 bg-gray-50"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {canStartVideoCall && (
                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        onClick={() => joinAsDoctor(room)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 py-2"
                      >
                        <FaVideo className="mr-2" />
                        Start Video Call
                      </button>
                    </div>
                  )}

                  {showShareLink && canShowVideoControls && (
                    <div className="mt-6 w-full flex justify-center">
                      <div className="bg-gray-100 rounded-lg px-6 py-4 w-full max-w-xl shadow-sm">
                        <h3 className="font-medium text-gray-800 text-sm mb-2">
                          Invite others to join
                        </h3>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-700 mr-4">
                            Patient's link for the appointment
                          </p>
                          <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
                          >
                            <FaCopy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Click copy to share this appointment link
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Join tab */}
              {activeTab === "join" && (
                <div className="space-y-4">
                  <div className="w-full mb-6">
                    <div className="flex flex-row justify-between w-full gap-4">
                      <label className="block text-gray-700 mb-2 flex-1">
                        Your Name
                        <input
                          type="text"
                          placeholder="Enter your name"
                          value={userName}
                          className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                        />
                      </label>
                      <label className="block text-gray-700 mb-2 flex-1">
                        Meeting ID (from invite link)
                        <input
                          placeholder="Meeting ID"
                          value={room}
                          onChange={(e) => setRoom(e.target.value)}
                          className="border border-gray-300 rounded-lg px-4 w-full py-2 mb-4"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => joinAsParticipant(room, userName)}
                      disabled={!room || !userName}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Join Call
                    </button>
                  </div>
                </div>
              )}

              {/* History tab */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  <CallHistory />
                </div>
              )}
            </div>
          </div>

          {invalidMeetingId && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>Invalid meeting ID. Please check your meeting link.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Appointment Modal */}
      {showCreateModal && (
        <CreateAppointmentModal
          username={myEmail}
          doctorName={userName}
          doctorSpecialization=""
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newAppointment) => {
            setShowCreateModal(false);
            toast({
              title: "Appointment Added",
              description: `${newAppointment.full_name} appointment added successfully.`,
            });

            dispatch(fetchAppointmentDetails(myEmail));
          }}
        />
      )}
    </div>
  );
};

export default VideoCallPage
