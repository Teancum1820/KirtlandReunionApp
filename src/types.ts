export type ReunionGroup = {
  id: string
  name: string
  description: string
  memberNames: string[]
}

export type Family = {
  id: string
  name: string
  shortName: string
  accent: string
  accentSoft: string
  groups: ReunionGroup[]
}

export type ScheduleEventType = 'activity' | 'meal'
export type ScheduleEventScope = 'group' | 'reunion' | 'public'

export type ScheduleEvent = {
  id: string
  familyId: string
  groupIds: string[]
  title: string
  start: string
  end?: string
  locationId: string
  locationName: string
  type: ScheduleEventType
  scope: ScheduleEventScope
  note?: string
  optional?: boolean
  timeLabel?: string
  link?: string
  linkLabel?: string
  mapCategoryLink?: LocationCategory
}

export type LocationCategory =
  | 'historic'
  | 'dining'
  | 'shopping'
  | 'lodging'
  | 'community'
  | 'outdoors'
  | 'parking'
  | 'restroom'

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
  memberName?: string
}
