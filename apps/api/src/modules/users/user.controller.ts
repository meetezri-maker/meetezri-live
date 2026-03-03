import { FastifyReply, FastifyRequest } from 'fastify';
import { onboardingSchema, updateProfileSchema, checkUserSchema, CheckUserInput } from './user.schema';
import * as userService from './user.service';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function checkUserExistsHandler(
  request: FastifyRequest<{ Body: CheckUserInput }>,
  reply: FastifyReply
) {
  const { email, full_name } = request.body;
  const result = await userService.checkUserExists(email, full_name);
  return result;
}

export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const users = await userService.getAllUsers(page, limit);
    return users;
  } catch (error) {
    request.log.error({ error }, 'Failed to fetch all users');
    return reply.code(500).send({ message: 'Failed to fetch users' });
  }
}

export async function getUserProfileAdminHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const profile = await userService.getProfile(userId);

  if (!profile) {
    return reply.code(404).send({ message: 'Profile not found' });
  }

  return profile;
}

export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const profile = await userService.getProfile(user.sub);

  if (!profile) {
    return reply.code(404).send({ message: 'Profile not found' });
  }

  return profile;
}

export async function initProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Initializing profile for user');
  
  const existingProfile = await userService.getProfile(user.sub);
  if (existingProfile) {
    return existingProfile;
  }

  let email = user.email;

  // If email is missing in JWT, try to fetch from auth.users via prisma
  if (!email) {
    try {
      // Accessing prisma via the userService's imported prisma instance if possible, 
      // or we can add a helper in userService to get user email.
      // For now, let's assume we can rely on the service to handle "missing email" logic 
      // or we modify the service.
      // Better approach: Let's assume the email MIGHT be in the user object but just in case
      // we can try to fetch the user record.
      // Since I don't have direct access to prisma here (it's in service), 
      // I'll add a method to userService to get email by ID.
      
      // Actually, let's just handle it in the controller by checking if we can get it.
      // But wait, I need to import prisma to query it.
      // Instead, I'll pass undefined to createProfile and let it handle or fail.
      // But createProfile needs email.
      
      // Let's modify the controller to just fail if email is missing for now, 
      // but log it clearly. 
      // If the user says "Profile not found", it means they hit 404 on getMe.
      // Then they hit initProfile.
      
      // If user.email is undefined, we return 400.
      // The user is seeing "Profile not found" which is the 404 from getMe.
      // This means initProfile MIGHT NOT EVEN BE CALLED or failing silently in frontend?
      // No, the user provided the log:
      // {"message":"Profile not found"} http://localhost:3001/api/users/me
      
      // This means the browser is showing the response from the FAILED request.
      // It DOES NOT mean initProfile wasn't called.
      // It means the user is looking at the failed request response.
      
      // If initProfile WAS called, it should have succeeded or failed.
      // If it succeeded, the app should have proceeded.
      
      // Hypothesis: initProfile is failing with 400 because email is missing.
      // So let's try to get the email from the DB if it's missing.
      
      // I will add a `getUserEmail` to userService and use it here.
    } catch (e) {
      // ignore
    }
  }

  if (!email) {
    // Attempt to fetch email from DB as a fallback
    const userEmail = await userService.getUserEmail(user.sub);
    if (userEmail) {
      email = userEmail;
    }
  }

  if (!email) {
    request.log.error({ user }, 'User email is required to initialize profile but was not found');
    return reply.code(400).send({ message: 'User email is required to initialize profile' });
  }

  try {
    const profile = await userService.createProfile(user.sub, email);
    request.log.info({ profile }, 'Profile initialized successfully');
    return profile;
  } catch (error) {
    request.log.error({ error }, 'Failed to initialize profile');
    return reply.code(500).send({ message: 'Failed to initialize profile' });
  }
}

export async function getCreditsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const credits = await userService.getCredits(user.sub);
  return credits;
}

export async function updateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user, body: request.body }, 'Processing update profile request');
  
  const result = updateProfileSchema.safeParse(request.body);
  if (!result.success) {
    request.log.warn({ error: result.error }, 'Update profile validation failed');
    return reply.code(400).send(result.error);
  }

  const updatedProfile = await userService.updateProfile(user.sub, result.data);
  request.log.info({ updatedProfile }, 'Profile updated successfully');
  return updatedProfile;
}

export async function completeOnboardingHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user, body: request.body }, 'Processing complete onboarding request');

  const result = onboardingSchema.safeParse(request.body);
  if (!result.success) {
    request.log.warn({ error: result.error }, 'Onboarding validation failed');
    return reply.code(400).send(result.error);
  }

  try {
    const profile = await userService.completeOnboarding(user.sub, result.data);
    return profile;
  } catch (error) {
    request.log.error({ error }, 'Onboarding completion failed');
    throw error;
  }
}

export async function deleteUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Processing delete user request');

  try {
    await userService.deleteUser(user.sub);
    return reply.code(200).send({ message: 'User account deleted successfully' });
  } catch (error) {
    request.log.error({ error }, 'Delete user failed');
    return reply.code(500).send({ message: 'Failed to delete user account' });
  }
}

export async function exportUserDataHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Processing user data export request');

  try {
    const userData = await userService.exportUserData(user.sub);
    reply.header('Content-Disposition', `attachment; filename="meetezri-data-export-${new Date().toISOString()}.json"`);
    return reply.send(userData);
  } catch (error) {
    request.log.error({ error }, 'User data export failed');
    return reply.code(500).send({ message: 'Failed to export user data' });
  }
}
