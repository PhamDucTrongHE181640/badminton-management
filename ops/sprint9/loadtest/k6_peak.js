import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    discovery_peak: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "6m", target: 120 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800", "p(99)<1500"],
  },
};

const API_BASE = __ENV.API_BASE || "http://localhost:8000";
const USER_ACCESS_TOKEN = __ENV.USER_ACCESS_TOKEN || "";

function authHeaders() {
  if (!USER_ACCESS_TOKEN) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${USER_ACCESS_TOKEN}`,
  };
}

export default function () {
  const discovery = http.get(
    `${API_BASE}/api/v1/player/discovery/sessions?sport=Badminton&has_open_slots=true`,
    { headers: authHeaders() }
  );
  check(discovery, {
    "discovery status is 200": (res) => res.status === 200,
  });

  if (discovery.status === 200) {
    const payload = discovery.json();
    if (Array.isArray(payload) && payload.length > 0 && USER_ACCESS_TOKEN) {
      const first = payload[0];
      const booking = http.post(
        `${API_BASE}/api/v1/player/bookings`,
        JSON.stringify({
          session_id: first.id,
          mode: "solo",
          payment_method: "cash",
          seats_booked: 1,
        }),
        { headers: authHeaders() }
      );
      check(booking, {
        "booking status in expected range": (res) =>
          res.status === 201 || res.status === 409 || res.status === 422,
      });
    }
  }

  sleep(1);
}
