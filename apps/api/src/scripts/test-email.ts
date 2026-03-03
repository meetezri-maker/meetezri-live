import dotenv from 'dotenv';
import { EmailService } from '../modules/email/email.service';

dotenv.config();

async function main() {
  const emailService = new EmailService();
  const to = process.argv[2];

  if (!to) {
    console.error('Please provide an email address as an argument.');
    console.log('Usage: npx ts-node src/scripts/test-email.ts <email>');
    process.exit(1);
  }

  console.log(`Sending test email to ${to}...`);
  try {
    await emailService.sendEmail(
      to,
      'Test Email from MeetEzri',
      '<h1>Success!</h1><p>This is a test email from the MeetEzri backend.</p>'
    );
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

main();
