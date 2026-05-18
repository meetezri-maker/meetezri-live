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

    const passwordResetEmail = emailService.buildPasswordResetEmail({ resetLink });

    await emailService.sendEmail(
      email,
      passwordResetEmail.subject,
      passwordResetEmail.html,
      passwordResetEmail.text
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
