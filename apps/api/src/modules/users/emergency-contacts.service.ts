import prisma from '../../lib/prisma';
import { CreateEmergencyContactInput, UpdateEmergencyContactInput } from './emergency-contacts.schema';

export async function getEmergencyContacts(userId: string) {
  const contacts = await prisma.emergency_contacts.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });

  // Lazy migration: If no contacts in new table, check legacy profile fields
  if (contacts.length === 0) {
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_contact_relationship: true,
      }
    });

    if (profile?.emergency_contact_name) {
      const newContact = await prisma.emergency_contacts.create({
        data: {
          name: profile.emergency_contact_name,
          phone: profile.emergency_contact_phone,
          relationship: profile.emergency_contact_relationship,
          is_trusted: true, // Assume legacy contact is trusted
          profiles: {
            connect: { id: userId },
          },
        }
      });
      return [newContact];
    }
  }

  return contacts;
}

export async function createEmergencyContact(userId: string, data: CreateEmergencyContactInput) {
  // Fix email if empty string to null or leave it as is if DB allows.
  // Prisma schema says email String? so it can be null. 
  // Zod schema allows empty string or email.
  
  return prisma.emergency_contacts.create({
    data: {
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
      is_trusted: data.is_trusted,
      email: data.email === '' ? null : data.email,
      profiles: {
        connect: { id: userId },
      },
    },
  });
}

export async function updateEmergencyContact(userId: string, contactId: string, data: UpdateEmergencyContactInput) {
  // Ensure the contact belongs to the user
  const contact = await prisma.emergency_contacts.findFirst({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw new Error('Contact not found or access denied');
  }

  return prisma.emergency_contacts.update({
    where: { id: contactId },
    data: {
      ...data,
      email: data.email === '' ? null : data.email,
    },
  });
}

export async function deleteEmergencyContact(userId: string, contactId: string) {
  const contact = await prisma.emergency_contacts.findFirst({
    where: { id: contactId, user_id: userId },
  });

  if (!contact) {
    throw new Error('Contact not found or access denied');
  }

  return prisma.emergency_contacts.delete({
    where: { id: contactId },
  });
}
