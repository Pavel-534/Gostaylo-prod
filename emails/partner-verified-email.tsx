import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

export default function PartnerVerifiedEmail({ partnerName, loginUrl }) {
  return (
    <Html>
      <Head />
      <Preview>🎉 Ваша учетная запись верифицирована!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>🎉 Поздравляем!</Heading>
          </Section>

          <Section style={content}>
            <Text style={text}>
              Привет, <strong>{partnerName}</strong>!
            </Text>

            <Text style={text}>
              Отличные новости! Администратор FunnyRent одобрил вашу заявку.
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

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 24px',
  textAlign: 'center' as const,
  backgroundColor: '#10b981',
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const content = {
  padding: '0 24px',
};

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
};

const highlightBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #10b981',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const highlightText = {
  color: '#065f46',
  fontSize: '16px',
  fontWeight: '600',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
};

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
};
