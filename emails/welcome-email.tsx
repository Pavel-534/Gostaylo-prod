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
} from '@react-email/components'

interface WelcomeEmailProps {
  userName: string
  referralCode: string
  loginUrl: string
}

export default function WelcomeEmail({
  userName = 'Алексей',
  referralCode = 'ABC123',
  loginUrl = 'https://funnyrent.com/login',
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Добро пожаловать в FunnyRent! 🏝️</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo Section */}
          <Section style={logoSection}>
            <div style={logoBox}>
              <Text style={logoText}>FR</Text>
            </div>
            <Heading style={mainHeading}>FunnyRent</Heading>
          </Section>

          {/* Welcome Message */}
          <Heading style={h1}>Добро пожаловать на Пхукет! 🏝️</Heading>
          
          <Text style={text}>
            Привет, <strong>{userName}</strong>!
          </Text>

          <Text style={text}>
            Спасибо за регистрацию в <strong>FunnyRent</strong> — вашем надёжном партнёре для роскошной аренды на Пхукете. 
            Виллы, яхты, транспорт и экскурсии — всё в одном месте!
          </Text>

          {/* Referral Code Box */}
          <Section style={codeBox}>
            <Text style={codeLabel}>Ваш реферальный код:</Text>
            <Text style={codeText}>{referralCode}</Text>
            <Text style={codeDescription}>
              Поделитесь с друзьями и получайте <strong>5% кэшбэка</strong> с каждого их бронирования!
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={loginUrl}>
              Начать поиск жилья
            </Button>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Text style={footer}>
            С уважением,<br />
            Команда <strong>FunnyRent</strong>
          </Text>

          <Text style={footerSmall}>
            Если у вас есть вопросы, свяжитесь с нами: <Link href="https://t.me" style={link}>Telegram Support</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles (Teal Tropical Theme)
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

const codeBox = {
  backgroundColor: '#f0fdfa',
  border: '2px solid #0d9488',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '32px 0',
}

const codeLabel = {
  color: '#0f766e',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const codeText = {
  color: '#0d9488',
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  margin: '8px 0',
}

const codeDescription = {
  color: '#0f766e',
  fontSize: '14px',
  margin: '12px 0 0',
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
