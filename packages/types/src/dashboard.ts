export interface DashboardPropertyToday {
  propertyId: string;
  propertyName: string;
  /** The property's own "today" (its timezone, not the server's). */
  today: string;
  arrivals: number;
  departures: number;
  inHouse: number;
  rooms: number;
  /** Rooms that can be sold right now: not out of order, out of service or under maintenance. */
  sellableRooms: number;
  dirtyRooms: number;
  /** In-house guests divided by sellable rooms, as a whole percent. null when no room is sellable. */
  occupancyPct: number | null;
}

export interface DashboardToday {
  properties: DashboardPropertyToday[];
  totals: {
    arrivals: number;
    departures: number;
    inHouse: number;
    rooms: number;
    sellableRooms: number;
    dirtyRooms: number;
    occupancyPct: number | null;
  };
}

export const occupancyPct = (inHouse: number, sellableRooms: number): number | null =>
  sellableRooms > 0 ? Math.round((inHouse / sellableRooms) * 100) : null;
