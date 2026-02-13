"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TheftPoint = {
  event_unique_id: string;
  occ_date: string | null;
  offence: string | null;
  neighbourhood: string | null;
  lat: number;
  lng: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const KINGS_COLLEGE_CIRCLE = {
  lat: 43.66058,
  lng: -79.39529,
};
const BASE_CAMPUS_SPAN = {
  lat: 43.6680 - 43.6574,
  lng: -79.3956 - -79.4072,
};
const ZOOM_OUT_FACTOR = 1.55;
const CAMPUS_SPAN = {
  lat: BASE_CAMPUS_SPAN.lat * ZOOM_OUT_FACTOR,
  lng: BASE_CAMPUS_SPAN.lng * ZOOM_OUT_FACTOR,
};
const COORDINATE_NUDGE = {
  lat: -0.0002,
  lng: -0.00025,
};
const CAMPUS_BOUNDS = {
  minLat: KINGS_COLLEGE_CIRCLE.lat - CAMPUS_SPAN.lat / 2,
  maxLat: KINGS_COLLEGE_CIRCLE.lat + CAMPUS_SPAN.lat / 2,
  minLng: KINGS_COLLEGE_CIRCLE.lng - CAMPUS_SPAN.lng / 2,
  maxLng: KINGS_COLLEGE_CIRCLE.lng + CAMPUS_SPAN.lng / 2,
};

const OSM_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${CAMPUS_BOUNDS.minLng}%2C${CAMPUS_BOUNDS.minLat}%2C${CAMPUS_BOUNDS.maxLng}%2C${CAMPUS_BOUNDS.maxLat}&layer=mapnik`;

function mercatorY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function HeatmapCanvas({ points }: { points: TheftPoint[] }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);
      const topY = mercatorY(CAMPUS_BOUNDS.maxLat);
      const bottomY = mercatorY(CAMPUS_BOUNDS.minLat);

      for (const point of points) {
        const x =
          ((point.lng - CAMPUS_BOUNDS.minLng) / (CAMPUS_BOUNDS.maxLng - CAMPUS_BOUNDS.minLng)) *
          width;
        const pointY = mercatorY(point.lat);
        const y = ((topY - pointY) / (topY - bottomY)) * height;

        const gradient = ctx.createRadialGradient(x, y, 1, x, y, 12);
        gradient.addColorStop(0, "rgba(220, 38, 38, 0.55)");
        gradient.addColorStop(0.5, "rgba(220, 38, 38, 0.24)");
        gradient.addColorStop(1, "rgba(220, 38, 38, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [points]);

  return (
    <div ref={wrapperRef} className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200">
      <iframe
        title="OpenStreetMap St. George Campus"
        src={OSM_EMBED}
        className="pointer-events-none absolute inset-0 h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div
        className="pointer-events-none absolute left-2 top-2 z-20 h-20 w-10 rounded bg-white/95"
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-label="Theft heatmap overlay over St. George campus map"
      />
    </div>
  );
}

export default function Home() {
  const [points, setPoints] = useState<TheftPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "static" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const loadStatic = async (reason: string) => {
        const staticResponse = await fetch("/thefts.json");
        if (staticResponse.ok) {
          const staticData: TheftPoint[] = await staticResponse.json();
          setPoints(staticData);
          setSource("static");
          setError(reason);
          return true;
        }
        return false;
      };

      try {
        const apiResponse = await fetch(`${API_BASE}/thefts?limit=10000`);
        if (apiResponse.ok) {
          const apiData: TheftPoint[] = await apiResponse.json();
          setPoints(apiData);
          setSource("api");
          return;
        }

        const loadedStatic = await loadStatic(
          `Live backend unreachable at ${API_BASE}. Showing last ingested static data from /thefts.json.`
        );
        if (loadedStatic) return;

        setPoints([]);
        setSource(null);
        setError(
          `Could not load live backend (${API_BASE}) or static fallback (/thefts.json). Run: python backend/scripts/ingest_data.py`
        );
      } catch (err) {
        const loadedStatic = await loadStatic(
          `Live backend request failed at ${API_BASE}. Showing last ingested static data from /thefts.json.`
        );
        if (loadedStatic) {
          setLoading(false);
          return;
        }

        setPoints([]);
        setSource(null);
        const message =
          err instanceof Error
            ? err.message
            : "Network error while loading theft data. Ensure frontend is running on localhost.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const center = useMemo(() => {
    if (points.length === 0) return null;
    const totalLat = points.reduce((sum, p) => sum + p.lat, 0);
    const totalLng = points.reduce((sum, p) => sum + p.lng, 0);
    return {
      lat: totalLat / points.length,
      lng: totalLng / points.length,
    };
  }, [points]);

  const shiftedPoints = useMemo(() => {
    if (!center) return points;
    const latOffset = KINGS_COLLEGE_CIRCLE.lat - center.lat + COORDINATE_NUDGE.lat;
    const lngOffset = KINGS_COLLEGE_CIRCLE.lng - center.lng + COORDINATE_NUDGE.lng;
    return points.map((point) => ({
      ...point,
      lat: point.lat + latOffset,
      lng: point.lng + lngOffset,
    }));
  }, [center, points]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-300 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Police Database Thefts Over $5,000 (UofT St. George)</h1>
        <p className="mt-2 text-slate-600">
          Map area is fixed to St. George campus. Theft points come from backend CSV filtering.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Data source: {loading ? "loading..." : source === "api" ? "live backend" : "static fallback"}
        </p>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <p className="text-sm uppercase tracking-wide text-slate-300">Points loaded</p>
            <p className="mt-2 text-3xl font-semibold">{loading ? "..." : points.length}</p>
          </div>
          <div className="rounded-xl border border-slate-300 p-4">
            <p className="text-sm uppercase tracking-wide text-slate-500">Center latitude</p>
            <p className="mt-2 text-2xl font-semibold">{KINGS_COLLEGE_CIRCLE.lat.toFixed(6)}</p>
          </div>
          <div className="rounded-xl border border-slate-300 p-4">
            <p className="text-sm uppercase tracking-wide text-slate-500">Center longitude</p>
            <p className="mt-2 text-2xl font-semibold">{KINGS_COLLEGE_CIRCLE.lng.toFixed(6)}</p>
          </div>
        </section>

        {error ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Heatmap Overlay</h2>
          <p className="mt-1 text-sm text-slate-500">
            Theft density is drawn directly on top of the map using the same campus bounds.
          </p>
          <div className="mt-4">
            <HeatmapCanvas points={shiftedPoints} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            If the map is blank, verify internet access in your browser and disable strict tracker-blocking for
            OpenStreetMap embeds.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Sample records</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Offence</th>
                  <th className="px-3 py-2">Neighbourhood</th>
                  <th className="px-3 py-2">Lat</th>
                  <th className="px-3 py-2">Lng</th>
                </tr>
              </thead>
              <tbody>
                {shiftedPoints.slice(0, 12).map((point) => (
                  <tr className="border-t border-slate-100" key={point.event_unique_id}>
                    <td className="px-3 py-2">{point.occ_date ?? "-"}</td>
                    <td className="px-3 py-2">{point.offence ?? "-"}</td>
                    <td className="px-3 py-2">{point.neighbourhood ?? "-"}</td>
                    <td className="px-3 py-2">{point.lat.toFixed(6)}</td>
                    <td className="px-3 py-2">{point.lng.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
