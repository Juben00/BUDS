'use strict';

const nodemailer = require('nodemailer');
const { renderSampleRequest } = require('./templates/sample-request');

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

let transport;

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: required('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: required('SMTP_USER'), pass: required('SMTP_PASS') },
  });
  return transport;
}

async function sendSampleRequest(data) {
  const { subject, text, html } = renderSampleRequest(data);

  const message = {
    from: required('MAIL_FROM'),
    to: required('MAIL_TO').split(',').map((s) => s.trim()).filter(Boolean),
    subject,
    text,
    html,
  };

  if (String(process.env.REPLY_TO_SUBMITTER).toLowerCase() === 'true') {
    message.replyTo = `${data.firstName} ${data.lastName} <${data.email}>`;
  }

  const info = await getTransport().sendMail(message);
  return info.messageId;
}

async function verifyTransport() {
  await getTransport().verify();
}

module.exports = { sendSampleRequest, verifyTransport };
