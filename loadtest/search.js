// k6 load test for the hottest endpoint: geo search + ranking.
//   docker run --rm -i --add-host=host.docker.internal:host-gateway \
//     -e BASE=http://host.docker.internal:8080 grafana/k6 run - < loadtest/search.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:8080';
const POINTS = [
  [22.3253, 91.8124],
  [22.359, 91.8215],
  [22.3667, 91.824],
  [22.3475, 91.838],
  [23.7461, 90.3742],
  [23.7925, 90.4078],
  [23.8223, 90.3654],
  [23.8759, 90.3795],
];
const CATEGORIES = ['', 'electrician', 'plumber', 'ac-repair', 'carpenter'];

export const options = {
  scenarios: {
    search: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 200),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export default function () {
  const [lat, lng] = POINTS[Math.floor(Math.random() * POINTS.length)];
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const res = http.get(
    `${BASE}/api/v1/technicians?lat=${lat}&lng=${lng}&radiusKm=10${cat ? `&category=${cat}` : ''}`,
    {
      tags: { name: 'search' },
    },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
