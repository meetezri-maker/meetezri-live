import { FastifyReply, FastifyRequest } from 'fastify';
import { onboardingSchema, updateProfileSchema, checkUserSchema, CheckUserInput, SignupInput, signupSchema } from './user.schema';
import * as userService from './user.service';
import * as billingService from '../billing/billing.service';
import { supabaseAdmin } from '../../config/supabase';
import { emailService } from '../email/email.service';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function checkUserExistsHandler(
  request: FastifyRequest<{ Body: CheckUserInput }>,
  reply: FastifyReply
) {
  const { email } = request.body;
  const result = await userService.checkUserExists(email);
  return result;
}

export async function signupHandler(
  request: FastifyRequest<{ Body: SignupInput }>,
  reply: FastifyReply
) {
  const { email, password, firstName, lastName } = request.body;

  // Double check if user exists
  const existingUser = await userService.checkUserExists(email);
  if (existingUser.exists) {
    return reply.code(400).send({ message: 'User already exists' });
  }

  try {
    // 1. Create user in Supabase Auth (unconfirmed)
    // We disable email confirmation here so Supabase doesn't send the default email
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (createError) throw createError;
    if (!user.user) throw new Error('Failed to create user');

    // Link subscription if paid flow
    if (request.body.stripe_session_id) {
      try {
        await billingService.linkSubscriptionToUser(user.user.id, request.body.stripe_session_id);
      } catch (error) {
        request.log.error({ error }, 'Failed to link subscription to new user');
      }
    }

    // Determine base URL from request origin or fallback
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    
    // Log headers to debug environment issues
    request.log.info({ origin, referer, appUrlEnv: process.env.APP_URL }, 'Determining redirect base URL');

    let appUrl = process.env.APP_URL || 'http://localhost:5173';
    
    // Prefer Origin or Referer if they match localhost (dev environment)
    if (origin && origin.includes('localhost')) {
      appUrl = origin;
    } else if (referer && referer.includes('localhost')) {
      // Extract base URL from referer (e.g. http://localhost:5173/signup -> http://localhost:5173)
      try {
        const url = new URL(referer);
        appUrl = url.origin;
      } catch (e) {}
    }

    const redirectParam = encodeURIComponent('/onboarding/welcome');
    const finalRedirectTo = `${appUrl}/auth/callback?redirect=${redirectParam}`;
    
    request.log.info({ finalRedirectTo }, 'Generated verification link redirect URL');

    // 2. Generate verification link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: finalRedirectTo
      }
    });

    if (linkError) throw linkError;
    const verificationLink = linkData.properties?.action_link;

    if (!verificationLink) throw new Error('Failed to generate verification link');

    // 3. Send custom email with target="_blank"
    await emailService.sendEmail(
      email,
      'Confirm your email - MeetEzri',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to MeetEzri!</h2>
        <p>Hi ${firstName},</p>
        <p>Please confirm your email address to get started.</p>
        <p>Click the button below to verify your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" target="_blank" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirm Email</a>
        </div>
        <p>If you didn't sign up for MeetEzri, you can ignore this email.</p>
      </div>
      `,
      `Confirm your email by visiting: ${verificationLink}`
    );

    return reply.code(201).send({ success: true, message: 'User created successfully. Please check your email to verify your account.' });

  } catch (error: any) {
    request.log.error({ error }, 'Signup failed');
    return reply.code(500).send({ message: error.message || 'Signup failed' });
  }
}

export async function resendVerificationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload & { email?: string };
  const userId = user.sub;
  const email = user.email || await userService.getUserEmail(userId);

  if (!email) {
    return reply.code(400).send({ message: 'Email not found' });
  }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (linkError) throw linkError;
    const verificationLink = linkData.properties?.action_link;
    if (!verificationLink) throw new Error('Failed to generate verification link');

    await emailService.sendEmail(
      email,
      'Verify your email - MeetEzri',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Hi,</p>
        <p>Please verify your email address to secure your MeetEzri free trial account.</p>
        <p>Click the button below to verify:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" target="_blank" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify my email</a>
        </div>
        <p>If you didn't sign up for MeetEzri, you can ignore this email.</p>
      </div>
      `,
      `Verify your email by visiting: ${verificationLink}`
    );

    return reply.code(200).send({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    request.log.error({ error }, 'Resend verification failed');
    return reply.code(500).send({ message: error.message || 'Failed to send verification email' });
  }
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
