import BookingsList from '@/pages/admin/bookings/BookingsList';

export default function Waitlist() {
  return (
    <BookingsList
      title="Lista de espera"
      description="Reservas en espera de cupo."
      initialStatus="waitlist"
      statusLocked
    />
  );
}
