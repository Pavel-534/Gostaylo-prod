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
import { theme } from '@/lib/theme/constants'

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
  /** Percentage for labels (e.g. 15) */
  commissionPercent: number
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
  commissionPercent = 15,
  bookingUrl = 'https://funnyrent.com/partner/bookings',
}: BookingRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Новый запрос на бронирование: {listingTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={mainHeading}>GoStayLo</Heading>
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
              <Column style={priceLabel}>Сервисный сбор ({commissionPercent}%):</Column>
              <Column style={priceValueGreen}>+{commission.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Hr style={divider} />
            
            <Row style={earningsRow}>
              <Column style={earningsLabel}>Вы получите:</Column>
              <Column style={earningsValue}>{partnerEarnings.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Text style={earningsNote}>
              {100 - commissionPercent}% от стоимости проживания будет переведено на ваш счёт после check-in гостя.
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
            Команда <strong>GoStayLo</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const { colors, borderRadius, fonts, shadows } = theme

const main = {
  backgroundColor: colors.canvas,
  fontFamily: fonts.main,
}

const container = {
  backgroundColor: colors.background,
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
  borderRadius,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.cardBox,
}

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
  paddingBottom: '20px',
  borderBottom: `1px solid ${colors.divider}`,
}

const mainHeading = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: colors.primary,
  margin: '0',
}

const h1 = {
  color: colors.text,
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '32px 0 24px',
}

const text = {
  color: colors.muted,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const detailsBox = {
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  margin: '24px 0',
  boxShadow: shadows.softBox,
}

const priceBox = {
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  margin: '24px 0',
  boxShadow: shadows.softBox,
}

const boxHeading = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: colors.text,
  margin: '0 0 16px',
}

const detailRow = {
  marginBottom: '12px',
}

const detailLabel = {
  color: colors.muted,
  fontSize: '14px',
  width: '40%',
}

const detailValue = {
  color: colors.text,
  fontSize: '14px',
  fontWeight: '600',
  width: '60%',
  textAlign: 'right' as const,
}

const priceRow = {
  marginBottom: '8px',
}

const priceLabel = {
  color: colors.muted,
  fontSize: '14px',
  width: '70%',
}

const priceLabelBold = {
  color: colors.text,
  fontSize: '14px',
  fontWeight: '600',
  width: '70%',
}

const priceValue = {
  color: colors.muted,
  fontSize: '14px',
  textAlign: 'right' as const,
  width: '30%',
}

const priceValueBold = {
  color: colors.text,
  fontSize: '14px',
  fontWeight: '600',
  textAlign: 'right' as const,
  width: '30%',
}

const priceValueGreen = {
  color: colors.primary,
  fontSize: '14px',
  fontWeight: '600',
  textAlign: 'right' as const,
  width: '30%',
}

const earningsRow = {
  marginTop: '8px',
}

const earningsLabel = {
  color: colors.muted,
  fontSize: '16px',
  fontWeight: 'bold',
  width: '50%',
}

const earningsValue = {
  color: colors.primary,
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'right' as const,
  width: '50%',
}

const earningsNote = {
  color: colors.muted,
  fontSize: '12px',
  marginTop: '12px',
  fontStyle: 'italic',
}

const divider = {
  borderColor: colors.divider,
  margin: '12px 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: colors.primary,
  borderRadius,
  color: colors.primaryForeground,
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const hr = {
  borderColor: colors.divider,
  margin: '32px 0',
}

const footer = {
  color: colors.muted,
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '16px 0',
}
