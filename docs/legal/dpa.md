# Basira Data Processing Agreement (PDPL)

> **DRAFT. Not legal advice and not ready to sign.** Prepared without a lawyer. It must be reviewed by a lawyer licensed in the Kingdom of Saudi Arabia against the Personal Data Protection Law (PDPL), its Implementing Regulations and the Regulations on Personal Data Transfer outside the Kingdom, completed where marked **[to confirm]**, and issued in Arabic.

This Data Processing Agreement ("DPA") forms part of the Basira Terms of Service between the Customer and **[Basira legal entity]** ("Basira").

## 1. Roles

1.1 For personal data in Customer Content, the Customer (or the brand on whose behalf the Customer acts) is the **controller** and Basira is the **processor**. **[to confirm the structure where the agency itself processes for a brand]**

1.2 For account, billing and website-lead data, Basira is the controller; see `privacy.md`.

## 2. What is processed

| | |
| --- | --- |
| Subject matter | Providing the Basira service under the Terms |
| Duration | The term of the agreement plus up to 30 days for export, then deletion |
| Nature and purpose | Hosting, analysing listings and reviews, generating copy and images, preparing exports, publishing to marketplaces on instruction, measuring results |
| Categories of data subjects | Buyers who wrote reviews; the Customer's staff and its clients' contacts; models appearing in product photos |
| Categories of personal data | Names or handles and text in reviews; names and contact details of users; faces in photos. Basira does not ask for and is not designed for sensitive data, payment card data or national ID numbers |

Most Customer Content (product data, brand rules, sales figures per product) is business data and not personal data.

## 3. Basira's obligations

Basira will:

1. Process personal data only on the Customer's documented instructions, which are these Terms, this DPA and the Customer's use of the product.
2. Keep each client workspace's data separate and use it only for that client. Data is not used to train or improve shared models unless the Customer turns on consent for that client in Settings.
3. Ensure people who process the data are bound by confidentiality.
4. Apply appropriate technical and organisational security measures (section 6).
5. Help the Customer answer data subject requests: the product lets the Customer download everything stored for a client and delete a client with all its data.
6. Notify the Customer without undue delay, and in any case within **[24 hours, to confirm]**, after becoming aware of a personal data breach affecting Customer data, with the information needed for the Customer to notify the Saudi Data & AI Authority (SDAIA) and data subjects within the deadlines that apply **[to confirm: 72 hours to SDAIA]**.
7. Delete or return personal data at the end of the service (Terms, section 11.3).
8. Make available the information needed to show compliance with this DPA.

## 4. Sub-processors

The Customer authorises these sub-processors. Basira will give 30 days' notice of changes, and the Customer may object on reasonable data protection grounds.

| Sub-processor | Purpose | Location | Transfer basis |
| --- | --- | --- | --- |
| Anthropic PBC (Claude API) | Review analysis, copy drafts, brand analysis, photo review | United States | **[to confirm]** |
| [Hosting provider, e.g. Render / a Saudi cloud region] | Hosting the server, files and backups | **[to confirm]** | **[to confirm]** |
| Moyasar | Payment of invoices (no card data reaches Basira) | Saudi Arabia | Not a transfer |
| [Image model provider] | On-model photos (only if the Customer uses the feature) | **[to confirm]** | **[to confirm]** |
| Amazon (Selling Partner API) | Reading and updating listings in the Customer's own seller account, on the Customer's instruction | **[to confirm]** | Customer's own account and instruction |

## 5. Transfers outside the Kingdom

Some sub-processors process data outside Saudi Arabia. Basira will transfer personal data outside the Kingdom only in line with the PDPL and the Regulations on Personal Data Transfer outside the Kingdom **[to confirm the basis: adequacy, appropriate safeguards such as standard contractual clauses, or an exception]**. Customers who need data to stay in the Kingdom can ask for hosting in a Saudi region and for AI features that send data abroad to be switched off **[to confirm availability]**.

## 6. Security measures

- HTTPS for all traffic; outbound requests to the internet are HTTPS only and blocked from private networks.
- Each client's data is stored in a separate folder; exported images are served only under long random links.
- Plan changes only follow a paid invoice that the server itself created.
- Secrets (API keys) are kept in the hosting environment, not in code.
- **Missing today, required before a public launch:** user accounts with authentication and roles, access logs, encrypted backups with a restore test, and an incident response procedure.

## 7. Data subject requests

Basira will pass to the Customer any request it receives from a data subject about Customer data and will not answer it directly unless the Customer asks. The Customer can download or delete a client's data in Settings.

## 8. Liability

Liability under this DPA follows the limits in the Terms, except where the law does not allow limitation.

## 9. Precedence

If this DPA conflicts with the Terms on data protection, this DPA prevails.
