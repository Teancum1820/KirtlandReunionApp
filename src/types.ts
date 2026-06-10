export type ReunionGroup = {
  id: string
  name: string
  description: string
}

export type Family = {
  id: string
  name: string
  shortName: string
  accent: string
  accentSoft: string
  groups: ReunionGroup[]
}

export type ScheduleEventType = 'shuttle' | 'activity' | 'meal'

export type ScheduleEvent = {
  id: string
  familyId: string
  groupIds: string[]
  title: string
  start: string
  end: string
  locationId: string
  locationName: string
  type: ScheduleEventType
  note?: string
}

export type LocationCategory =
  | 'historic'
  | 'dining'
  | 'shopping'
  | 'lodging'
  | 'community'
  | 'outdoors'
  | 'parking'

export type ReunionLocation = {
  id: string
  name: string
  description: string
  address?: string
  mapNumber?: number
  lat: number
  lng: number
  category: LocationCategory
}

export type UserSelection = {
  familyId: string
  groupId: string
}

export type OrganizerAlert = {
  alertType: 'departing' | 'arriving'
  familyId: string | null
  groupId: string | null
  locationName: string
  target: 'group' | 'family' | 'all'
}
