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
          {/* Logo */}
          <Section style={logoSection}>
            <div style={logoBox}>
              <Text style={logoText}>FR</Text>
            </div>
            <Heading style={mainHeading}>Gostaylo</Heading>
          </Section>

          {/* Success Badge */}
          <Section style={successBadge}>
            <Text style={successIcon}>✅</Text>
            <Heading style={h1}>Оплата успешно подтверждена!</Heading>
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
            Команда <strong>Gostaylo</strong>
          </Text>

          <Text style={footerSmall}>
            Вопросы? Пишите нам: <Link href="https://t.me" style={link}>Telegram Support</Link>
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
  marginBottom: '24px',
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

const successBadge = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const successIcon = {
  fontSize: '64px',
  margin: '0',
}

const h1 = {
  color: '#10b981',
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '16px 0 24px',
}

const text = {
  color: '#475569',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const summaryBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const paymentBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #10b981',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const instructionsBox = {
  backgroundColor: '#fff7ed',
  border: '2px solid #f97316',
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

const summaryRow = {
  marginBottom: '10px',
}

const summaryLabel = {
  color: '#64748b',
  fontSize: '14px',
  width: '45%',
}

const summaryValue = {
  color: '#1e293b',
  fontSize: '14px',
  width: '55%',
  textAlign: 'right' as const,
}

const summaryValueBold = {
  color: '#1e293b',
  fontSize: '14px',
  fontWeight: '600',
  width: '55%',
  textAlign: 'right' as const,
}

const paymentRow = {
  marginBottom: '12px',
}

const paymentLabel = {
  color: '#166534',
  fontSize: '14px',
  width: '50%',
}

const paymentValue = {
  color: '#166534',
  fontSize: '14px',
  fontWeight: '600',
  width: '50%',
  textAlign: 'right' as const,
}

const totalPaidValue = {
  color: '#10b981',
  fontSize: '24px',
  fontWeight: 'bold',
  width: '50%',
  textAlign: 'right' as const,
}

const paymentNote = {
  color: '#166534',
  fontSize: '12px',
  marginTop: '12px',
  fontStyle: 'italic',
}

const instructionText = {
  color: '#9a3412',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
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
  marginBottom: '12px',
}

const buttonOutline = {
  backgroundColor: '#ffffff',
  border: '2px solid #0d9488',
  borderRadius: '8px',
  color: '#0d9488',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
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

const footerSmall = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '16px 0',
}

const link = {
  color: '#0d9488',
  textDecoration: 'underline',
}
