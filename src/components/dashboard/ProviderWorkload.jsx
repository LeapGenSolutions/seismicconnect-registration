import { Card, CardContent } from "../ui/card";
import { useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { checkAppointments, fetchAppointmentsByDoctorEmails } from "../../api/callHistory";

//Chart.register(...registerables);

const HOVER_LINE_PLUGIN = {
  id: "hoverLine",
  afterDraw(chart) {
    const tooltip = chart.tooltip;
    if (!tooltip || !tooltip._active || !tooltip._active.length) return;

    const ctx = chart.ctx;
    const activePoint = tooltip._active[0].element;
    if (!activePoint) return;

    const x = activePoint.x;
    const { top, bottom } = chart.chartArea;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; // very light shade
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(...registerables, HOVER_LINE_PLUGIN);


const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY_INDEX = new Date().getDay(); // 0–6, Sun–Sat

export default function ProviderWorkload() {
  // Logged-in doctor (same as WelcomeCard & Status Overview)
  const loggedInDoctor = useSelector((state) => state.me.me);

  // Doctor display name
  const doctorName =
    loggedInDoctor?.fullName ||
    loggedInDoctor?.name ||
    `${loggedInDoctor?.given_name || ""} ${loggedInDoctor?.family_name || ""
      }`.trim() ||
    loggedInDoctor?.email?.split("@")[0] ||
    "Doctor";

  // Specialty
  const specialty =
    loggedInDoctor?.specialty ||
    loggedInDoctor?.speciality ||
    null;

  const DoctorEmail =
    loggedInDoctor?.email || loggedInDoctor?.doctor_email || null;

  const [isLoading, setIsLoading] = useState(true);
  const [weeklyCounts, setWeeklyCounts] = useState({
    total: Array(7).fill(0),
    seismified: Array(7).fill(0),
    nonSeismified: Array(7).fill(0),
  });

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // --- Compute weekly totals + seismified / non-seismified ------------------


  useEffect(() => {
    const computeWeekly = async () => {
      setIsLoading(true);

      if (!DoctorEmail) {
        setWeeklyCounts({
          total: Array(7).fill(0),
          seismified: Array(7).fill(0),
          nonSeismified: Array(7).fill(0),
        });
        setIsLoading(false);
        return;
      }

      const normalize = (s) => (s || "").trim().toLowerCase();
      const userClinic = normalize(loggedInDoctor?.clinicName);

      try {
        // Fetch appointments specifically for this doctor & clinic
        const data = await fetchAppointmentsByDoctorEmails([DoctorEmail], userClinic);

        let flatAppointments = [];
        if (Array.isArray(data)) {
          // Handle nested structure similar to AppointmentCalendar
          if (data.length > 0 && data[0]?.data && Array.isArray(data[0].data)) {
            flatAppointments = data.flatMap(day => day.data || []);
          } else if (data.data && Array.isArray(data.data)) {
            flatAppointments = data.data; // Should not happen if data is array, but safety check
          } else {
            flatAppointments = data;
          }
        } else if (data?.data && Array.isArray(data.data)) {
          flatAppointments = data.data;
        } else {
          flatAppointments = [];
        }

        const now = new Date();
        const startOfWeek = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - now.getDay(), // Sunday
          0,
          0,
          0,
          0
        );
        const endOfWeek = new Date(
          startOfWeek.getFullYear(),
          startOfWeek.getMonth(),
          startOfWeek.getDate() + 7,
          0,
          0,
          0,
          0
        );

        const totalArr = Array(7).fill(0);
        const seismArr = Array(7).fill(0);
        const nonSeismArr = Array(7).fill(0);

        // 1) Filter to this week, and keep dayIndex per appt
        const weeklyAppts = [];

        for (const app of flatAppointments) {
          // We rely on API for basic filtering, but double check doctor if needed.
          // Since we passed [DoctorEmail] to API, it should be correct.
          // Clinic filtering is also done by API (strict if userClinic is present).

          const rawDate = app.appointment_date || app.appointmentDate;
          if (!rawDate) continue;

          let d;
          if (typeof rawDate === "string" && rawDate.length === 10) {
            d = new Date(rawDate + "T00:00:00");
          } else {
            d = new Date(rawDate);
          }

          if (isNaN(d.getTime())) continue;

          if (d < startOfWeek || d >= endOfWeek) {
            continue;
          }

          const dayIndex = d.getDay(); // 0–6, Sun–Sat
          weeklyAppts.push({ app, dayIndex });

          // total appointments per day (includes cancelled)
          totalArr[dayIndex] += 1;
        }

        // 2) Active (non-cancelled) appointments for seismification
        const activeWeeklyAppts = weeklyAppts.filter(
          ({ app }) => app.status !== "cancelled"
        );

        const appointmentIDs = activeWeeklyAppts
          .map(
            ({ app }) =>
              app.id || app.appointmentID || app.appointmentId
          )
          .filter(Boolean);

        if (appointmentIDs.length === 0) {
          setWeeklyCounts({
            total: totalArr,
            seismified: seismArr,
            nonSeismified: nonSeismArr,
          });
          setIsLoading(false);
          return;
        }

        // Backend returns: { found: [ids], notFound: [ids] }
        const { found = [] } = await checkAppointments(appointmentIDs);
        const foundSet = new Set(found);

        // 3) Split active appointments into seismified / non-seismified per day
        for (const { app, dayIndex } of activeWeeklyAppts) {
          const id = app.id || app.appointmentID || app.appointmentId;
          if (!id) continue;

          if (foundSet.has(id)) {
            seismArr[dayIndex] += 1;
          } else {
            nonSeismArr[dayIndex] += 1;
          }
        }

        setWeeklyCounts({
          total: totalArr,
          seismified: seismArr,
          nonSeismified: nonSeismArr,
        });

      } catch (err) {
        console.error("Error fetching weekly workload:", err);
        setWeeklyCounts({
          total: Array(7).fill(0),
          seismified: Array(7).fill(0),
          nonSeismified: Array(7).fill(0),
        });
      } finally {
        setIsLoading(false);
      }
    };

    computeWeekly();
  }, [DoctorEmail, loggedInDoctor?.clinicName]);

  // --- Build the Chart.js line graph ---------------------------------------
  useEffect(() => {
    if (!chartRef.current) return;

    const { total, seismified, nonSeismified } = weeklyCounts;
    const hasData =
      total.some((v) => v > 0) ||
      seismified.some((v) => v > 0) ||
      nonSeismified.some((v) => v > 0);

    if (!hasData) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: WEEK_LABELS,
        datasets: [
          {
            label: "Total Appointments",
            data: total,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            borderColor: "#2563EB",       // blue line
            backgroundColor: "#2563EB",   // blue points
            pointBackgroundColor: "#2563EB",
          },
          {
            label: "Seismified",
            data: seismified,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            borderColor: "#16a34a",       // green line
            backgroundColor: "#16a34a",   // green points
            pointBackgroundColor: "#16a34a",
          },
          {
            label: "Non-Seismified",
            data: nonSeismified,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            borderColor: "#D97706",       // orange line
            backgroundColor: "#D97706",   // orange points
            pointBackgroundColor: "#D97706",
          },
        ],

      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${context.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: true,
              // Darker grid line for "today"
              color: (ctx) =>
                ctx.index === TODAY_INDEX
                  ? "rgba(0,0,0,0.25)"
                  : "rgba(0,0,0,0.05)",
              lineWidth: (ctx) => (ctx.index === TODAY_INDEX ? 1.5 : 0.5),
            },
            ticks: {
              // Bold + darker label for today
              color: (ctx) =>
                ctx.index === TODAY_INDEX ? "#111827" : "#4b5563",
              font: (ctx) =>
                ctx.index === TODAY_INDEX
                  ? { size: 13, weight: "600" }
                  : { size: 12 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { color: "#4b5563", precision: 0 },
            title: {
              display: true,
              text: "Number of Appointments",
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [weeklyCounts]);

  const weekTotal =
    weeklyCounts.total.reduce((sum, v) => sum + v, 0);
  const weekSeismified =
    weeklyCounts.seismified.reduce((sum, v) => sum + v, 0);
  const weekNonSeismified =
    weeklyCounts.nonSeismified.reduce((sum, v) => sum + v, 0);

  const hasAnyData =
    weeklyCounts.total.some((v) => v > 0) ||
    weeklyCounts.seismified.some((v) => v > 0) ||
    weeklyCounts.nonSeismified.some((v) => v > 0);

  return (
    <Card className="provider-workload-card card-hover animate-fade-in shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Provider Workload (This Week)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Line graph for the logged-in provider only
          </p>
        </div>

        {/* Doctor Info */}
        <div className="mb-3 text-sm text-gray-800">
          <div className="font-semibold">Dr. {doctorName}</div>

          {specialty && (
            <div className="text-xs">
              Specialty:{" "}
              <span className="text-blue-700 font-semibold">
                {specialty}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Loading weekly workload…
          </div>
        ) : !hasAnyData ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            No appointments found for this week for the logged-in provider.
          </div>
        ) : (
          <>
            {/* Chart Container */}
            <div
              className="workload-chart-container mt-2"
              style={{ height: 260 }}
            >
              <canvas ref={chartRef} className="workload-chart" />
              <p className="w-full text-center text-gray-600 text-xs mt-3">
                Sun–Sat view of total, seismified, and non-seismified appointments
              </p>
            </div>

            {/* Weekly Summary Section */}
            <div className="mt-8 pt-5">
              <div className="text-sm font-semibold text-gray-900 mb-2">
                Weekly summary of appointments
              </div>

              <div className="flex flex-col items-start text-sm text-gray-800 gap-1">
                <div>
                  <span className="font-medium">Total: </span>
                  <span className="font-bold" style={{ color: "#2563EB" }}>
                    {weekTotal}
                  </span>
                </div>

                <div>
                  <span className="font-medium">Seismified: </span>
                  <span className="font-bold" style={{ color: "#059669" }}>
                    {weekSeismified}
                  </span>
                </div>

                <div>
                  <span className="font-medium">Non-seismified: </span>
                  <span className="font-bold" style={{ color: "#D97706" }}>
                    {weekNonSeismified}
                  </span>
                </div>
              </div>
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
}