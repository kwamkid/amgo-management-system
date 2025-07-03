// lib/config/googleMaps.ts

export const GOOGLE_MAPS_CONFIG = {
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  libraries: ['places'] as ("places")[],
  id: 'google-map-script',
  language: 'th',
  region: 'TH'
}

export const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

export const defaultCenter = {
  lat: 13.7563, // Bangkok
  lng: 100.5018
}

// Custom marker icon
export const createMarkerIcon = (label: string) => ({
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#DC2626',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 3,
  scale: 12,
  labelOrigin: new google.maps.Point(0, 0)
})