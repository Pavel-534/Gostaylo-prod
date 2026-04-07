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

interface PaymentSuccessEmailProps {
  guestName: string
  bookingId: string
  listingTitle: string
  checkIn: string
  checkOut: string
  totalDays: number
  totalPaid: number
  paymentMethod: string
  partnerName: string
  partnerPhone?: string
  address: string
  pdfReceiptUrl?: string
  bookingDetailsUrl: string
}

export default function PaymentSuccessEmail({
  guestName = 'Алексей Иванов',
  bookingId = 'BK-2025-001',
  listingTitle = 'Роскошная вилла с видом на океан',
  checkIn = '2025-12-20',
  checkOut = '2025-12-25',
  totalDays = 5,
  totalPaid = 119600,
  paymentMethod = 'Криптовалюта (USDT TRC-20)',
  partnerName = 'Иван Сергеевич',
  partnerPhone = '+66 12 345 6789',
  address = 'Rawai, Phuket, Thailand',
  pdfReceiptUrl = '',
  bookingDetailsUrl = 'https://funnyrent.com/renter/bookings',
}: PaymentSuccessEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Оплата подтверждена! Ваше бронирование #{bookingId}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={mainHeading}>GoStayLo</Heading>
          </Section>

          <Section style={successBadge}>
            <Heading style={h1}>Оплата подтверждена</Heading>
          </Section>
          
          <Text style={text}>
            Здравствуйте, <strong>{guestName}</strong>!
          </Text>

          <Text style={text}>
            Ваш платёж успешно обработан. Бронирование подтверждено и ждёт вас на Пхукете! 🏝️
          </Text>

          {/* Booking Summary */}
          <Section style={summaryBox}>
            <Heading style={boxHeading}>Детали бронирования</Heading>
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Номер бронирования:</Column>
              <Column style={summaryValue}>#{bookingId}</Column>
            </Row>
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Объект:</Column>
              <Column style={summaryValue}>{listingTitle}</Column>
            </Row>
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Адрес:</Column>
              <Column style={summaryValue}>{address}</Column>
            </Row>
            
            <Hr style={divider} />
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Заезд:</Column>
              <Column style={summaryValueBold}>{new Date(checkIn).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</Column>
            </Row>
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Выезд:</Column>
              <Column style={summaryValueBold}>{new Date(checkOut).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</Column>
            </Row>
            
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Дней:</Column>
              <Column style={summaryValueBold}>{totalDays}</Column>
            </Row>
          </Section>

          {/* Payment Info */}
          <Section style={paymentBox}>
            <Heading style={boxHeading}>Информация об оплате</Heading>
            
            <Row style={paymentRow}>
              <Column style={paymentLabel}>Способ оплаты:</Column>
              <Column style={paymentValue}>{paymentMethod}</Column>
            </Row>
            
            <Row style={paymentRow}>
              <Column style={paymentLabel}>Сумма оплачено:</Column>
              <Column style={totalPaidValue}>{totalPaid.toLocaleString('ru-RU')} ₿</Column>
            </Row>
            
            <Text style={paymentNote}>
              Платёж обработан и находится в эскроу. Средства будут переведены владельцу после вашего заезда.
            </Text>
          </Section>

          {/* Check-in Instructions */}
          <Section style={instructionsBox}>
            <Heading style={boxHeading}>Инструкции для заезда</Heading>
            
            <Text style={instructionText}>
              <strong>Контактное лицо:</strong> {partnerName}
            </Text>
            {partnerPhone && (
              <Text style={instructionText}>
                <strong>Телефон:</strong> <Link href={`tel:${partnerPhone}`} style={link}>{partnerPhone}</Link>
              </Text>
            )}
            <Text style={instructionText}>
              Свяжитесь с владельцем за 24 часа до заезда для уточнения времени и получения инструкций по check-in.
            </Text>
          </Section>

          {/* Action Buttons */}
          <Section style={buttonSection}>
            <Button style={button} href={bookingDetailsUrl}>
              Посмотреть бронирование
            </Button>
            
            {pdfReceiptUrl && (
              <Button style={buttonOutline} href={pdfReceiptUrl}>
                Скачать квитанцию (PDF)
              </Button>
            )}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Желаем вам прекрасного отдыха на Пхукете! 🌴<br />
            Команда <strong>GoStayLo</strong>
          </Text>

          <Text style={footerSmall}>
            Вопросы? Пишите нам: <Link href="https://t.me" style={link}>Telegram Support</Link>
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
  marginBottom: '20px',
  paddingBottom: '20px',
  borderBottom: `1px solid ${colors.divider}`,
}

const mainHeading = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: colors.primary,
  margin: '0',
}

const successBadge = {
  textAlign: 'center' as const,
  margin: '20px 0',
}

const h1 = {
  color: colors.text,
  fontSize: '26px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

const text = {
  color: colors.muted,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const summaryBox = {
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  margin: '24px 0',
  boxShadow: shadows.softBox,
}

const paymentBox = {
  backgroundColor: colors.tint,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  margin: '24px 0',
}

const instructionsBox = {
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  margin: '24px 0',
}

const boxHeading = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: colors.text,
  margin: '0 0 16px',
}

const summaryRow = {
  marginBottom: '10px',
}

const summaryLabel = {
  color: colors.muted,
  fontSize: '14px',
  width: '45%',
}

const summaryValue = {
  color: colors.text,
  fontSize: '14px',
  width: '55%',
  textAlign: 'right' as const,
}

const summaryValueBold = {
  color: colors.text,
  fontSize: '14px',
  fontWeight: '600',
  width: '55%',
  textAlign: 'right' as const,
}

const paymentRow = {
  marginBottom: '12px',
}

const paymentLabel = {
  color: colors.muted,
  fontSize: '14px',
  width: '50%',
}

const paymentValue = {
  color: colors.text,
  fontSize: '14px',
  fontWeight: '600',
  width: '50%',
  textAlign: 'right' as const,
}

const totalPaidValue = {
  color: colors.primary,
  fontSize: '24px',
  fontWeight: 'bold',
  width: '50%',
  textAlign: 'right' as const,
}

const paymentNote = {
  color: colors.muted,
  fontSize: '12px',
  marginTop: '12px',
  fontStyle: 'italic',
}

const instructionText = {
  color: colors.text,
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
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
  marginBottom: '12px',
}

const buttonOutline = {
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  borderRadius,
  color: colors.text,
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
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

const footerSmall = {
  color: colors.subtle,
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '16px 0',
}

const link = {
  color: colors.primary,
  textDecoration: 'underline',
}
