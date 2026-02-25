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

export default function PayoutProcessedEmail({
  partnerName,
  amount,
  currency,
  method,
  destination,
  transactionId,
  dashboardUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>💰 Выплата успешно отправлена!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>💰 Выплата отправлена</Heading>
          </Section>

          <Section style={content}>
            <Text style={text}>
              Здравствуйте, <strong>{partnerName}</strong>!
            </Text>

            <Text style={text}>
              Мы обработали вашу выплату. Средства успешно отправлены на указанные вами реквизиты.
            </Text>

            <Section style={detailsBox}>
              <Text style={detailsTitle}>📋 Детали выплаты:</Text>
              <Hr style={detailsHr} />
              <Text style={detailsItem}>
                <strong>Сумма:</strong> {amount} {currency}
              </Text>
              <Text style={detailsItem}>
                <strong>Метод:</strong> {method === 'bank' ? '🏦 Банковский перевод' : '💎 USDT кошелек'}
              </Text>
              <Text style={detailsItem}>
                <strong>Куда:</strong> {destination}
              </Text>
              <Text style={detailsItem}>
                <strong>ID транзакции:</strong> <code style={code}>{transactionId}</code>
              </Text>
            </Section>

            <Text style={text}>
              {method === 'bank'
                ? '💡 Банковский перевод обычно приходит в течение 1-3 рабочих дней.'
                : '💡 USDT-транзакции обычно подтверждаются в течение 10-30 минут.'}
            </Text>

            <Section style={buttonContainer}>
              <Link href={dashboardUrl} style={button}>
                Посмотреть историю выплат →
              </Link>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Если средства не поступили в указанное время, свяжитесь с поддержкой:<br />
              <Link href="mailto:finance@funnyrent.com" style={link}>
                finance@funnyrent.com
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
  backgroundColor: '#8b5cf6',
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

const detailsBox = {
  backgroundColor: '#faf5ff',
  border: '2px solid #8b5cf6',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const detailsTitle = {
  color: '#6b21a8',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const detailsHr = {
  borderColor: '#c4b5fd',
  margin: '12px 0',
};

const detailsItem = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const code = {
  backgroundColor: '#f1f5f9',
  padding: '2px 6px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '13px',
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
