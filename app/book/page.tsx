'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function BookPage() {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [players, setPlayers] = useState(1)

  async function submitBooking() {
    const { error } = await supabase.from('bookings').insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      booking_date: bookingDate,
      booking_time: bookingTime,
      players: players,
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Booking saved')
  }

  return (
    <main>
      <h1>Book VRena</h1>

      <input placeholder="Name" onChange={(e) => setCustomerName(e.target.value)} />
      <br />

      <input placeholder="Phone" onChange={(e) => setCustomerPhone(e.target.value)} />
      <br />

      <input type="date" onChange={(e) => setBookingDate(e.target.value)} />
      <br />

      <input type="time" onChange={(e) => setBookingTime(e.target.value)} />
      <br />

      <input type="number" value={players} onChange={(e) => setPlayers(Number(e.target.value))} />
      <br />

      <button onClick={submitBooking}>Book Now</button>
    </main>
  )
}