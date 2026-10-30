import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';

// Load .env
dotenv.config();

function generateDevTokenCLI() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    console.error('ERROR: Development tokens cannot be generated in production mode.');
    process.exit(1);
  }

  const secret =
    process.env.DEV_AUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    'local-studysync-dev-jwt-secret-do-not-use-in-prod-32c';

  // Parse arguments if provided
  const args = process.argv.slice(2);
  const userId = args[0] || '00000000-0000-4000-8000-000000000001';
  const email = args[1] || 'dev_user@studysync.local';
  const username = args[2] || 'dev_user';

  const token = jwt.sign(
    {
      sub: userId,
      email,
      user_metadata: {
        username,
        full_name: 'StudySync Developer',
      },
    },
    secret,
    {
      expiresIn: '7d',
      algorithm: 'HS256',
    },
  );

  console.log('================================================================');
  console.log(' StudySync Local Development Token');
  console.log('================================================================');
  console.log(`User ID   : ${userId}`);
  console.log(`Email     : ${email}`);
  console.log(`Username  : ${username}`);
  console.log(`Expires In: 7 days`);
  console.log('----------------------------------------------------------------');
  console.log('Bearer Token:');
  console.log(token);
  console.log('----------------------------------------------------------------');
  console.log('Usage Instructions:');
  console.log('1. Swagger UI (http://localhost:3000/api/docs):');
  console.log('   - Click the green "Authorize" button at the top right.');
  console.log('   - Paste the token above into the "Value" box and click "Authorize".');
  console.log('   - Execute any protected endpoint (e.g. GET /api/v1/timer-modes).');
  console.log('');
  console.log('2. curl / HTTP client:');
  console.log(`   curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/v1/timer-modes`);
  console.log('================================================================');
}

generateDevTokenCLI();
