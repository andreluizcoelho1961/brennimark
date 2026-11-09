/**
 * Terms of Use and Privacy Policy — the ENGLISH text, as data.
 *
 * Faithful translation of `documentos-legais.ts` (the Portuguese text is the source
 * and the reference). Written to use the English legal equivalents of the Brazilian
 * concepts, not word-for-word renderings: the Brazilian name is kept in parentheses
 * the first time a term appears, so a reviewing lawyer can map each one back.
 * Defined terms are capitalized and kept constant throughout:
 *   Assinante → Subscriber · Conta → Account · Pessoas convidadas → Invited Users.
 *
 * The Portuguese version is the one the Subscriber accepts today; this English text
 * is a courtesy translation prepared for legal review. It carries the SAME `versao`
 * as the Portuguese text, because it is the same legal act in another language (the
 * version travels with each purchase to say which text was accepted).
 * `documentos-legais.test.ts` checks that every deadline, amount and article number
 * is identical in the two languages, so a translation cannot drift silently.
 *
 * Markup, same as the Portuguese: **bold**; a paragraph starting with "- " is a list
 * item; [[page#anchor|text]] is a link (the page is written with the Portuguese
 * address, `termos`/`privacidade`, and the component turns it into `/en/terms`).
 * No italics: a Portuguese term goes in plain parentheses.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { EMPRESA } from "./empresa";
import type { DocumentoLegal } from "./documentos-legais";

const E = EMPRESA;

export const TERMS_OF_USE: DocumentoLegal = {
  versao: "2026-10-22",
  vigenteDesde: "October 22, 2026",
  secoes: [
    { titulo: "1. Who we are", paragrafos: [
      `Brennimark is a brand management platform registered under CNPJ (Brazilian corporate taxpayer number) ${E.cnpj}, reachable at ${E.email} ("Brennimark", "we", "us").`,
      `These terms apply to whoever subscribes to Brennimark and to everyone who uses the platform through a Subscriber's Account.`,
    ] },
    { titulo: "2. Who is who", paragrafos: [
      `"Subscriber" means the company (agency, studio or brand) that engages Brennimark and is responsible for the Account. The person who makes the purchase represents that they have authority to enter into the contract on the company's behalf.`,
      `"Account" means the Subscriber's space on the platform. Each Account groups one or more brands.`,
      `"Invited Users" are the people whom the Subscriber authorizes to use one or more brands. What each of them can do — consult, edit, approve or administer — is set per brand, by whoever administers the Account.`,
      `Brennimark is built for professional use. If the Subscriber is a consumer under the Brazilian Consumer Defense Code (Código de Defesa do Consumidor, "CDC"), the rights that law guarantees prevail over any rule in these terms to the contrary.`,
    ] },
    { titulo: "3. What Brennimark does", paragrafos: [
      `Brennimark stores the brand manual as a PDF and displays it as it was laid out; organizes the brand's materials, supplements and delivery links; and offers Vini, an artificial intelligence assistant that answers based on what the brand documents, citing the source and the status of each rule (approved, draft or pending).`,
      `Vini offers guidance. Vini does not approve pieces and does not replace the review of whoever is responsible for the brand. Artificial intelligence answers may contain errors, and the final decision always rests with the Subscriber's team.`,
    ] },
    { titulo: "4. Account, access and password", paragrafos: [
      `The Subscriber is responsible for the people it invites and for what those people do on the platform.`,
      `Passwords are personal. Each person uses their own access; sharing a password is not permitted. If you suspect misuse, let us know at ${E.email}.`,
    ] },
    { titulo: "5. Content belongs to whoever created it", paragrafos: [
      `Manuals, materials, supplements and other uploaded files remain the property of whoever created or commissioned them. Brennimark does not become the owner of anything the Subscriber uploads.`,
      `The Subscriber represents that it has the right to upload that content — including content belonging to its own clients — and authorizes us to store it, display it to the people the Subscriber authorizes, and process it (including through Vini) solely to provide the service.`,
    ] },
    { id: "data-processed-on-behalf-of-the-subscriber", titulo: "6. Data processed on behalf of the Subscriber", paragrafos: [
      `With respect to the content of the brands and the data of the Invited Users within them, the Subscriber is the controller and Brennimark is the processor (Brazilian General Data Protection Law, Lei Geral de Proteção de Dados, "LGPD", Art. 39). Accordingly, Brennimark:`,
      `- processes that data only to provide the service and in accordance with these terms, which are the Subscriber's instructions;`,
      `- uses only the suppliers listed in the Privacy Policy and gives the Subscriber 30 days' notice when adding a new one;`,
      `- notifies the Subscriber within 72 hours after becoming aware of a security incident affecting that data;`,
      `- helps the Subscriber respond to requests from data subjects;`,
      `- at the end of the contract, returns or deletes the data, as the Subscriber chooses.`,
      `We treat all content uploaded by the Subscriber as confidential. We access it only to provide the service, to give support when requested, or to comply with a legal order.`,
    ] },
    { titulo: "7. The platform is ours", paragrafos: [
      `The software, the Brennimark brand and the platform are ours; the subscription grants a right of use, not ownership. The Subscriber may use Vini's answers freely.`,
    ] },
    { titulo: "8. Brand font", paragrafos: [
      `Hosting of the brand's typeface is turned on only after the Subscriber accepts a specific term, described in the Font License. The Subscriber is responsible for the font license. The font is served for download only, to authenticated people of that brand, and is withdrawn if the type foundry that licenses it so requests.`,
    ] },
    { titulo: "9. Prohibited use", paragrafos: [
      `It is not permitted to use Brennimark to upload content that infringes third-party rights or the law; to attempt to access accounts, brands or data of other Subscribers; to circumvent technical or plan limits; or to resell access without a written agreement.`,
    ] },
    { titulo: "10. Suspension and notices", paragrafos: [
      `If these rules are violated, we may suspend the access involved, notifying whoever administers the Account and explaining the reason. In the case of serious or repeated violations, we may terminate the subscription; in that case, the Subscriber may export its content for 30 days.`,
      `Anyone who believes that content on Brennimark violates their rights may write to ${E.email}, identifying the content and the right. We will assess the notice and, where appropriate, forward it to the Subscriber or remove the content.`,
    ] },
    { titulo: "11. Subscription and payment", paragrafos: [
      `The subscription is monthly, paid by credit card through Stripe, and **renews automatically** every month, on the same day as the original purchase, until it is canceled. Brennimark does not receive or store the card number.`,
      `The price of each plan is shown on the subscription page at the time of purchase. Price changes are announced at least 30 days in advance and apply from the next renewal. Anyone who does not agree may cancel before that date, at no cost.`,
      `The service invoice (nota fiscal de serviço) is issued in the Subscriber's name, using the details provided at purchase.`,
    ] },
    { titulo: "12. Late payment", paragrafos: [
      `If a charge is not paid, the Account keeps working normally for 7 days, with a notice to whoever administers it.`,
      `After that, the Account becomes read-only: consulting the manual and downloading materials remain possible; using Vini, editing content and creating brands are suspended until payment is regularized. Nothing is deleted because of late payment. Once the overdue amount is paid, everything works again.`,
    ] },
    { titulo: "13. Cancellation and refunds", paragrafos: [
      `The Subscriber may cancel at any time, under Settings → Plan, or by email at ${E.email}. We confirm the cancellation immediately, by email. Full access continues until the end of the period already paid (except in the case of withdrawal, below), and no further charge is made.`,
      `**Right of withdrawal (direito de arrependimento):** anyone who cancels within 7 days of the first purchase receives a full refund of the amount paid, through the same channel used for the purchase. We request the reversal from Stripe immediately, and it appears on the card statement according to the card issuer's timeline. Because the amount is returned in full, full access ends at the moment of cancellation, and the Account becomes read-only, kept like any canceled Account.`,
      `**Improper charges:** a duplicate charge, a charge after cancellation or a charge caused by our fault is refunded in full.`,
      `**Other cases:** outside these situations, there is no prorated refund for the current month; cancellation stops the next charges.`,
      `After cancellation, the Account is kept, read-only, for 12 months, so that the Subscriber may return or export what belongs to it. We give notice 30 days before the end of that period. After that, the content is permanently deleted. The Subscriber may request deletion earlier. Data that the law requires us to keep (such as tax records and access logs) is kept for the legal period.`,
      `The export returns the original files and an index of the content, within 15 days after the request.`,
    ] },
    { titulo: "14. Plan limits", paragrafos: [
      `Each plan has limits on the number of brands, on storage and on Vini usage, shown on the subscription page. Invited Users are unlimited. When a limit is reached, the platform gives notice; what already exists remains accessible.`,
    ] },
    { titulo: "15. Availability", paragrafos: [
      `We work to keep Brennimark always online, but we do not guarantee uninterrupted operation. Scheduled maintenance is announced in advance whenever possible.`,
    ] },
    { titulo: "16. Liability", paragrafos: [
      `Brennimark is liable for the direct damages it causes in providing the service. Between businesses, that liability is limited to the amount paid by the Subscriber in the 12 months preceding the event, and Brennimark is not liable for loss of profits (lucros cessantes), loss of opportunity or indirect damages.`,
      `These limits do not apply to damages caused by willful misconduct (dolo) or gross negligence (culpa grave), nor do they remove rights that the law guarantees to consumers or to data subjects.`,
      `Brennimark is not liable for decisions made on the basis of Vini's answers without review by the Subscriber's team, nor for the content that the Subscriber and the Invited Users upload.`,
    ] },
    { titulo: "17. Changes to these terms", paragrafos: [
      `When these terms change, we will notify whoever administers each Account at least 30 days in advance, explaining what changed. Anyone who does not agree may cancel before the effective date, at no cost, and receives a refund of the proportional amount for the period already paid and not used. Changes required by law may take effect on shorter notice.`,
    ] },
    { titulo: "18. Age and acceptance", paragrafos: [
      `Brennimark is intended for people over 18. Acceptance of these terms is given electronically, at the time of purchase or first access, and we record the version accepted, the date and the time.`,
    ] },
    { titulo: "19. Governing law and venue", paragrafos: [
      `These terms are governed by Brazilian law. The courts of the judicial district (comarca) of Porto Alegre, State of Rio Grande do Sul, are elected as the venue (foro), without prejudice to the consumer's right to bring an action in the courts of their own domicile.`,
    ] },
  ],
};

export const PRIVACY_POLICY: DocumentoLegal = {
  versao: "2026-10-22",
  vigenteDesde: "October 22, 2026",
  secoes: [
    { titulo: "1. Who processes the data", paragrafos: [
      `This policy explains how Brennimark, registered under CNPJ (Brazilian corporate taxpayer number) ${E.cnpj}, processes personal data, in accordance with the Brazilian General Data Protection Law (Lei Geral de Proteção de Dados, Law No. 13,709/2018, "LGPD").`,
      `Brennimark is the **controller** of the registration, login, subscription, payment and security data of everyone who uses the platform, including the Invited Users.`,
      `The **Subscriber** is the controller of the content of the brands and of the activity records within them (who accessed, downloaded or edited what). For that data, Brennimark is the **processor**: it processes the data only to provide the service and follows the Subscriber's instructions, as set out in the section "[[termos#data-processed-on-behalf-of-the-subscriber|Data processed on behalf of the Subscriber]]" of the Terms of Use.`,
    ] },
    { titulo: "2. What data we process", paragrafos: [
      `Registration: name, email and company of whoever subscribes and of whoever is invited.`,
      `Payment: Stripe processes the card; we receive from it only what is needed to maintain the subscription (status, plan, dates and the account holder's email). We do not store the card number.`,
      `Content: uploaded manuals, materials, supplements and other files, and the conversations with Vini.`,
      `Free sign-up for the tools (Kit, Colors and Grids, on the website): name, email, agency and role, the optional answers on the form (such as team, brands, systems and how you found us), the tool the sign-up came from, the date of acceptance and the text you accepted. No account or password is needed.`,
      `Brennimark Fonts beta: name, email and agency given in the access request, the license number, the computer's public code and the activation dates, used only to issue and monitor the license. The app runs on your computer: we do not receive your fonts, font names, file paths or library data.`,
      `Usage records: who accessed each brand, who downloaded each material and the editing actions, so that the Subscriber knows what happened in its Account.`,
      `Technical data: IP address, browser and access times, recorded for security. Application access logs (IP, date and time) are kept for 6 months, confidentially, as required by the Brazilian Civil Rights Framework for the Internet (Marco Civil da Internet, Law No. 12,965/2014, Art. 15).`,
    ] },
    { titulo: "3. What we use it for", paragrafos: [
      `To provide the contracted service (performance of a contract); to send news and content emails to those who signed up for the free tools and confirmed their email (consent); to issue invoices and comply with legal obligations; to keep the platform secure and prevent abuse (legitimate interest); and to improve the product with aggregated and anonymized numbers, without identifying who asked or did what (legitimate interest). Anonymized data ceases to be personal data (LGPD, Art. 12). The access logs required by the Marco Civil are kept to comply with a legal obligation.`,
      `We do not sell personal data and we do not use the content of the brands for advertising.`,
    ] },
    { titulo: "4. Conversations with Vini", paragrafos: [
      `Each conversation belongs to whoever had it: neither the other people on the Account nor whoever administers it can read it. The Brennimark team sees a conversation only if the person sends it to support.`,
      `To answer, Vini sends the artificial intelligence provider the question and the manual excerpts needed. We use only providers and plans that, by contract, do not use this data to train models and do not retain it beyond what is needed to answer.`,
    ] },
    { titulo: "5. Who we share it with", paragrafos: [
      `Only with the suppliers needed for the service to work, each processing the data according to our instructions: Vercel (hosting of the website and the application), Supabase (database and files, on servers in São Paulo), Stripe (payment), the artificial intelligence providers the platform uses at any given time (currently among Anthropic, Google, OpenAI, Groq and OpenRouter) and Resend, the email delivery service used for confirmations and for the free sign-up messages.`,
      `Some of these suppliers process data in the United States and in other countries. These transfers rely on the standard contractual clauses approved by the Brazilian National Data Protection Authority (ANPD) (Resolution CD/ANPD No. 19/2024), incorporated into the contracts with each supplier. You may request the up-to-date list of suppliers, the countries and the full text of the clauses through the privacy channel; we respond within 15 days.`,
      `We also share data when required by law or by a court order.`,
    ] },
    { titulo: "6. Cookies", paragrafos: [
      `We use only necessary cookies: those for the session of whoever signs in to the platform and a temporary purchase cookie, which allows the password to be created upon return from payment. Whoever signs up for the free tools also receives the "bm_cadastro" cookie, which lasts 1 year and only tells the browser that the sign-up has already been done, so that it is not asked for again; it contains no personal data. The theme preference is stored in the browser itself. We do not use advertising or tracking cookies.`,
    ] },
    { titulo: "7. How long we keep it", paragrafos: [
      `While the subscription is active, we keep the data to provide the service.`,
      `After cancellation, the Account is kept, read-only, for 12 months, so that the Subscriber may return or export what belongs to it. We give notice 30 days before the end of that period. After that, the content is permanently deleted. The Subscriber may request deletion earlier.`,
      `Free sign-up: we keep the data until you ask to unsubscribe or to delete it. Whoever unsubscribes stops receiving emails; whoever asks for deletion has the data erased. We send messages only to those who confirmed their email (double opt-in), with at most one confirmation request per day. Access logs are kept for 6 months, as required by the Marco Civil da Internet. Data that the law requires us to keep for longer (such as tax records) is kept for the legal period.`,
    ] },
    { titulo: "8. Security", paragrafos: [
      `Access is controlled by brand: each person sees only the brands made available to them, and this is enforced by the database, not only by the screen. Communication is encrypted, files have no public address, and delivery links have a deadline and can be revoked.`,
      `If there is a security incident that may cause relevant risk or harm, we will notify the ANPD and the affected people, within the legal deadlines.`,
    ] },
    { titulo: "9. Your rights", paragrafos: [
      `You may request, at any time: confirmation that we process your data; access; correction; anonymization, blocking or deletion of unnecessary data or of data processed in violation of the law; portability; deletion of data processed on the basis of your consent; information about the entities with which we share it; information about the possibility of not giving consent and its consequences; and withdrawal of consent. Every email of the free sign-up includes a link to leave the list or delete your data, with no login needed. You may also object to processing carried out on another legal basis, if it violates the law (LGPD, Art. 18).`,
      `Make your request at ${E.emailDePrivacidade}. We respond within 15 days. If the request concerns the content of a brand, we notify you and forward it to the Subscriber, who is the controller of that data.`,
      `You may also lodge a complaint with the Brazilian National Data Protection Authority (ANPD).`,
    ] },
    { titulo: "10. Contact and data protection officer", paragrafos: [
      `As a small-scale processing agent, Brennimark is not required to appoint a data protection officer (encarregado) (Resolution CD/ANPD No. 2/2022). The channel for any question about personal data is ${E.emailDePrivacidade}, handled by the Brennimark team.`,
    ] },
    { titulo: "11. Changes to this policy", paragrafos: [
      `When this policy changes, the new version is published here, with the date. Relevant changes are announced to whoever administers each Account.`,
    ] },
  ],
};
