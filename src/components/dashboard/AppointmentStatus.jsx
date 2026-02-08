import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { FaCheckCircle, FaClock, FaUserTimes, FaSyncAlt } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useCallback } from "react";
import { fetchAppointmentDetails } from "../../redux/appointment-actions";
import { checkAppointments } from "../../api/callHistory";

// KPI tooltips
const KPI_TOOLTIPS = {
  completed: "Completed: Seismified appointments for today.",
  upcoming:
    "Upcoming: Active appointments for today that are scheduled and not yet started.",
  noShow:
    "No-show: Appointments where the scheduled time has passed and the visit was not started or seismified.",
  rescheduled:
    "Rescheduled: Appointments that were moved today to a new time or date.",
  cancelled:
    "Cancelled: Appointments marked as cancelled for today.",
};

// Status cards: Completed, Upcoming, No-show, Rescheduled, Cancelled
const STATUS_CARDS = [
  {
    key: "completed",
    label: "Completed",
    color: "#D1FADF",
    text: "#039855",
    icon: <FaCheckCircle className="text-green-500" />,
  },
  {
    key: "upcoming",
    label: "Upcoming",
    color: "#FEF3C7",
    text: "#D97706",
    icon: <FaClock className="text-yellow-500" />,
  },
  {
    key: "noShow",
    label: "No-show",
    color: "#EDE9FE", // violet-100
    text: "#6D28D9", // violet-700
    icon: <FaUserTimes className="text-violet-600" />,
  },
  {
    key: "rescheduled",
    label: "Rescheduled",
    color: "#E0F2FE",
    text: "#2563EB",
    icon: <FaSyncAlt className="text-blue-500" />,
  },
  {
    key: "cancelled",
    label: "Cancelled",
    color: "#FEE2E2",
    text: "#B91C1C",
    icon: <FaUserTimes className="text-red-500" />,
  },
];

// Colors for the pie chart slices, in the same order as `data`
const PIE_COLORS = [
  "#22C55E", // Completed    - green
  "#F59E0B", // Upcoming     - amber
  "#8B5CF6", // No-show      - violet
  "#3B82F6", // Rescheduled  - blue
  "#EF4444", // Cancelled    - red
];

const AppointmentStatus = ({ date }) => {
  const loggedInDoctor = useSelector((state) => state.me.me);
  const [isLoading, setIsLoading] = useState(true);
  const appointments = useSelector((state) => state.appointments.appointments);
  const dispatch = useDispatch();
  const [stats, setStats] = useState({
    completed: 0,
    upcoming: 0,
    noShow: 0,
    rescheduled: 0,
    cancelled: 0,
  });

  const DoctorEmail =
    loggedInDoctor?.email || loggedInDoctor?.doctor_email || null;

  // Unique doctor identifier for filtering appointments
  const doctorUniqueId =
    loggedInDoctor?.doctor_id || loggedInDoctor?.id || loggedInDoctor?.oid || null;

  // Always normalize "today" to a yyyy-MM-dd STRING (local calendar day)
  const localTodayKey = new Date().toLocaleDateString("en-CA");
  const utcTodayKey = new Date().toISOString().slice(0, 10);

  const todayKey =
    typeof date === "string"
      ? date === utcTodayKey && localTodayKey !== utcTodayKey
        ? localTodayKey
        : date
      : date instanceof Date
        ? format(date, "yyyy-MM-dd")
        : localTodayKey;

  useEffect(() => {
    if (DoctorEmail) {
      dispatch(fetchAppointmentDetails(DoctorEmail, loggedInDoctor?.clinicName));
    }
  }, [dispatch, DoctorEmail, loggedInDoctor?.clinicName]);

  // Helper to decide if an appointment time has already passed (today)
  const isAppointmentPast = useCallback(
    (app) => {
      const timeStr =
        app.appointment_time ||
        app.start_time ||
        app.slot_start_time ||
        app.time;

      if (!timeStr || typeof timeStr !== "string") return false;

      const [year, month, day] = todayKey.split("-").map(Number);
      const [hStr, mStr] = timeStr.split(":");
      const hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr ?? "0", 10);

      if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;

      const scheduled = new Date(year, month - 1, day, hours, minutes);
      return scheduled.getTime() < Date.now();
    },
    [todayKey] // dependency
  );

  // Calculate Completed / Upcoming / No-show / Rescheduled / Cancelled
  useEffect(() => {
    const computeStats = async () => {
      setIsLoading(true);

      if (!doctorUniqueId || !Array.isArray(appointments)) {
        setStats({
          completed: 0,
          upcoming: 0,
          noShow: 0,
          rescheduled: 0,
          cancelled: 0,
        });
        setIsLoading(false);
        return;
      }

      // All today's appointments for this doctor (including cancelled/rescheduled)
      const todayAppointments = appointments.filter((app) => {
        let appDateKey = app.appointment_date;

        // Normalize appointment date to yyyy-MM-dd WITHOUT timezone shifting
        if (typeof appDateKey === "string") {
          // Handles "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ssZ"
          appDateKey = appDateKey.slice(0, 10);
        } else if (appDateKey instanceof Date) {
          appDateKey = format(appDateKey, "yyyy-MM-dd");
        } else {
          appDateKey = "";
        }

        const isToday = appDateKey === todayKey;

        const isSameDoctor =
          app.doctorId === doctorUniqueId ||
          app.doctor_id === doctorUniqueId ||
          app.doctorEmail === DoctorEmail ||
          app.doctor_email === DoctorEmail;

        const normalize = (s) => (s || "").trim().toLowerCase();
        const userClinic = normalize(loggedInDoctor?.clinicName);
        const apptClinic = normalize(
          app.clinicName ||
          app.details?.clinicName ||
          app.original_json?.clinicName ||
          app.original_json?.details?.clinicName
        );
        const matchesClinic = !userClinic || apptClinic === userClinic;

        return isToday && isSameDoctor && matchesClinic;
      });

      // Cancelled and rescheduled counts
      const cancelled = todayAppointments.filter(
        (app) => app.status === "cancelled"
      ).length;

      const rescheduled = todayAppointments.filter(
        (app) => app.status === "rescheduled"
      ).length;

      // Active appointments (exclude cancelled)
      const activeAppointments = todayAppointments.filter(
        (app) => app.status !== "cancelled"
      );

      const appointmentIDs = activeAppointments
        .map((app) => app.id || app.appointmentID || app.appointmentId)
        .filter(Boolean);

      let found = [];
      try {
        if (appointmentIDs.length > 0) {
          // Backend returns: { found: [ids], notFound: [ids] }
          const result = await checkAppointments(appointmentIDs);
          found = result?.found || [];
        }
      } catch (error) {
        console.error("Error computing appointment stats:", error);
      }

      const foundSet = new Set(found);

      let completed = 0;
      let upcoming = 0;
      let noShow = 0;

      // Classify active appointments
      for (const app of activeAppointments) {
        const id = app.id || app.appointmentID || app.appointmentId;
        const isSeismified = id && foundSet.has(id);
        const past = isAppointmentPast(app);

        if (isSeismified) {
          completed += 1;
        } else if (past) {
          noShow += 1;
        } else {
          upcoming += 1;
        }
      }

      setStats({
        completed,
        upcoming,
        noShow,
        rescheduled,
        cancelled,
      });

      setIsLoading(false);
    };

    computeStats();
  }, [appointments, todayKey, doctorUniqueId, DoctorEmail, isAppointmentPast, loggedInDoctor?.clinicName]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow p-6 min-h-[220px] animate-pulse">
        <div className="h-6 w-1/3 bg-neutral-200 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="h-12 bg-neutral-200 rounded"></div>
          <div className="h-12 bg-neutral-200 rounded"></div>
          <div className="h-12 bg-neutral-200 rounded"></div>
          <div className="h-12 bg-neutral-200 rounded"></div>
        </div>
        <div className="h-32 w-full bg-neutral-200 rounded-full"></div>
      </div>
    );
  }

  const { completed, upcoming, noShow, rescheduled, cancelled } = stats;

  const data = [
    { name: "Completed", value: completed },
    { name: "Upcoming", value: upcoming },
    { name: "No-show", value: noShow },
    { name: "Rescheduled", value: rescheduled },
    { name: "Cancelled", value: cancelled },
  ];

  const countsByKey = {
    completed,
    upcoming,
    noShow,
    rescheduled,
    cancelled,
  };

  return (
    <div
      className="bg-white rounded-xl shadow p-6 flex flex-col h-full cursor-pointer"
      title="Click to view the Status Overview and Timeline Dashboard"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-lg font-semibold text-gray-800">
          Status Overview
        </div>
        <div className="bg-green-100 p-2 rounded-full">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="8"
              fill="#22C55E"
              opacity="0.15"
            />
            <path
              d="M12 8v4l3 2"
              stroke="#22C55E"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Status breakdown of today’s appointments.
      </p>

      {/* Pie chart */}
      <div className="flex justify-center mt-[-10px]">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={58}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
              ))}
            </Pie>

            <RechartsTooltip formatter={(value, name) => [`${value}`, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Status cards – compact 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {STATUS_CARDS.map((card) => (
          <div
            key={card.key}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${card.key === "cancelled" ? "col-span-2" : ""
              }`}
            style={{ background: card.color }}
            title={KPI_TOOLTIPS[card.key]}
          >
            <div
              className="flex items-center gap-2 font-medium"
              style={{ color: card.text }}
            >
              {card.icon}
              {card.label}
            </div>
            <div className="text-base font-bold" style={{ color: card.text }}>
              {countsByKey[card.key] ?? 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentStatus;
