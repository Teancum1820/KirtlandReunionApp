import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellRing,
  BusFront,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Home,
  Info,
  LocateFixed,
  LogIn,
  Map as MapIcon,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Route,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { divIcon } from 'leaflet'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { locations } from './data/locations'
import {
  families,
  reunionConfig,
  scheduleEvents,
} from './data/reunion'
import type {
  Family,
  LocationCategory,
  ReunionGroup,
  ScheduleEvent,
  UserSelection,
} from './types'

type View = 'home' | 'schedule' | 'map' | 'more'
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const selectionKey = 'kirtland-reunion-selection'
const alertKey = 'kirtland-reunion-alerts'
const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
)
const defaultSelection: UserSelection = {
  familyId: families[0].id,
  groupId: families[0].groups[0].id,
}

const navItems: Array<{
  id: View
  label: string
  icon: typeof Home
}> = [
  { id: 'home', label: 'Today', icon: Home },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'map', label: 'Explore', icon: MapIcon },
  { id: 'more', label: 'More', icon: Menu },
]

const categoryMeta: Record<
  LocationCategory,
  { label: string; color: string; icon: string }
> = {
  historic: { label: 'Historic sites', color: '#9a5a36', icon: 'H' },
  dining: { label: 'Dining', color: '#ad6a16', icon: 'D' },
  shopping: { label: 'Shopping', color: '#2463a7', icon: 'S' },
  lodging: { label: 'Lodging', color: '#75537c', icon: 'L' },
  community: { label: 'Community', color: '#1c6b63', icon: 'C' },
  outdoors: { label: 'Parks & nature', color: '#4f7b42', icon: 'N' },
  parking: { label: 'Parking', color: '#5b6270', icon: 'P' },
  restroom: { label: 'Restrooms', color: '#287f9b', icon: 'R' },
}

const formatEventTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: reunionConfig.timeZone,
  }).format(new Date(iso))

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: reunionConfig.timeZone,
  }).format(new Date(iso))

const formatShortDay = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: reunionConfig.timeZone,
  }).format(new Date(iso))

function getStoredSelection(): UserSelection | null {
  try {
    const raw = localStorage.getItem(selectionKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserSelection
    const family = families.find((item) => item.id === parsed.familyId)
    if (!family?.groups.some((group) => group.id === parsed.groupId)) return null
    return parsed
  } catch {
    return null
  }
}

function App() {
  const storedSelection = getStoredSelection()
  const [view, setView] = useState<View>('home')
  const [selection, setSelection] = useState<UserSelection>(
    storedSelection ?? defaultSelection,
  )
  const [showGroupPicker, setShowGroupPicker] = useState(!storedSelection)
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem(alertKey) === 'enabled',
  )
  const [alertMessage, setAlertMessage] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const family =
    families.find((item) => item.id === selection.familyId) ?? families[0]
  const group =
    family.groups.find((item) => item.id === selection.groupId) ??
    family.groups[0]

  const visibleEvents = useMemo(
    () =>
      scheduleEvents
        .filter(
          (event) =>
            event.familyId === family.id && event.groupIds.includes(group.id),
        )
        .sort(
          (left, right) =>
            new Date(left.start).getTime() - new Date(right.start).getTime(),
        ),
    [family.id, group.id],
  )

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    const updateOnline = () => setIsOnline(navigator.onLine)
    window.addEventListener('beforeinstallprompt', handleInstall)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstall)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  const saveSelection = (next: UserSelection) => {
    setSelection(next)
    localStorage.setItem(selectionKey, JSON.stringify(next))
    setShowGroupPicker(false)
  }

  const enableAlerts = async () => {
    setAlertMessage('Connecting alerts...')
    const { enableRemoteAlerts } = await import('./lib/firebase')
    const result = await enableRemoteAlerts(selection)
    if (result.ok) {
      setAlertsEnabled(true)
      localStorage.setItem(alertKey, 'enabled')
    }
    setAlertMessage(result.message)
  }

  const installApp = async () => {
    if (!installPrompt) {
      setAlertMessage(
        'Use your browser menu and choose “Add to Home Screen” or “Install app.”',
      )
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const navigate = (next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Main navigation">
        <Brand />
        <nav>
          {navItems.map((item) => (
            <button
              className={view === item.id ? 'rail-link active' : 'rail-link'}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <item.icon size={20} strokeWidth={2.2} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-family">
          <span className="eyebrow">Your reunion</span>
          <strong>{family.shortName}</strong>
          <span>{group.name}</span>
          <button type="button" onClick={() => setShowGroupPicker(true)}>
            Switch group
          </button>
        </div>
      </aside>

      <main className="main-content">
        {!isOnline && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            Offline mode: saved schedules and places are still available.
          </div>
        )}

        {view === 'home' && (
          <HomeView
            alertsEnabled={alertsEnabled}
            enableAlerts={enableAlerts}
            events={visibleEvents}
            family={family}
            group={group}
            navigate={navigate}
            openGroupPicker={() => setShowGroupPicker(true)}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView events={visibleEvents} family={family} group={group} />
        )}
        {view === 'map' && <ExploreMap />}
        {view === 'more' && (
          <MoreView
            alertsEnabled={alertsEnabled}
            enableAlerts={enableAlerts}
            family={family}
            group={group}
            installApp={installApp}
            openGroupPicker={() => setShowGroupPicker(true)}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            className={view === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => navigate(item.id)}
            type="button"
          >
            <item.icon size={21} strokeWidth={2.2} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {showGroupPicker && (
        <GroupPicker
          current={selection}
          dismissible={Boolean(storedSelection)}
          onClose={() => setShowGroupPicker(false)}
          onSave={saveSelection}
        />
      )}

      {alertMessage && (
        <div className="toast" role="status">
          <span>{alertMessage}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => setAlertMessage('')}
            type="button"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <Route size={22} />
      </div>
      <div>
        <strong>Kirtland Together</strong>
        <span>Family Reunion 2026</span>
      </div>
    </div>
  )
}

function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  )
}

function HomeView({
  alertsEnabled,
  enableAlerts,
  events,
  family,
  group,
  navigate,
  openGroupPicker,
}: {
  alertsEnabled: boolean
  enableAlerts: () => void
  events: ScheduleEvent[]
  family: Family
  group: ReunionGroup
  navigate: (view: View) => void
  openGroupPicker: () => void
}) {
  const now = new Date()
  const nextEvent =
    events.find((event) => new Date(event.end).getTime() > now.getTime()) ??
    events[0]
  const followingEvents = events
    .filter((event) => event.id !== nextEvent?.id)
    .slice(0, 3)

  return (
    <>
      <section className="home-hero">
        <div className="hero-top">
          <Brand />
          <button
            className="icon-button"
            aria-label="Notification settings"
            onClick={enableAlerts}
            type="button"
          >
            {alertsEnabled ? <BellRing size={21} /> : <Bell size={21} />}
          </button>
        </div>
        <div className="hero-copy">
          <span className="year-chip">
            <Sparkles size={14} />
            Kirtland, Ohio · 2026
          </span>
          <h1>Welcome, {group.name}</h1>
          <p>
            Everything your family needs for a meaningful few days together.
          </p>
          <button className="group-pill" onClick={openGroupPicker} type="button">
            <span
              className="family-dot"
              style={{ background: family.accent }}
            />
            {family.shortName}
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="content-wrap home-grid">
        {!alertsEnabled && (
          <button className="alert-invite" onClick={enableAlerts} type="button">
            <span className="alert-icon">
              <BellRing size={21} />
            </span>
            <span>
              <strong>Never miss your shuttle</strong>
              <small>Turn on departure and arrival alerts</small>
            </span>
            <ChevronRight size={19} />
          </button>
        )}

        {nextEvent && (
          <section className="next-card">
            <div className="section-label">
              <span>Up next</span>
              <span>{formatShortDay(nextEvent.start)}</span>
            </div>
            <div className="next-card-main">
              <div className={`event-symbol ${nextEvent.type}`}>
                {nextEvent.type === 'shuttle' ? (
                  <BusFront size={24} />
                ) : (
                  <MapPin size={24} />
                )}
              </div>
              <div>
                <div className="time-row">
                  <Clock3 size={15} />
                  {formatEventTime(nextEvent.start)}
                </div>
                <h2>{nextEvent.title}</h2>
                <p>{nextEvent.locationName}</p>
              </div>
            </div>
            {nextEvent.note && (
              <div className="event-note">
                <Info size={15} />
                {nextEvent.note}
              </div>
            )}
            <button
              className="card-action"
              onClick={() => navigate('schedule')}
              type="button"
            >
              View full schedule
              <ChevronRight size={17} />
            </button>
          </section>
        )}

        <section className="quick-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">At your fingertips</span>
              <h2>Quick access</h2>
            </div>
          </div>
          <div className="quick-grid">
            <button onClick={() => navigate('map')} type="button">
              <span className="quick-icon teal">
                <MapIcon size={22} />
              </span>
              <strong>Reunion map</strong>
              <small>Sites, shuttles & more</small>
            </button>
            <button onClick={() => navigate('schedule')} type="button">
              <span className="quick-icon gold">
                <CalendarDays size={22} />
              </span>
              <strong>My schedule</strong>
              <small>{group.name} itinerary</small>
            </button>
            <a href="tel:+14402560000">
              <span className="quick-icon plum">
                <Phone size={22} />
              </span>
              <strong>Get help</strong>
              <small>Reunion support line</small>
            </a>
          </div>
        </section>

        <section className="coming-up">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Plan ahead</span>
              <h2>Coming up</h2>
            </div>
            <button onClick={() => navigate('schedule')} type="button">
              See all
            </button>
          </div>
          <div className="compact-events">
            {followingEvents.map((event) => (
              <EventRow event={event} key={event.id} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function EventRow({ event }: { event: ScheduleEvent }) {
  return (
    <article className="event-row">
      <div className="event-time">
        <strong>{formatEventTime(event.start)}</strong>
        <span>{formatShortDay(event.start).split(',')[0]}</span>
      </div>
      <div className={`event-line ${event.type}`} />
      <div className="event-row-copy">
        <strong>{event.title}</strong>
        <span>
          <MapPin size={13} />
          {event.locationName}
        </span>
      </div>
      <ChevronRight size={17} />
    </article>
  )
}

function ScheduleView({
  events,
  family,
  group,
}: {
  events: ScheduleEvent[]
  family: Family
  group: ReunionGroup
}) {
  const days = Array.from(
    new Set(events.map((event) => event.start.slice(0, 10))),
  )
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const activeDay =
    selectedDay && days.includes(selectedDay) ? selectedDay : (days[0] ?? '')
  const dayEvents = events.filter((event) =>
    event.start.startsWith(activeDay),
  )

  return (
    <div className="content-wrap page-view">
      <PageHeader
        eyebrow={`${family.shortName} · ${group.name}`}
        title="Your schedule"
        action={<div className="draft-badge">Draft itinerary</div>}
      />

      <div className="day-tabs" role="tablist" aria-label="Schedule days">
        {days.map((day) => {
          const date = new Date(`${day}T12:00:00-04:00`)
          return (
            <button
              aria-selected={activeDay === day}
              className={activeDay === day ? 'active' : ''}
              key={day}
              onClick={() => setSelectedDay(day)}
              role="tab"
              type="button"
            >
              <span>
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                }).format(date)}
              </span>
              <strong>{date.getDate()}</strong>
            </button>
          )
        })}
      </div>

      {dayEvents[0] && (
        <div className="schedule-day-heading">
          <span>{formatDay(dayEvents[0].start)}</span>
          <small>{dayEvents.length} activities</small>
        </div>
      )}

      <div className="schedule-list">
        {dayEvents.map((event, index) => (
          <article className="schedule-card" key={event.id}>
            <div className="schedule-time">
              <strong>{formatEventTime(event.start)}</strong>
              <span>
                {Math.round(
                  (new Date(event.end).getTime() -
                    new Date(event.start).getTime()) /
                    60000,
                )}{' '}
                min
              </span>
            </div>
            <div className="schedule-track">
              <span className={`track-dot ${event.type}`} />
              {index < dayEvents.length - 1 && <span className="track-line" />}
            </div>
            <div className="schedule-copy">
              <span className={`type-chip ${event.type}`}>
                {event.type === 'shuttle' ? 'Shuttle' : event.type}
              </span>
              <h2>{event.title}</h2>
              <p>
                <MapPin size={15} />
                {event.locationName}
              </p>
              {event.note && <small>{event.note}</small>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function MapFocus({
  position,
  request,
}: {
  position: [number, number] | null
  request: number
}) {
  const map = useMap()
  const lat = position?.[0]
  const lng = position?.[1]

  useEffect(() => {
    if (lat !== undefined && lng !== undefined) {
      map.flyTo([lat, lng], 17, { duration: 0.8 })
    }
  }, [lat, lng, map, request])

  return null
}

function ExploreMap() {
  const [category, setCategory] = useState<LocationCategory | 'all'>('all')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  )
  const [focusRequest, setFocusRequest] = useState(0)
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null,
  )
  const [locationError, setLocationError] = useState('')
  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null
  const focusPosition: [number, number] | null = selectedLocation
    ? [selectedLocation.lat, selectedLocation.lng]
    : userPosition
  const visibleLocations =
    category === 'all'
      ? locations
      : locations.filter((location) => location.category === category)

  const selectCategory = (nextCategory: LocationCategory | 'all') => {
    setCategory(nextCategory)
    setSelectedLocationId(null)
  }

  const focusLocation = (locationId: string) => {
    setSelectedLocationId(locationId)
    setFocusRequest((request) => request + 1)
  }

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not available on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition([
          position.coords.latitude,
          position.coords.longitude,
        ])
        setSelectedLocationId(null)
        setLocationError('')
      },
      () => setLocationError('Allow location access to show your position.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="map-page">
      <div className="map-header content-wrap">
        <PageHeader
          eyebrow="From the 2026 Kirtland map"
          title="Explore Kirtland"
          action={
            <button className="locate-button" onClick={locateUser} type="button">
              <LocateFixed size={18} />
              My location
            </button>
          }
        />
        <div className="map-filters">
          <button
            className={category === 'all' ? 'active' : ''}
            onClick={() => selectCategory('all')}
            type="button"
          >
            All places
          </button>
          {(Object.keys(categoryMeta) as LocationCategory[]).map((key) => (
            <button
              className={category === key ? 'active' : ''}
              key={key}
              onClick={() => selectCategory(key)}
              type="button"
            >
              <span style={{ background: categoryMeta[key].color }} />
              {categoryMeta[key].label}
            </button>
          ))}
        </div>
        {locationError && <p className="location-error">{locationError}</p>}
      </div>

      <div className="map-layout">
        <div className="map-canvas">
          <MapContainer
            center={reunionConfig.mapCenter}
            scrollWheelZoom
            zoom={14}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFocus position={focusPosition} request={focusRequest} />
            {userPosition && (
              <Circle
                center={userPosition}
                fillColor="#2463a7"
                fillOpacity={0.2}
                radius={40}
                weight={2}
              />
            )}
            {visibleLocations.map((location) => {
              const meta = categoryMeta[location.category]
              const isSelected = selectedLocationId === location.id
              const markerLabel = location.mapNumber ?? meta.icon
              const marker = divIcon({
                className: isSelected
                  ? 'custom-map-marker selected'
                  : 'custom-map-marker',
                html: `<span style="background:${meta.color}"><b>${markerLabel}</b></span>`,
                iconAnchor: [18, 36],
                popupAnchor: [0, -37],
              })
              return (
                <Marker
                  icon={marker}
                  key={location.id}
                  position={[location.lat, location.lng]}
                  eventHandlers={{
                    click: () => focusLocation(location.id),
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <span>
                        {location.mapNumber
                          ? `Map stop ${location.mapNumber} · ${meta.label}`
                          : meta.label}
                      </span>
                      <strong>{location.name}</strong>
                      <p>{location.description}</p>
                      {location.address && (
                        <small>{location.address}</small>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Get directions
                      </a>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        <aside className="place-list">
          <span className="eyebrow">
            {visibleLocations.length} places from the reference map
          </span>
          {visibleLocations.map((location) => {
            const meta = categoryMeta[location.category]
            const isSelected = selectedLocationId === location.id
            return (
              <div
                className={isSelected ? 'place-card selected' : 'place-card'}
                key={location.id}
              >
                <button
                  className="place-focus"
                  onClick={() => focusLocation(location.id)}
                  type="button"
                >
                  <span
                    className="place-marker"
                    style={{ background: meta.color }}
                  >
                    {location.mapNumber ?? meta.icon}
                  </span>
                  <span>
                    <small>
                      {location.mapNumber
                        ? `Map stop ${location.mapNumber} · ${meta.label}`
                        : meta.label}
                    </small>
                    <strong>{location.name}</strong>
                    <p>{location.address ?? location.description}</p>
                  </span>
                </button>
                <a
                  aria-label={`Get directions to ${location.name}`}
                  className="place-directions"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Navigation size={17} />
                </a>
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}

function MoreView({
  alertsEnabled,
  enableAlerts,
  family,
  group,
  installApp,
  openGroupPicker,
}: {
  alertsEnabled: boolean
  enableAlerts: () => void
  family: Family
  group: ReunionGroup
  installApp: () => void
  openGroupPicker: () => void
}) {
  return (
    <div className="content-wrap page-view more-page">
      <PageHeader eyebrow="Settings & support" title="More" />

      <section className="profile-card">
        <span
          className="profile-mark"
          style={{ background: family.accentSoft, color: family.accent }}
        >
          <Users size={25} />
        </span>
        <div>
          <small>Your reunion group</small>
          <strong>{family.name}</strong>
          <span>{group.name}</span>
        </div>
        <button onClick={openGroupPicker} type="button">
          Change
        </button>
      </section>

      <section className="settings-section">
        <span className="eyebrow">App settings</span>
        <button className="settings-row" onClick={enableAlerts} type="button">
          <span className="setting-icon teal">
            <BellRing size={20} />
          </span>
          <span>
            <strong>Shuttle alerts</strong>
            <small>
              {alertsEnabled
                ? 'Enabled for your family group'
                : 'Get departure and arrival updates'}
            </small>
          </span>
          {alertsEnabled ? <Check size={19} /> : <ChevronRight size={19} />}
        </button>
        <button className="settings-row" onClick={installApp} type="button">
          <span className="setting-icon gold">
            <Download size={20} />
          </span>
          <span>
            <strong>Install this app</strong>
            <small>Keep schedules handy and available offline</small>
          </span>
          <ChevronRight size={19} />
        </button>
      </section>

      <section className="settings-section">
        <span className="eyebrow">Help & information</span>
        <a className="settings-row" href="tel:+14402560000">
          <span className="setting-icon plum">
            <Phone size={20} />
          </span>
          <span>
            <strong>Reunion help line</strong>
            <small>(440) 256-0000 · Sample number</small>
          </span>
          <ChevronRight size={19} />
        </a>
        <div className="settings-row">
          <span className="setting-icon blue">
            <CircleHelp size={20} />
          </span>
          <span>
            <strong>Emergency information</strong>
            <small>For emergencies, call 911</small>
          </span>
        </div>
      </section>

      <OrganizerPanel family={family} group={group} />

      <p className="app-version">
        Kirtland Together · 2026 planning preview
      </p>
    </div>
  )
}

function OrganizerPanel({
  family,
  group,
}: {
  family: Family
  group: ReunionGroup
}) {
  const [expanded, setExpanded] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [alertType, setAlertType] = useState<'departing' | 'arriving'>(
    'departing',
  )
  const [target, setTarget] = useState<'group' | 'family' | 'all'>('group')

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('Signing in...')
    const { signInOrganizer } = await import('./lib/firebase')
    const result = await signInOrganizer(email, password)
    setSignedIn(result.ok)
    setStatus(result.message)
  }

  const send = async () => {
    setStatus('Sending alert...')
    const { sendOrganizerAlert } = await import('./lib/firebase')
    const result = await sendOrganizerAlert({
      alertType,
      familyId: target === 'all' ? null : family.id,
      groupId: target === 'group' ? group.id : null,
      locationName: 'Reunion shuttle stop',
      target,
    })
    setStatus(result.message)
  }

  return (
    <section className="organizer-panel">
      <button
        className="organizer-toggle"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span className="setting-icon dark">
          <ShieldCheck size={20} />
        </span>
        <span>
          <strong>Organizer tools</strong>
          <small>Send a shuttle status update</small>
        </span>
        <ChevronRight
          className={expanded ? 'rotated' : ''}
          size={19}
        />
      </button>
      {expanded && (
        <div className="organizer-content">
          {!firebaseConfigured && (
            <div className="setup-note">
              <Settings size={17} />
              Connect Firebase environment variables to activate live alerts.
            </div>
          )}
          {!signedIn ? (
            <form onSubmit={login}>
              <label>
                Organizer email
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button className="primary-button" type="submit">
                <LogIn size={17} />
                Sign in
              </button>
            </form>
          ) : (
            <div className="alert-composer">
              <label>
                Shuttle status
                <select
                  onChange={(event) =>
                    setAlertType(
                      event.target.value as 'departing' | 'arriving',
                    )
                  }
                  value={alertType}
                >
                  <option value="departing">Leaving now</option>
                  <option value="arriving">Arriving now</option>
                </select>
              </label>
              <label>
                Send to
                <select
                  onChange={(event) =>
                    setTarget(event.target.value as typeof target)
                  }
                  value={target}
                >
                  <option value="group">{group.name}</option>
                  <option value="family">All {family.shortName} groups</option>
                  <option value="all">Everyone</option>
                </select>
              </label>
              <button className="primary-button" onClick={send} type="button">
                <Send size={17} />
                Send shuttle alert
              </button>
            </div>
          )}
          {status && <p className="organizer-status">{status}</p>}
        </div>
      )}
    </section>
  )
}

function GroupPicker({
  current,
  dismissible,
  onClose,
  onSave,
}: {
  current: UserSelection
  dismissible: boolean
  onClose: () => void
  onSave: (selection: UserSelection) => void
}) {
  const [draft, setDraft] = useState(current)
  const selectedFamily =
    families.find((family) => family.id === draft.familyId) ?? families[0]

  const selectFamily = (family: Family) => {
    setDraft({ familyId: family.id, groupId: family.groups[0].id })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="group-picker-title"
        aria-modal="true"
        className="group-picker"
        role="dialog"
      >
        {dismissible && (
          <button
            aria-label="Close group picker"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        )}
        <div className="picker-mark">
          <Users size={26} />
        </div>
        <span className="eyebrow">Personalize your reunion</span>
        <h2 id="group-picker-title">Which group are you with?</h2>
        <p>Your choice shows the right schedule and shuttle alerts.</p>

        <div className="family-options">
          {families.map((family) => (
            <button
              className={draft.familyId === family.id ? 'selected' : ''}
              key={family.id}
              onClick={() => selectFamily(family)}
              style={
                {
                  '--family-accent': family.accent,
                  '--family-soft': family.accentSoft,
                } as React.CSSProperties
              }
              type="button"
            >
              <span className="family-option-mark">
                {family.shortName.charAt(0)}
              </span>
              <span>
                <small>2026 family reunion</small>
                <strong>{family.name}</strong>
              </span>
              {draft.familyId === family.id && (
                <span className="selected-check">
                  <Check size={15} />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="group-options">
          <label htmlFor="group-select">Choose your schedule group</label>
          <select
            id="group-select"
            onChange={(event) =>
              setDraft({ ...draft, groupId: event.target.value })
            }
            value={draft.groupId}
          >
            {selectedFamily.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="continue-button"
          onClick={() => onSave(draft)}
          type="button"
        >
          View my reunion
          <ChevronRight size={18} />
        </button>
        <small className="picker-note">
          You can change this anytime in More.
        </small>
      </section>
    </div>
  )
}

export default App
