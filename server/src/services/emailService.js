const nodemailer = require('nodemailer');
const {
  nodeEnv,
  emailUser,
  emailPass,
  emailClientId,
  emailClientSecret,
  emailRefreshToken,
  emailFrom,
  emailEnabled,
} = require('../config/env');

let cachedTransporter = null;
let cachedFallbackTransporter = null;

const maskEmail = (email = '') => {
  const [name = '', domain = ''] = String(email).split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

const buildRosettaCodeHtml = ({ code, title, description, warning }) => `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f9fafb;
            padding-bottom: 40px;
            padding-top: 40px;
        }
        .main {
            background-color: #ffffff;
            margin: 0 auto;
            width: 100%;
            max-width: 500px;
            border-spacing: 0;
            border-radius: 48px;
            color: #111827;
            border: 1px solid #f3f4f6;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
        }
        .header {
            padding: 40px 0 20px;
            text-align: center;
        }
        .content {
            padding: 0 40px 40px;
            text-align: center;
        }
        .title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 16px;
            letter-spacing: -0.025em;
        }
        .description {
            font-size: 16px;
            color: #6b7280;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .code-container {
            background-color: #eff6ff;
            border: 2px solid #dbeafe;
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 32px;
        }
        .verification-code {
            font-size: 36px;
            font-weight: 900;
            color: #2563eb;
            letter-spacing: 12px;
            font-family: 'Courier New', Courier, monospace;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            padding: 20px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        .warning {
            font-size: 13px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 24px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <table class="main" align="center">
            <tr>
                <td class="header">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                        <rect width="24" height="24" rx="8" fill="#2563eb"/>
                        <path d="M12 7V17M12 7L8 11M12 7L16 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </td>
            </tr>
            <tr>
                <td class="content">
                    <h1 class="title">${title}</h1>
                    <p class="description">${description}</p>

                    <div class="code-container">
                        <span class="verification-code">${code}</span>
                    </div>

                    <p class="warning">${warning}</p>
                </td>
            </tr>
            <tr>
                <td class="footer">
                    &nbsp;&copy; 2026 Rosetta &bull; Aula Virtual
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;

const buildRosettaResetLinkHtml = ({ resetUrl }) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña Rosetta</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f9fafb;
      padding-bottom: 40px;
      padding-top: 40px;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 500px;
      border-spacing: 0;
      border-radius: 48px;
      color: #111827;
      border: 1px solid #f3f4f6;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
    }
    .header {
      padding: 40px 0 20px;
      text-align: center;
    }
    .content {
      padding: 0 40px 40px;
      text-align: center;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 16px;
      letter-spacing: -0.025em;
    }
    .description {
      font-size: 16px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .button-wrap {
      margin-bottom: 32px;
    }
    .reset-btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 800;
      padding: 14px 26px;
      border-radius: 16px;
      letter-spacing: 0.02em;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      padding: 20px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .warning {
      font-size: 13px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
      padding-top: 24px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
            <rect width="24" height="24" rx="8" fill="#2563eb"/>
            <path d="M12 7V17M12 7L8 11M12 7L16 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1 class="title">Restablece tu contraseña</h1>
          <p class="description">¡¡Buenas!!<br>Recibimos una solicitud para cambiar tu contraseña. Haz clic en el siguiente botón para continuar de forma segura.</p>

          <div class="button-wrap">
            <a href="${resetUrl}" class="reset-btn">Restablecer la contraseña</a>
          </div>

          <p class="warning">Este enlace expirará en 15 minutos. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &nbsp;&copy; 2026 Rosetta &bull; Aula Virtual
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

const hasOAuthCredentials =
  Boolean(emailClientId) && Boolean(emailClientSecret) && Boolean(emailRefreshToken) && Boolean(emailUser);

const hasPasswordCredentials = Boolean(emailUser) && Boolean(emailPass);

const buildOAuthTransporter = () => {
  if (!hasOAuthCredentials) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: emailUser,
      clientId: emailClientId,
      clientSecret: emailClientSecret,
      refreshToken: emailRefreshToken,
    },
  });

  return cachedTransporter;
};

const buildPasswordTransporter = () => {
  if (!hasPasswordCredentials) return null;
  if (cachedFallbackTransporter) return cachedFallbackTransporter;

  cachedFallbackTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  return cachedFallbackTransporter;
};

const sendMail = async ({ to, subject, html }) => {
  if (!emailEnabled) {
    console.log(`[EMAIL DISABLED] ${subject} => ${maskEmail(to)}`);
    return true;
  }

  const oauthTransporter = buildOAuthTransporter();
  const passwordTransporter = buildPasswordTransporter();

  if (!oauthTransporter && !passwordTransporter) {
    throw new Error('Servicio de correo no configurado. Revisa variables EMAIL_* en .env');
  }

  const resolveFromEmail = () => {
    const candidate = String(emailFrom || emailUser || '').trim();
    if (!candidate) return '';
    const match = candidate.match(/<([^>]+)>/);
    const address = match ? match[1].trim() : candidate;
    return `Rosetta <${address}>`;
  };

  const mailPayload = {
    from: resolveFromEmail(),
    to,
    subject,
    html,
  };

  if (oauthTransporter) {
    try {
      await oauthTransporter.sendMail(mailPayload);
      return true;
    } catch (oauthError) {
      const oauthMessage = String(oauthError?.message || '').toLowerCase();
      const looksLikeAuthFailure =
        oauthMessage.includes('invalid login') ||
        oauthMessage.includes('badcredentials') ||
        oauthMessage.includes('invalid_grant') ||
        oauthMessage.includes('535');

      if (!passwordTransporter || !looksLikeAuthFailure) {
        if (looksLikeAuthFailure) {
          throw new Error(
            'Autenticación de Gmail rechazada. Verifica que EMAIL_USER sea la misma cuenta autorizada, regenera EMAIL_REFRESH_TOKEN con scope https://mail.google.com/ y usa EMAIL_FROM con formato "Rosetta <correo@gmail.com>".'
          );
        }
        throw oauthError;
      }

      cachedTransporter = null;
      console.warn('[EMAIL] OAuth2 falló, intentando fallback con App Password...');
    }
  }

  await passwordTransporter.sendMail(mailPayload);

  return true;
};

const send2FACode = async (email, code) => {
  const html = buildRosettaCodeHtml({
    code,
    title: 'Verifica tu acceso',
    description:
      '¡¡Buenas!!<br>Has solicitado entrar a tu cuenta. Utiliza el siguiente código de seguridad para completar el proceso de verificación:',
    warning:
      'Este código expirará en 10 minutos. Si no has solicitado este acceso, puedes ignorar este correo de forma segura.',
  });

  if (nodeEnv === 'development') {
    console.log(`[EMAIL SERVICE - DEV] Código 2FA enviado a ${maskEmail(email)}: ${code}`);
  }

  return sendMail({
    to: email,
    subject: 'Rosetta | Código de verificación',
    html,
  });
};

const sendPasswordResetLink = async (email, resetUrl) => {
  const html = buildRosettaResetLinkHtml({ resetUrl });

  if (nodeEnv === 'development') {
    console.log(`[EMAIL SERVICE - DEV] Link de recuperación enviado a ${maskEmail(email)}: ${resetUrl}`);
  }

  return sendMail({
    to: email,
    subject: 'Rosetta | Restablece tu contraseña',
    html,
  });
};

const formatHourMinute = (minute = 0) => {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const buildCalendarEmailShell = ({ title, subtitle, rows = [], accent = '#2563eb' }) => {
  const rowsHtml = rows
    .map(
      (row) => `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-weight: 700; width: 40%; text-align:left;">${row.label}</td>
        <td style="padding: 8px 0; color: #111827; font-weight: 800; text-align:center;">${row.value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Roboto,Arial,sans-serif;">
    <table style="width:100%;max-width:560px;margin:0 auto;background:#fff;border-radius:24px;border:1px solid #e5e7eb;padding:26px;text-align:center;">
      <tr>
        <td>
          <h1 style="margin:0;color:#111827;font-size:24px;line-height:1.2;text-align:center;">${title}</h1>
          <p style="margin:10px 0 18px;color:#6b7280;font-size:14px;line-height:1.6;text-align:center;">${subtitle}</p>
          <div style="height:3px;background:${accent};border-radius:999px;margin-bottom:16px;margin:0 auto;max-width:160px;"></div>
          <table style="width:100%;border-collapse:collapse;text-align:center;margin-top:12px;">${rowsHtml}</table>
          <p style="margin-top:22px;color:#9ca3af;font-size:12px;font-weight:700;">&copy; 2026 Rosetta</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendClassScheduleRequestEmail = async ({
  to,
  studentName,
  studentEmail,
  dateKey,
  startMinute,
  endMinute,
}) => {
  const html = buildCalendarEmailShell({
    title: 'Nueva solicitud de clase',
    subtitle: 'Un estudiante ha solicitado un horario para apartar clase.',
    accent: '#f59e0b',
    rows: [
      { label: 'Solicita', value: studentName || '--' },
      { label: 'Correo', value: studentEmail || '--' },
      { label: 'Fecha', value: dateKey || '--' },
      {
        label: 'Horario',
        value: `${formatHourMinute(startMinute)} - ${formatHourMinute(endMinute)}`,
      },
    ],
  });

  return sendMail({
    to,
    subject: 'Rosetta | Solicitud de clase pendiente',
    html,
  });
};

const sendClassScheduleApprovedEmail = async ({
  to,
  studentName,
  dateKey,
  startMinute,
  endMinute,
}) => {
  const html = buildCalendarEmailShell({
    title: 'Tu clase fue aprobada',
    subtitle: `Hola ${studentName || 'estudiante'}, tu solicitud fue aprobada correctamente.`,
    accent: '#10b981',
    rows: [
      { label: 'Fecha', value: dateKey || '--' },
      {
        label: 'Horario',
        value: `${formatHourMinute(startMinute)} - ${formatHourMinute(endMinute)}`,
      },
      { label: 'Estado', value: 'Reservado' },
    ],
  });

  return sendMail({
    to,
    subject: 'Rosetta | Clase confirmada',
    html,
  });
};

module.exports = {
  send2FACode,
  sendPasswordResetLink,
  sendClassScheduleRequestEmail,
  sendClassScheduleApprovedEmail,
};
