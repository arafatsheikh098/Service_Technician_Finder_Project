import { useEffect } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { LatLng } from '../lib/geo';

// Bundlers break Leaflet's default icon URLs; point them at the imported assets.
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const dot = (color: string, size = 18) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/** "You are here" / job address: a pulsing brand-coloured pin. */
export const homeIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:-10px;border-radius:50%;background:rgba(20,168,141,.25);animation:tf-pulse 2s ease-out infinite"></span>
    <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#34c3a6,#0c6e60);border:3px solid #fff;box-shadow:0 2px 10px rgba(12,110,96,.5)"></div>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
export const techIcon = dot('#4f46e5', 16);

/** Price pill marker used on the search map. */
const pricePin = (label: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);display:inline-flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 8px rgba(15,23,42,.25))">
      <div style="white-space:nowrap;padding:4px 9px;border-radius:999px;font:700 12px 'Plus Jakarta Sans',system-ui;background:${active ? '#0b1324' : '#fff'};color:${active ? '#fbbf24' : '#0b1324'};border:1.5px solid ${active ? '#0b1324' : '#e2e8f0'};${active ? 'transform:scale(1.12)' : ''}">${label}</div>
      <div style="width:8px;height:8px;margin-top:-4px;transform:rotate(45deg);background:${active ? '#0b1324' : '#fff'};border-right:1.5px solid ${active ? '#0b1324' : '#e2e8f0'};border-bottom:1.5px solid ${active ? '#0b1324' : '#e2e8f0'}"></div>
    </div>`,
    iconSize: [0, 0],
  });

/** The technician's live position while travelling. */
export const liveIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:34px;height:34px;transform:translate(-50%,-50%)">
    <span style="position:absolute;inset:-8px;border-radius:50%;background:rgba(79,70,229,.25);animation:tf-pulse 1.6s ease-out infinite"></span>
    <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#818cf8,#4338ca);border:3px solid #fff;box-shadow:0 4px 14px rgba(67,56,202,.5);display:flex;align-items:center;justify-content:center">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
    </div>
  </div>`,
  iconSize: [0, 0],
});

// Map tiles. The public OpenStreetMap servers are fine for development and demos, but
// their usage policy forbids heavy production traffic, so production builds should set
// VITE_MAP_TILE_URL to a tile provider (MapTiler, Stadia, self-hosted…). Tiles are
// softened with a CSS filter (see .leaflet-tile-pane in index.css).
const TILE_URL: string =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION: string =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function Recenter({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom());
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length > 1)
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
        padding: [40, 40],
        maxZoom: 15,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Click (or drag the pin) to choose a point. */
export function LocationPicker({
  value,
  onChange,
  height = 260,
  radiusKm,
}: {
  value: LatLng;
  onChange: (p: LatLng) => void;
  height?: number;
  radiusKm?: number;
}) {
  function ClickHandler() {
    useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
    return null;
  }
  return (
    <div data-lenis-prevent className="contents">
      <MapContainer center={[value.lat, value.lng]} zoom={14} style={{ height }} scrollWheelZoom>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <ClickHandler />
        <Recenter center={value} />
        {radiusKm && (
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#0f766e', weight: 1, fillOpacity: 0.06 }}
          />
        )}
        <Marker
          icon={homeIcon}
          position={[value.lat, value.lng]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onChange({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}

export function ResultsMap({
  origin,
  radiusKm,
  technicians,
  highlighted,
  onSelect,
}: {
  origin: LatLng;
  radiusKm: number;
  technicians: {
    id: string;
    fullName: string;
    lat: number;
    lng: number;
    distanceKm: number;
    hourlyRateBdt: number;
  }[];
  highlighted?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <div data-lenis-prevent className="contents">
      <MapContainer
        center={[origin.lat, origin.lng]}
        zoom={13}
        style={{ height: '100%', minHeight: 320 }}
        scrollWheelZoom
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Recenter center={origin} />
        <Circle
          center={[origin.lat, origin.lng]}
          radius={radiusKm * 1000}
          pathOptions={{
            color: '#14a88d',
            weight: 1.5,
            dashArray: '6 6',
            fillColor: '#14a88d',
            fillOpacity: 0.04,
          }}
        />
        <Marker position={[origin.lat, origin.lng]} icon={homeIcon}>
          <Popup>Your location</Popup>
        </Marker>
        {technicians.map((t) => (
          <Marker
            key={t.id}
            position={[t.lat, t.lng]}
            icon={pricePin(`৳${t.hourlyRateBdt}`, t.id === highlighted)}
            zIndexOffset={t.id === highlighted ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(t.id) }}
          >
            <Popup>
              <b>{t.fullName}</b>
              <br />
              {t.distanceKm} km away
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export function TrackingMap({
  destination,
  technician,
  height = 300,
}: {
  destination: LatLng;
  technician: LatLng | null;
  height?: number;
}) {
  return (
    <div data-lenis-prevent className="contents">
      <MapContainer
        center={[destination.lat, destination.lng]}
        zoom={14}
        style={{ height }}
        scrollWheelZoom={false}
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Marker position={[destination.lat, destination.lng]} icon={homeIcon}>
          <Popup>Job address</Popup>
        </Marker>
        {technician && <Marker position={[technician.lat, technician.lng]} icon={liveIcon} />}
        <FitBounds points={technician ? [destination, technician] : [destination]} />
      </MapContainer>
    </div>
  );
}
