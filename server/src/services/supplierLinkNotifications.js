import { sendMail, isMailConfigured } from './mail.js';
import {
  MAIL_PRODUCT_NAME,
  buildEmailDocument,
  clientBaseUrl,
  emailBulletList,
  emailDetailCard,
  emailParagraph,
  escapeHtml,
  mailSubjectPrefix,
} from './emailLayout.js';

/**
 * When a buyer supervisor or admin connects to a supplier from the marketplace, notify that supplier's users.
 *
 * @param {object} opts
 * @param {{ email: string, fullName?: string }[]} opts.recipients
 * @param {string} opts.supplierCompanyName
 * @param {string} opts.buyerCompanyName
 * @param {string} [opts.buyerIndustry]
 * @param {string} [opts.linkedByName] — Name of the user who clicked Connect
 */
export async function emailSupplierLinkedByBuyer({
  recipients,
  supplierCompanyName,
  buyerCompanyName,
  buyerIndustry,
  linkedByName,
}) {
  if (!isMailConfigured()) return;
  const list = Array.isArray(recipients)
    ? recipients.filter((r) => r && String(r.email || '').trim())
    : [];
  if (!list.length) return;

  const buyer = escapeHtml(buyerCompanyName);
  const supplier = escapeHtml(supplierCompanyName);
  const industryLabel = String(buyerIndustry || '').trim() || 'Not specified';
  const linkedBy = String(linkedByName || '').trim();
  const subject = `${mailSubjectPrefix()} ${buyerCompanyName} added your organization`;
  const base = clientBaseUrl();

  for (const r of list) {
    const email = String(r.email).trim();
    const fn = escapeHtml(r.fullName || 'there');
    const cardRows = [
      ['Buyer organization', buyer],
      ['Industry', escapeHtml(industryLabel)],
    ];
    if (linkedBy) {
      cardRows.push(['Connected by', escapeHtml(linkedBy)]);
    }
    const card = emailDetailCard(cardRows);

    const html = buildEmailDocument({
      preheader: `${buyerCompanyName} connected with your supplier profile on ${MAIL_PRODUCT_NAME}`,
      headline: 'A buyer linked to your organization',
      accent: 'brand',
      bodyHtml: `${emailParagraph(`Hi ${fn},`)}
        ${emailParagraph(
          `<strong>${buyer}</strong> has added <strong>${supplier}</strong> as a connected supplier on <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong>. They may send requisitions and work with your team through the portal when your account is active.`
        )}
        ${emailParagraph(
          `This is an automated notification so your organization is aware of new buyer relationships. If you were not expecting this connection, review your marketplace visibility or contact support using the details below.`
        )}
        ${card}
        ${emailParagraph('<strong>Suggested next steps</strong>')}
        ${emailBulletList([
          `Sign in to <strong>${escapeHtml(MAIL_PRODUCT_NAME)}</strong> to review incoming activity and keep your catalog accurate.`,
          `Confirm your contact and fulfillment details so buyers can collaborate with you without delays.`,
        ])}`,
      ctaLabel: `Sign in to ${MAIL_PRODUCT_NAME}`,
      ctaPath: '/login',
      secondaryCtaLabel: 'Forgot password?',
      secondaryCtaPath: '/forgot-password',
      footerLine: `${supplier} · ${MAIL_PRODUCT_NAME}`,
    });

    const textLines = [
      `Hi ${r.fullName || 'there'},`,
      ``,
      `${buyerCompanyName} has added ${supplierCompanyName} as a connected supplier on ${MAIL_PRODUCT_NAME}.`,
      `They may send requisitions through the portal.`,
      ``,
      `Buyer organization: ${buyerCompanyName}`,
      `Industry: ${industryLabel}`,
    ];
    if (linkedBy) textLines.push(`Connected by: ${linkedBy}`);
    textLines.push(``, `Sign in: ${base}/login`);

    try {
      await sendMail({ to: email, subject, html, text: textLines.join('\n') });
    } catch (err) {
      console.error('[emailSupplierLinkedByBuyer] send failed:', err?.message || err);
    }
  }
}
