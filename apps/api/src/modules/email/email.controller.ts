import { FastifyReply, FastifyRequest } from 'fastify';
import { emailService } from './email.service';
import { sendEmailSchema, SendEmailInput, resetPasswordSchema, ResetPasswordInput } from './email.schema';
import { supabaseAdmin } from '../../config/supabase';

export async function sendEmailHandler(
  request: FastifyRequest<{ Body: SendEmailInput }>,
  reply: FastifyReply
) {
  try {
    // Manual validation
    const body = sendEmailSchema.parse(request.body);
    const { to, subject, html, text } = body;

    const info = await emailService.sendEmail(to, subject, html, text);
    return reply.code(200).send({ success: true, messageId: info.messageId });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return reply.code(400).send({ 
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.errors 
      });
    }
    
    request.log.error({ error }, 'Failed to send email');
    return reply.code(500).send({ message: 'Failed to send email', error: error.message });
  }
}

export async function resetPasswordHandler(
  request: FastifyRequest<{ Body: ResetPasswordInput }>,
  reply: FastifyReply
) {
  try {
    const { email, redirectTo } = resetPasswordSchema.parse(request.body);

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectTo || process.env.APP_URL || 'http://localhost:5173/reset-password',
      }
    });

    if (error) {
      throw error;
    }

    const resetLink = data.properties?.action_link;
    if (!resetLink) {
      throw new Error('Failed to generate reset link');
    }

    // Send email with the link
    await emailService.sendEmail(
      email,
      'Reset Your Password - MeetEzri',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password for your MeetEzri account.</p>
        <p>Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" target="_blank" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">Wait, this link will expire in 1 hour.</p>
      </div>
      `,
      `Reset your password by visiting this link: ${resetLink}`
    );

    return reply.code(200).send({ success: true, message: 'Password reset email sent' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return reply.code(400).send({ 
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.errors 
      });
    }

    request.log.error({ error }, 'Failed to process password reset');
    // Return generic error for security to avoid enumeration, but log the real one
    return reply.code(500).send({ message: 'Failed to process request', error: error.message });
  }
}
