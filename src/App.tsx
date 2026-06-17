import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Home,
  Info,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Menu,
  Navigation,
  Route,
  Search,
  Sparkles,
  UserRoundCheck,
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
  templeOpenHouseReminder,
} from './data/reunion'
import type {
  Family,
  LocationCategory,
  ReunionGroup,
  ScheduleEvent,
  UserSelection,
} from './types'

type View = 'home' | 'schedule' | 'map' | 'more'
type NavigateOptions = {
  mapCategory?: LocationCategory | 'all'
}
type Navigate = (next: View, options?: NavigateOptions) => void

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const selectionKey = 'kirtland-reunion-selection'
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

const formatEventTimeLabel = (event: ScheduleEvent) =>
  event.timeLabel ?? formatEventTime(event.start)

const eventIsCurrentOrUpcoming = (event: ScheduleEvent, now: Date) => {
  const fallbackEnd = new Date(event.start).getTime() + 60 * 60 * 1000
  const end = event.end ? new Date(event.end).getTime() : fallbackEnd
  return end > now.getTime()
}

const eventScopeLabel = (event: ScheduleEvent, group: ReunionGroup) => {
  if (event.optional) return 'Optional public event'
  if (event.scope === 'public') return 'Public event'
  if (event.scope === 'reunion') return 'All Millet groups'
  return `${group.name} schedule`
}

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
  const [statusMessage, setStatusMessage] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [mapCategory, setMapCategory] = useState<LocationCategory | 'all'>('all')

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

  const installApp = async () => {
    if (!installPrompt) {
      setStatusMessage(
        'Use your browser menu and choose "Add to Home Screen" or "Install app."',
      )
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const navigate: Navigate = (next, options = {}) => {
    if (next === 'map') {
      setMapCategory(options.mapCategory ?? 'all')
    }
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
            events={visibleEvents}
            family={family}
            group={group}
            memberName={selection.memberName}
            navigate={navigate}
            openGroupPicker={() => setShowGroupPicker(true)}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView
            events={visibleEvents}
            family={family}
            group={group}
            navigate={navigate}
          />
        )}
        {view === 'map' && (
          <ExploreMap key={mapCategory} defaultCategory={mapCategory} />
        )}
        {view === 'more' && (
          <MoreView
            family={family}
            group={group}
            installApp={installApp}
            memberName={selection.memberName}
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

      {statusMessage && (
        <div className="toast" role="status">
          <span>{statusMessage}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => setStatusMessage('')}
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
  events,
  family,
  group,
  memberName,
  navigate,
  openGroupPicker,
}: {
  events: ScheduleEvent[]
  family: Family
  group: ReunionGroup
  memberName?: string
  navigate: Navigate
  openGroupPicker: () => void
}) {
  const now = new Date()
  const coreEvents = events.filter((event) => !event.optional)
  const nextEvent =
    coreEvents.find((event) => eventIsCurrentOrUpcoming(event, now)) ??
    coreEvents[0] ??
    events[0]
  const followingEvents = coreEvents
    .filter((event) => event.id !== nextEvent?.id)
    .slice(0, 3)

  return (
    <>
      <section className="home-hero">
        <div className="hero-top">
          <Brand />
        </div>
        <div className="hero-copy">
          <span className="year-chip">
            <Sparkles size={14} />
            June 18-21, 2026
          </span>
          <h1>Welcome, {memberName ?? group.name}</h1>
          <p>
            Your {group.name} itinerary and shared reunion events are ready.
          </p>
          <button className="group-pill" onClick={openGroupPicker} type="button">
            <span
              className="family-dot"
              style={{ background: family.accent }}
            />
            {group.name} · {family.shortName}
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="content-wrap home-grid">
        {nextEvent && (
          <section className="next-card">
            <div className="section-label">
              <span>Up next</span>
              <span>{formatShortDay(nextEvent.start)}</span>
            </div>
            <div className="next-card-main">
              <div className={`event-symbol ${nextEvent.type}`}>
                <MapPin size={24} />
              </div>
              <div>
                <div className="time-row">
                  <Clock3 size={15} />
                  {formatEventTimeLabel(nextEvent)}
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
              <small>Sites, parking & amenities</small>
            </button>
            <button onClick={() => navigate('schedule')} type="button">
              <span className="quick-icon gold">
                <CalendarDays size={22} />
              </span>
              <strong>My schedule</strong>
              <small>{group.name} itinerary</small>
            </button>
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
        <strong>{formatEventTimeLabel(event)}</strong>
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
  navigate,
}: {
  events: ScheduleEvent[]
  family: Family
  group: ReunionGroup
  navigate: Navigate
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
        action={<div className="draft-badge">Tentative schedule</div>}
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
              <strong>{formatEventTimeLabel(event)}</strong>
              {event.end && (
                <span>
                  {Math.round(
                    (new Date(event.end).getTime() -
                      new Date(event.start).getTime()) /
                      60000,
                  )}{' '}
                  min
                </span>
              )}
            </div>
            <div className="schedule-track">
              <span className={`track-dot ${event.type}`} />
              {index < dayEvents.length - 1 && <span className="track-line" />}
            </div>
            <div className="schedule-copy">
              <span className={`type-chip scope-${event.scope}`}>
                {eventScopeLabel(event, group)}
              </span>
              <h2>{event.title}</h2>
              <p>
                <MapPin size={15} />
                {event.locationName}
              </p>
              {event.note && <small>{event.note}</small>}
              {event.mapCategoryLink && (
                <button
                  className="schedule-link"
                  onClick={() =>
                    navigate('map', { mapCategory: event.mapCategoryLink })
                  }
                  type="button"
                >
                  {event.linkLabel ?? 'View map options'}
                  <ChevronRight size={15} />
                </button>
              )}
              {!event.mapCategoryLink && event.link && (
                <a
                  className="schedule-link"
                  href={event.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  {event.linkLabel ?? 'Event details'}
                  <ChevronRight size={15} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      <aside className="temple-reminder">
        <span className="eyebrow">Optional public event reminder</span>
        <h2>{templeOpenHouseReminder.title}</h2>
        <p>{templeOpenHouseReminder.note}</p>
        <dl>
          <div>
            <dt>Dates</dt>
            <dd>{templeOpenHouseReminder.dates}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>{templeOpenHouseReminder.weekdayHours}</dd>
            <dd>{templeOpenHouseReminder.saturdayHours}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{templeOpenHouseReminder.location}</dd>
          </div>
        </dl>
        <a
          href={templeOpenHouseReminder.link}
          rel="noreferrer"
          target="_blank"
        >
          Open house details
          <ChevronRight size={16} />
        </a>
      </aside>
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

function ExploreMap({
  defaultCategory,
}: {
  defaultCategory: LocationCategory | 'all'
}) {
  const [category, setCategory] =
    useState<LocationCategory | 'all'>(defaultCategory)
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
  family,
  group,
  installApp,
  memberName,
  openGroupPicker,
}: {
  family: Family
  group: ReunionGroup
  installApp: () => void
  memberName?: string
  openGroupPicker: () => void
}) {
  return (
    <div className="content-wrap page-view more-page">
      <PageHeader eyebrow="App & reunion" title="More" />

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
          <span>
            {memberName ? `${memberName} · ${group.name}` : group.name}
          </span>
        </div>
        <button onClick={openGroupPicker} type="button">
          Change
        </button>
      </section>

      <section className="settings-section">
        <span className="eyebrow">App settings</span>
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

      <p className="app-version">
        Created by the Kirtland Heritage Group 2026
      </p>
    </div>
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
  const [nameQuery, setNameQuery] = useState(current.memberName ?? '')
  const [showMatches, setShowMatches] = useState(false)
  const selectedFamily =
    families.find((family) => family.id === draft.familyId) ?? families[0]
  const selectedGroup =
    selectedFamily.groups.find((group) => group.id === draft.groupId) ??
    selectedFamily.groups[0]
  const allMembers = useMemo(
    () =>
      selectedFamily.groups.flatMap((group) =>
        group.memberNames.map((name) => ({ name, group })),
      ),
    [selectedFamily],
  )
  const memberMatches = useMemo(() => {
    const query = nameQuery.trim().toLocaleLowerCase()
    if (query.length < 2) return []

    return allMembers
      .filter((member) => member.name.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        const leftStarts = left.name.toLocaleLowerCase().startsWith(query)
        const rightStarts = right.name.toLocaleLowerCase().startsWith(query)
        if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
        return left.name.localeCompare(right.name)
      })
      .slice(0, 12)
  }, [allMembers, nameQuery])

  const selectFamily = (family: Family) => {
    setDraft({ familyId: family.id, groupId: family.groups[0].id })
    setNameQuery('')
    setShowMatches(false)
  }

  const selectMember = (name: string, groupId: string) => {
    setDraft({ familyId: selectedFamily.id, groupId, memberName: name })
    setNameQuery(name)
    setShowMatches(false)
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
        <h2 id="group-picker-title">Find your reunion group</h2>
        <p>Search for your name and we will open the correct schedule.</p>

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

        <div className="member-search">
          <label htmlFor="member-search">Find your name</label>
          <div className="member-search-input">
            <Search size={18} />
            <input
              aria-controls="member-search-results"
              autoComplete="off"
              id="member-search"
              onChange={(event) => {
                setNameQuery(event.target.value)
                setDraft({ ...draft, memberName: undefined })
                setShowMatches(true)
              }}
              onFocus={() => setShowMatches(true)}
              placeholder="Start typing your name"
              type="search"
              value={nameQuery}
            />
          </div>

          {showMatches && nameQuery.trim().length >= 2 && (
            <div
              className="member-results"
              id="member-search-results"
              role="listbox"
            >
              {memberMatches.map((member) => (
                <button
                  key={`${member.group.id}-${member.name}`}
                  onClick={() => selectMember(member.name, member.group.id)}
                  role="option"
                  type="button"
                >
                  <span>
                    <strong>{member.name}</strong>
                    <small>
                      {member.group.name} · {member.group.description}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
              {memberMatches.length === 0 && (
                <p>No matching name found. Choose your group below.</p>
              )}
            </div>
          )}
        </div>

        {draft.memberName && (
          <div className="member-confirmation">
            <UserRoundCheck size={21} />
            <span>
              <small>Schedule found for {draft.memberName}</small>
              <strong>{selectedGroup.name}</strong>
            </span>
          </div>
        )}

        <div className="picker-divider">
          <span>or choose manually</span>
        </div>

        <div className="group-options">
          <label htmlFor="group-select">
            Can't find your name? Choose your schedule group
          </label>
          <select
            id="group-select"
            onChange={(event) => {
              setDraft({
                familyId: selectedFamily.id,
                groupId: event.target.value,
              })
              setNameQuery('')
              setShowMatches(false)
            }}
            value={draft.groupId}
          >
            {selectedFamily.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} - {group.description}
              </option>
            ))}
          </select>
        </div>

        <button
          className="continue-button"
          onClick={() => onSave(draft)}
          type="button"
        >
          View {selectedGroup.name} schedule
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
