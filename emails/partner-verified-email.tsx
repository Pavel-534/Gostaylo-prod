import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';
import { theme } from '@/lib/theme/constants';

export default function PartnerVerifiedEmail({ partnerName, loginUrl }) {
  return (
    <Html>
      <Head />
      <Preview>🎉 Ваша учетная запись верифицирована!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>GoStayLo</Heading>
            <Heading style={h1}>Аккаунт верифицирован</Heading>
          </Section>

          <Section style={content}>
            <Text style={text}>
              Привет, <strong>{partnerName}</strong>!
            </Text>

            <Text style={text}>
              Отличные новости! Администратор GoStayLo одобрил вашу заявку.
              Теперь вы официальный партнер платформы!
            </Text>

            <Section style={highlightBox}>
              <Text style={highlightText}>
                ✅ Ваш KYC-статус: <strong>VERIFIED</strong>
              </Text>
              <Text style={highlightText}>
                🏠 Вы можете публиковать объекты
              </Text>
              <Text style={highlightText}>
                💰 Вы можете получать бронирования
              </Text>
            </Section>

            <Text style={text}>
              Войдите в свой кабинет партнера, чтобы начать добавлять объекты недвижимости:
            </Text>

            <Section style={buttonContainer}>
              <Link href={loginUrl} style={button}>
                Войти в кабинет →
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Если у вас есть вопросы, свяжитесь с нашей службой поддержки.<br />
              <Link href="mailto:support@funnyrent.com" style={link}>
                support@funnyrent.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const { colors, borderRadius, fonts, shadows } = theme;

const main = {
  backgroundColor: colors.canvas,
  fontFamily: fonts.main,
};

const container = {
  backgroundColor: colors.background,
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  borderRadius,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.cardBox,
};

const header = {
  padding: '28px 24px 20px',
  textAlign: 'center' as const,
  borderBottom: `1px solid ${colors.divider}`,
};

const brand = {
  color: colors.primary,
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const h1 = {
  color: colors.text,
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '12px 0 0',
  padding: '0',
};

const content = {
  padding: '24px 24px 0',
};

const text = {
  color: colors.muted,
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
};

const highlightBox = {
  backgroundColor: colors.tint,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '16px',
  margin: '24px 0',
  boxShadow: shadows.softBox,
};

const highlightText = {
  color: colors.text,
  fontSize: '16px',
  fontWeight: '600',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: colors.primary,
  borderRadius,
  color: colors.primaryForeground,
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const hr = {
  borderColor: colors.divider,
  margin: '32px 0',
};

const footer = {
  color: colors.subtle,
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
};

const link = {
  color: colors.primary,
  textDecoration: 'underline',
};
