import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@maplibre/maplibre-gl-leaflet';
import L from 'leaflet';

// Free, keyless vector basemap (OpenFreeMap) rendered via MapLibre GL as a
// Leaflet layer — no API key, no rate limit, clean Google-Maps-like styling.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export default function BaseMap() {
  const map = useMap();

  useEffect(() => {
    const layer = L.maplibreGL({
      style: STYLE_URL,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://openfreemap.org">OpenFreeMap</a>',
    }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map]);

  return null;
}
