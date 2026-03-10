import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components'

interface BookingRequestEmailProps {
  partnerName: string
  listingTitle: string
  guestName: string
  checkIn: string
  checkOut: string
  totalDays: number
  priceBreakdown: Array<{
    label: string
    amount: number
    seasonType?: string
  }>
  totalPrice: number
  commission: number
  partnerEarnings: number
  bookingUrl: string
}

export default function BookingRequestEmail({
  partnerName = 'Иван',
  listingTitle = 'Роскошная вилла с видом на океан',
  guestName = 'Алексей Иванов',
  checkIn = '2025-12-20',
  checkOut = '2025-12-25',
  totalDays = 5,
  priceBreakdown = [
    { label: '3 дня × 18,000 ₿ (Высокий сезон)', amount: 54000, seasonType: 'HIGH' },
    { label: '2 дня × 25,000 ₿ (Пик)', amount: 50000, seasonType: 'PEAK' },
  ],
  totalPrice = 104000,
  commission = 15600,
  partnerEarnings = 88400,
  bookingUrl = 'https://funnyrent.com/partner/bookings',
}: BookingRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Новый запрос на бронирование: {listingTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <div style={logoBox}>
              <Text style={logoText}>FR</Text>
            </div>
            <Heading style={mainHeading}>Gostaylo</Heading>
          </Section>

          {/* Main Heading */}
          <Heading style={h1}>Новый запрос на бронирование! 🎉</Heading>
          
          <Text style={text}>
            Здравствуйте, <strong>{partnerName}</strong>!
          </Text>

          <Text style={text}>
            У вас новый запрос на бронирование объекта <strong>{listingTitle}</strong>.
          </Text>

          {/* Booking Details Box */}
          <Section style={detailsBox}>
            <Heading style={boxHeading}>Детали бронирования</Heading>
            
            <Row style={detailRow}>
              <Column style={detailLabel}>Гость:</Column>
              <Column style={detailValue}>{guestName}</Column>
            </Row>
            
            <Row style={detailRow}>
              <Column style={detailLabel}>Заезд:</Column>
              <Column style={detailValue}>{new Date(checkIn).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Column>
            </Row>
            
            <Row style={detailRow}>
              <Column style={detailLabel}>Выезд:</Column>
              <Column style={detailValue}>{new Date(checkOut).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Column>
            </Row>
            
            <Row style={detailRow}>
              <Column style={detailLabel}>Дней:</Column>
              <Column style={detailValue}>{totalDays}</Column>
            </Row>
          </Section>

          {/* Price Breakdown */}
          <Section style={priceBox}>
            <Heading style={boxHeading}>Расчёт стоимости</Heading>
            
            {priceBreakdown.map((item, index) => (
              <Row key={index} style={priceRow}>
                <Column style={priceLabel}>{item.label}</Column>
                <Column style={priceValue}>{item.amount.toLocaleString('ru-RU')} ₿</Column>
              </Row>
            ))}
            
            <Hr style={divider} />
            
            <Row style={priceRow}>
              <Column style={priceLabelBold}>Стоимость проживания:</Column>
              <Column style={priceValueBold}>{totalPrice.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Row style={priceRow}>
              <Column style={priceLabel}>Сервисный сбор (15%):</Column>
              <Column style={priceValueGreen}>+{commission.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Hr style={divider} />
            
            <Row style={earningsRow}>
              <Column style={earningsLabel}>Вы получите:</Column>
              <Column style={earningsValue}>{partnerEarnings.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Text style={earningsNote}>
              85% от стоимости проживания будет переведено на ваш счёт после check-in гостя.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={bookingUrl}>
              Посмотреть бронирование
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            С уважением,<br />
            Команда <strong>Gostaylo</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f1f5f9',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
  borderRadius: '12px',
}

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const logoBox = {
  width: '64px',
  height: '64px',
  background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
  borderRadius: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '12px',
}

const logoText = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
}

const mainHeading = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#0d9488',
  margin: '0',
}

const h1 = {
  color: '#1e293b',
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '32px 0 24px',
}

const text = {
  color: '#475569',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const detailsBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const priceBox = {
  backgroundColor: '#f0fdfa',
  border: '2px solid #0d9488',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const boxHeading = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1e293b',
  margin: '0 0 16px',
}

const detailRow = {
  marginBottom: '12px',
}

const detailLabel = {
  color: '#64748b',
  fontSize: '14px',
  width: '40%',
}

const detailValue = {
  color: '#1e293b',
  fontSize: '14px',
  fontWeight: '600',
  width: '60%',
  textAlign: 'right' as const,
}

const priceRow = {
  marginBottom: '8px',
}

const priceLabel = {
  color: '#475569',
  fontSize: '14px',
  width: '70%',
}

const priceLabelBold = {
  color: '#1e293b',
  fontSize: '14px',
  fontWeight: '600',
  width: '70%',
}

const priceValue = {
  color: '#475569',
  fontSize: '14px',
  textAlign: 'right' as const,
  width: '30%',
}

const priceValueBold = {
  color: '#1e293b',
  fontSize: '14px',
  fontWeight: '600',
  textAlign: 'right' as const,
  width: '30%',
}

const priceValueGreen = {
  color: '#10b981',
  fontSize: '14px',
  fontWeight: '600',
  textAlign: 'right' as const,
  width: '30%',
}

const earningsRow = {
  marginTop: '8px',
}

const earningsLabel = {
  color: '#0f766e',
  fontSize: '16px',
  fontWeight: 'bold',
  width: '50%',
}

const earningsValue = {
  color: '#0d9488',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'right' as const,
  width: '50%',
}

const earningsNote = {
  color: '#0f766e',
  fontSize: '12px',
  marginTop: '12px',
  fontStyle: 'italic',
}

const divider = {
  borderColor: '#cbd5e1',
  margin: '12px 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#0d9488',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 0',
}

const footer = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '16px 0',
}
