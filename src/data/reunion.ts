import memberCsv from '../../data/Millet Family Groups.csv?raw'
import scheduleCsv from '../../data/Milliet Group Scheduels.csv?raw'
import type {
  Family,
  ReunionGroup,
  ScheduleEvent,
  ScheduleEventType,
} from '../types'

export const reunionConfig = {
  name: 'Kirtland Together',
  year: 2026,
  timeZone: 'America/New_York',
  mapCenter: [41.6218, -81.3608] as [number, number],
}

const familyId = 'artemus-millett'

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  return rows
}

const groupDefinitions = [
  { letter: 'A', memberColumn: 0, sourceLabel: 'Group 1 - Joseph' },
  { letter: 'B', memberColumn: 2, sourceLabel: 'Group 2 - Joseph' },
  { letter: 'C', memberColumn: 4, sourceLabel: 'Group 3 - Joseph' },
  { letter: 'D', memberColumn: 6, sourceLabel: 'Group 4 - Joseph' },
  { letter: 'E', memberColumn: 8, sourceLabel: 'Group 5 - Alma (mixed)' },
  { letter: 'F', memberColumn: 10, sourceLabel: 'Group 6 - Alma' },
  { letter: 'G', memberColumn: 12, sourceLabel: 'Group 7 - Alma' },
  { letter: 'H', memberColumn: 14, sourceLabel: 'Group 8 - Artemus Jr.' },
  { letter: 'I', memberColumn: 16, sourceLabel: 'Group 9' },
] as const

const memberRows = parseCsv(memberCsv).slice(1)

const milletGroups: ReunionGroup[] = groupDefinitions.map((definition) => {
  const memberNames = Array.from(
    new Set(
      memberRows
        .map((row) =>
          (row[definition.memberColumn] ?? '').replace(/\s+/g, ' ').trim(),
        )
        .filter((name) => name && !/^\d+$/.test(name)),
    ),
  )

  return {
    id: `millet-${definition.letter.toLowerCase()}`,
    name: `Group ${definition.letter}`,
    description: definition.sourceLabel,
    memberNames,
  }
})

export const families: Family[] = [
  {
    id: familyId,
    name: 'Artemus Millett / Millet Family',
    shortName: 'Millett / Millet Family',
    accent: '#17645d',
    accentSoft: '#e0f0ec',
    groups: milletGroups,
  },
]

const allGroupIds = milletGroups.map((group) => group.id)

const siteDetails: Record<
  string,
  { locationId: string; locationName: string; title: string }
> = {
  'Historic Kirtland': {
    locationId: 'historic-kirtland-visitors-center',
    locationName: "Historic Kirtland Visitors' Center",
    title: 'Historic Kirtland tour',
  },
  'Kirtland Temple': {
    locationId: 'kirtland-temple',
    locationName: 'Kirtland Temple',
    title: 'Kirtland Temple tour',
  },
  'Smith Home': {
    locationId: 'joseph-emma-smith-home',
    locationName: 'Joseph & Emma Smith Home',
    title: 'Joseph & Emma Smith Home tour',
  },
  'Johnson Home': {
    locationId: 'john-johnson-farm',
    locationName: 'John & Elsa Johnson Home',
    title: 'John & Elsa Johnson Home tour',
  },
}

function toIso(dateText: string, timeText: string) {
  const dateMatch = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!dateMatch || !timeMatch) return ''

  const [, month, day, year] = dateMatch
  const [, rawHour, minute, period] = timeMatch
  let hour = Number(rawHour) % 12
  if (period.toUpperCase() === 'PM') hour += 12

  return `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${minute}:00-04:00`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildGroupEvents(): ScheduleEvent[] {
  const [header, ...rows] = parseCsv(scheduleCsv)
  const columns = Object.fromEntries(
    header.map((name, index) => [name.trim(), index]),
  )
  const seenRows = new Set<string>()

  return rows.flatMap((row, rowIndex) => {
    const date = row[columns.Date]?.trim()
    const siteName = row[columns['Site Name']]?.trim()
    const arrive = row[columns.Arrive]?.trim()
    const depart = row[columns.Depart]?.trim()
    const transport = row[columns['Bus/PV']]?.trim()
    const groupName = row[columns['Group Name']]?.trim()
    const letterMatch = groupName?.match(/Family ([A-I])\b/)

    if (!date || !siteName || !arrive || !depart || !letterMatch) return []

    let letter = letterMatch[1]
    const duplicateKey = `${date}|${siteName}|${arrive}|${depart}|${letter}`

    // The source has the same Saturday Group C row twice. The paired routing
    // pattern and missing D row identify the second entry as Group D.
    if (letter === 'C' && seenRows.has(duplicateKey)) {
      letter = 'D'
    } else {
      seenRows.add(duplicateKey)
    }

    const group = milletGroups.find((item) => item.name === `Group ${letter}`)
    const site = siteDetails[siteName]
    const start = toIso(date, arrive)
    const end = toIso(date, depart)
    if (!group || !site || !start || !end) return []

    return [
      {
        id: `millet-${letter.toLowerCase()}-${slugify(siteName)}-${rowIndex}`,
        familyId,
        groupIds: [group.id],
        title: site.title,
        start,
        end,
        locationId: site.locationId,
        locationName: site.locationName,
        type: 'activity' as const,
        scope: 'group' as const,
        note: transport ? `Transportation: ${transport}.` : undefined,
      },
    ]
  })
}

type CommonEvent = Omit<ScheduleEvent, 'familyId' | 'groupIds'>

function commonEvent(event: CommonEvent): ScheduleEvent {
  return {
    ...event,
    familyId,
    groupIds: allGroupIds,
  }
}

function eventType(type: ScheduleEventType) {
  return type
}

const registrationUrl =
  'https://www.visitkirtland.com/family-reunion/2026-registration'
const raceUrl =
  'https://runsignup.com/Race/OH/Kirtland/KirtlandHeritageRun'
const templeOpenHouseUrl =
  'https://www.churchofjesuschrist.org/featured/cleveland-ohio-open-house?lang=eng'

const commonEvents: ScheduleEvent[] = [
  commonEvent({
    id: 'millet-thu-temple-open-house',
    title: 'Cleveland Ohio Temple Open House',
    start: '2026-06-18T12:00:00-04:00',
    end: '2026-06-18T19:00:00-04:00',
    locationId: 'cleveland-ohio-temple',
    locationName: '5997 Brecksville Rd, Independence',
    type: eventType('activity'),
    scope: 'public',
    optional: true,
    note: 'Free public walking tour, approximately 25 minutes. Carpooling is encouraged.',
    link: templeOpenHouseUrl,
    linkLabel: 'Open house details',
  }),
  commonEvent({
    id: 'millet-thu-registration',
    title: 'Reunion registration',
    start: '2026-06-18T13:00:00-04:00',
    end: '2026-06-18T17:00:00-04:00',
    locationId: 'kirtland-stake-center',
    locationName: 'Kirtland Stake Center',
    type: eventType('activity'),
    scope: 'reunion',
    note: '8775 Kirtland Rd, Willoughby. Informal family gathering during registration.',
    link: registrationUrl,
    linkLabel: 'Register for reunion',
  }),
  commonEvent({
    id: 'millet-thu-welcome',
    title: 'Welcome meeting & introduction to Kirtland',
    start: '2026-06-18T17:00:00-04:00',
    locationId: 'kirtland-stake-center',
    locationName: 'Kirtland Stake Center',
    type: eventType('activity'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-thu-dinner',
    title: 'Dinner',
    start: '2026-06-18T18:30:00-04:00',
    locationId: 'reunion-gathering',
    locationName: 'See reunion announcements',
    type: eventType('meal'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-thu-devotional',
    title: 'Family devotional',
    start: '2026-06-18T20:00:00-04:00',
    locationId: 'reunion-gathering',
    locationName: 'See reunion announcements',
    type: eventType('activity'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-fri-site-tours',
    title: 'Church history site tours',
    start: '2026-06-19T10:00:00-04:00',
    end: '2026-06-19T13:00:00-04:00',
    locationId: 'historic-kirtland-visitors-center',
    locationName: 'Kirtland historic sites',
    type: eventType('activity'),
    scope: 'reunion',
    note: 'Follow the detailed stops and times listed for your group.',
  }),
  commonEvent({
    id: 'millet-fri-temple-open-house',
    title: 'Cleveland Ohio Temple Open House',
    start: '2026-06-19T12:00:00-04:00',
    end: '2026-06-19T19:00:00-04:00',
    locationId: 'cleveland-ohio-temple',
    locationName: '5997 Brecksville Rd, Independence',
    type: eventType('activity'),
    scope: 'public',
    optional: true,
    note: 'Free public walking tour, approximately 25 minutes. Carpooling is encouraged.',
    link: templeOpenHouseUrl,
    linkLabel: 'Open house details',
  }),
  commonEvent({
    id: 'millet-fri-youth-devotional',
    title: 'Youth & family devotional',
    start: '2026-06-19T16:00:00-04:00',
    locationId: 'kirtland-stake-center',
    locationName: 'Kirtland Stake Center',
    type: eventType('activity'),
    scope: 'public',
    note: 'With Brad Wilcox and Elder Nathan L. Johnson.',
  }),
  commonEvent({
    id: 'millet-fri-parade',
    title: 'Kirtland Heritage Parade',
    start: '2026-06-19T18:30:00-04:00',
    locationId: 'kirtland-parade',
    locationName: 'Corner of Route 306 & Joseph St.',
    type: eventType('activity'),
    scope: 'public',
  }),
  commonEvent({
    id: 'millet-sat-race-registration',
    title: 'Heritage 5K race-day registration',
    start: '2026-06-20T07:00:00-04:00',
    locationId: 'community-of-christ-chapel',
    locationName: '9017 Chillicothe Rd, Kirtland',
    type: eventType('activity'),
    scope: 'public',
    optional: true,
    link: raceUrl,
    linkLabel: 'Register for the 5K',
  }),
  commonEvent({
    id: 'millet-sat-heritage-run',
    title: 'Heritage 5K / Fun Walk',
    start: '2026-06-20T08:00:00-04:00',
    locationId: 'community-of-christ-chapel',
    locationName: '9017 Chillicothe Rd, Kirtland',
    type: eventType('activity'),
    scope: 'public',
    optional: true,
    note: 'Instructions and anthem begin at 7:45 AM. Separate registration and fee required.',
    link: raceUrl,
    linkLabel: 'Register for the 5K',
  }),
  commonEvent({
    id: 'millet-sat-touch-a-truck',
    title: 'Touch-a-Truck',
    start: '2026-06-20T08:30:00-04:00',
    end: '2026-06-20T10:15:00-04:00',
    locationId: 'community-of-christ-chapel',
    locationName: '9017 Chillicothe Rd, Kirtland',
    type: eventType('activity'),
    scope: 'public',
  }),
  commonEvent({
    id: 'millet-sat-breakfast',
    title: 'Pancake breakfast',
    start: '2026-06-20T08:45:00-04:00',
    end: '2026-06-20T10:15:00-04:00',
    locationId: 'community-of-christ-chapel',
    locationName: '9017 Chillicothe Rd, Kirtland',
    type: eventType('meal'),
    scope: 'public',
  }),
  commonEvent({
    id: 'millet-sat-temple-open-house',
    title: 'Cleveland Ohio Temple Open House',
    start: '2026-06-20T10:00:00-04:00',
    end: '2026-06-20T18:00:00-04:00',
    locationId: 'cleveland-ohio-temple',
    locationName: '5997 Brecksville Rd, Independence',
    type: eventType('activity'),
    scope: 'public',
    optional: true,
    note: 'Free public walking tour, approximately 25 minutes. Carpooling is encouraged.',
    link: templeOpenHouseUrl,
    linkLabel: 'Open house details',
  }),
  commonEvent({
    id: 'millet-sat-family-picture',
    title: 'Millet family picture',
    start: '2026-06-20T10:30:00-04:00',
    locationId: 'millet-family-picture',
    locationName: 'Corner of Conley St. & Chillicothe Rd.',
    type: eventType('activity'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-sat-family-time',
    title: 'Touring, open family time & gatherings',
    start: '2026-06-20T10:30:00-04:00',
    end: '2026-06-20T17:00:00-04:00',
    locationId: 'kirtland-area',
    locationName: 'Kirtland area',
    type: eventType('activity'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-sat-dinner',
    title: 'Dinner',
    start: '2026-06-20T17:00:00-04:00',
    locationId: 'reunion-gathering',
    locationName: 'See reunion announcements',
    type: eventType('meal'),
    scope: 'reunion',
  }),
  commonEvent({
    id: 'millet-sat-concert',
    title: 'The Bonner Family Concert',
    start: '2026-06-20T19:00:00-04:00',
    locationId: 'concert-tba',
    locationName: 'Location TBA',
    type: eventType('activity'),
    scope: 'public',
  }),
  commonEvent({
    id: 'millet-sun-worship',
    title: 'Worship services with the Kirtland Ward',
    start: '2026-06-21T09:00:00-04:00',
    locationId: 'lds-kirtland-meetinghouse',
    locationName: 'Kirtland Ward meetinghouse',
    type: eventType('activity'),
    scope: 'public',
  }),
  commonEvent({
    id: 'millet-sun-travel-home',
    title: 'Travel home',
    start: '2026-06-21T12:00:00-04:00',
    timeLabel: 'After services',
    locationId: 'travel-home',
    locationName: 'Safe travels',
    type: eventType('activity'),
    scope: 'reunion',
  }),
]

export const scheduleEvents: ScheduleEvent[] = [
  ...commonEvents,
  ...buildGroupEvents(),
]
