import BookingPlPage from '@/components/admin/finance-intelligence/BookingPlPage';

export const metadata = {
  title: 'Booking P&L — Financial Intelligence',
};

export default function FinanceIntelligenceBookingPlPage({ params }) {
  return <BookingPlPage bookingId={params.id} />;
}
