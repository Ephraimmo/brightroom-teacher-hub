/**
 * Public details shown on the landing page.
 *
 * CONTACT is switched off (null) until the real details are confirmed. While it
 * is null, the landing page hides its contact section and "Register your school"
 * goes to create-account instead, so no button points nowhere.
 *
 * To switch it on, fill in at least an email or phone, e.g.:
 *   export const CONTACT: SiteContact | null = {
 *     email: "hello@example.co.za",
 *     phone: "082 123 4567",
 *     whatsapp: "27821234567", // international format, digits only
 *     location: "Durban, KwaZulu-Natal",
 *   };
 */
export interface SiteContact {
  email?: string;
  phone?: string;
  /** WhatsApp number in international format, digits only (e.g. 27821234567). */
  whatsapp?: string;
  location?: string;
}

export const CONTACT: SiteContact | null = null;

/** True when there is at least one way to get in touch. */
export function hasContact(contact: SiteContact | null): contact is SiteContact {
  return Boolean(contact && (contact.email || contact.phone || contact.whatsapp));
}
