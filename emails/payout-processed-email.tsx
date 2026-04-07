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
            <Heading style={brand}>GoStayLo</Heading>
            <Heading style={h1}>Выплата отправлена</Heading>
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

const detailsBox = {
  backgroundColor: colors.canvas,
  border: `1px solid ${colors.border}`,
  borderRadius,
  padding: '20px',
  margin: '24px 0',
  boxShadow: shadows.softBox,
};

const detailsTitle = {
  color: colors.text,
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const detailsHr = {
  borderColor: colors.divider,
  margin: '12px 0',
};

const detailsItem = {
  color: colors.muted,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const code = {
  backgroundColor: colors.canvas,
  padding: '2px 6px',
  borderRadius: '6px',
  fontFamily: 'monospace',
  fontSize: '13px',
  color: colors.text,
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
