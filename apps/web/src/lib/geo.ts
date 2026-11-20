export interface LatLng {
  lat: number;
  lng: number;
}

export const PRESET_LOCATIONS: (LatLng & { label: string })[] = [
  { label: 'Agrabad, Chattogram', lat: 22.3253, lng: 91.8124 },
  { label: 'GEC Circle, Chattogram', lat: 22.359, lng: 91.8215 },
  { label: 'Chittagong University', lat: 22.471, lng: 91.786 },
  { label: 'Halishahar, Chattogram', lat: 22.3236, lng: 91.7787 },
  { label: 'Dhanmondi, Dhaka', lat: 23.7461, lng: 90.3742 },
  { label: 'Gulshan, Dhaka', lat: 23.7925, lng: 90.4078 },
  { label: 'Mirpur, Dhaka', lat: 23.8223, lng: 90.3654 },
  { label: 'Uttara, Dhaka', lat: 23.8759, lng: 90.3795 },
];

const KEY = 'tf.location';

export function loadSavedLocation(): (LatLng & { label: string }) | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveLocation(loc: LatLng & { label: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loc));
  } catch {
    /* storage unavailable: fine, it's only a convenience */
  }
}

export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
