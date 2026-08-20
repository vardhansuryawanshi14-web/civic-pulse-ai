import { useMemo } from 'react'
import { Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'

const CONTAINER = { width: '100%', height: '100%' }

// Google removed visualization.HeatmapLayer in Maps JS 3.65, so density is drawn
// with weighted circles instead: colour by priority band, radius by score.
const BANDS = [
  { min: 20, color: '#FFB4AB' }, // Critical — matches --destructive
  { min: 10, color: '#F59E0B' }, // Moderate
  { min: 0, color: '#4EDEA3' }, // Low — matches --success
]

const bandColor = (score) => BANDS.find((b) => score >= b.min).color

// 120m at the lowest score up to 600m at 30, so clusters read as heat without
// one critical report swallowing the map.
const bandRadius = (score) => 120 + Math.min(Math.max(score, 0), 30) * 16

function Notice({ children }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      <p className="max-w-sm">{children}</p>
    </div>
  )
}

// Google's "night mode" styling, trimmed to the entries that matter on a dark UI.
const NIGHT_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
]

export default function ComplaintHeatmap({ complaints, nightMode = false, onSelect }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const located = useMemo(
    () => complaints.filter((c) => c.latitude != null && c.longitude != null),
    [complaints],
  )

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'civicpulse-maps',
    googleMapsApiKey: apiKey || '',
    // never attempt a load without a key — it only produces a console error
    preventGoogleFontsLoading: true,
  })

  if (!apiKey)
    return (
      <Notice>
        Set <code className="font-mono-data">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
        <code className="font-mono-data">frontend/.env</code> to show the complaint heatmap.
      </Notice>
    )
  if (loadError) return <Notice>Google Maps failed to load. Check the API key and its referrer restrictions.</Notice>
  if (!isLoaded) return <Notice>Loading map…</Notice>
  if (located.length === 0)
    return <Notice>No complaint has coordinates yet. They appear here once citizens share a location.</Notice>

  const center = {
    lat: located.reduce((sum, c) => sum + c.latitude, 0) / located.length,
    lng: located.reduce((sum, c) => sum + c.longitude, 0) / located.length,
  }

  return (
    <GoogleMap
      mapContainerStyle={CONTAINER}
      center={center}
      zoom={located.length === 1 ? 15 : 12}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        styles: nightMode ? NIGHT_STYLES : undefined,
      }}
    >
      {/* drawn first so the click targets below stay on top */}
      {located.map((c) => {
        const score = Math.max(c.priority_score || 1, 1)
        const color = bandColor(score)
        return (
          <Circle
            key={`heat-${c.id}`}
            center={{ lat: c.latitude, lng: c.longitude }}
            radius={bandRadius(score)}
            options={{
              strokeWeight: 0,
              fillColor: color,
              fillOpacity: 0.28,
              clickable: false,
            }}
          />
        )
      })}
      {located.map((c) => (
        <Marker
          key={c.id}
          position={{ lat: c.latitude, lng: c.longitude }}
          title={`#${c.id} ${c.issue_type} — ${c.status} (score ${c.priority_score})`}
          onClick={() => onSelect?.(c)}
        />
      ))}
    </GoogleMap>
  )
}
