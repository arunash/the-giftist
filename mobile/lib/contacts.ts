import * as Contacts from 'expo-contacts'

export interface NormalizedContact {
  name: string
  phone: string // normalized, digits only
  originalPhone: string
}

export async function requestContactsAccess(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync()
  return status === 'granted'
}

export async function getPhoneContacts(): Promise<NormalizedContact[]> {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  })

  const contacts: NormalizedContact[] = []

  for (const contact of data) {
    if (!contact.phoneNumbers?.length) continue
    const name = contact.name || 'Unknown'

    for (const phone of contact.phoneNumbers) {
      if (!phone.number) continue
      const normalized = normalizePhoneNumber(phone.number)
      if (normalized.length >= 10) {
        contacts.push({
          name,
          phone: normalized,
          originalPhone: phone.number,
        })
      }
    }
  }

  // Deduplicate by normalized phone
  const seen = new Set<string>()
  return contacts.filter((c) => {
    if (seen.has(c.phone)) return false
    seen.add(c.phone)
    return true
  })
}

function normalizePhoneNumber(phone: string): string {
  // Strip all non-digits
  let digits = phone.replace(/\D/g, '')

  // Handle US numbers
  if (digits.length === 10) {
    digits = '1' + digits
  }
  // Strip leading 0 or + formatting artifacts
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1)
  }

  return digits
}
