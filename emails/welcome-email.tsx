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
import { theme } from '@/lib/theme/constants'

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
      <Preview>Добро пожаловать в GoStayLo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Heading style={mainHeading}>GoStayLo</Heading>
            <Text style={tagline}>Premium rentals in Phuket</Text>
          </Section>

          {/* Welcome Message */}
          <Heading style={h1}>Добро пожаловать на Пхукет! 🏝️</Heading>
          
          <Text style={text}>
            Привет, <strong>{userName}</strong>!
          </Text>

          <Text style={text}>
            Спасибо за регистрацию в <strong>GoStayLo</strong> — вашем надёжном партнёре для аренды на Пхукете.
            Виллы, яхты, транспорт и экскурсии — всё в одном месте.
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
            Команда <strong>GoStayLo</strong>
          </Text>

          <Text style={footerSmall}>
            Если у вас есть вопросы, свяжитесь с нами: <Link href="https://t.me" style={link}>Telegram Support</Link>
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
  marginBottom: '28px',
  paddingBottom: '24px',
  borderBottom: `1px solid ${colors.divider}`,
}

const mainHeading = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: colors.primary,
  margin: '0',
}

const tagline = {
  margin: '8px 0 0',
  fontSize: '13px',
  color: colors.muted,
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

const codeBox = {
  backgroundColor: colors.tint,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '24px',
  textAlign: 'center' as const,
  margin: '32px 0',
  boxShadow: shadows.softBox,
}

const codeLabel = {
  color: colors.muted,
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const codeText = {
  color: colors.primary,
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  margin: '8px 0',
}

const codeDescription = {
  color: colors.muted,
  fontSize: '14px',
  margin: '12px 0 0',
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
