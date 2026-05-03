export interface PaidTicket {
  id: string
  tripCode: string          // TRO-XXXX-YYYY
  route: string             // "Circle → Madina"
  plate: string             // "GR-1234-22"
  fare: number              // GHS amount
  purchasedAt: string       // ISO timestamp
  expiresAt: string         // ISO timestamp (purchase + 2h)
  status: 'active' | 'expired' | 'used'
}

export interface TicketParams {
  route: string
  plate: string
  fare: number
  tripCode: string
  expiresAt: string
}
