import type { APIRoute } from 'astro';
import { saveWaitlist } from '../../lib/django';

// reCAPTCHA secret key from environment variables
const RECAPTCHA_SECRET_KEY = import.meta.env.RECAPTCHA_SECRET_KEY || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

interface WaitlistFormData {
  name: string;
  email: string;
  spanishLevel: string;
  message?: string;
  'g-recaptcha-response'?: string;
}

// Validate reCAPTCHA
async function validateRecaptcha(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('reCAPTCHA validation error:', error);
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData: WaitlistFormData = await request.json();
    console.log('Received waitlist form data:', formData);

    // Validate reCAPTCHA
    const recaptchaToken = formData['g-recaptcha-response'];
    if (!recaptchaToken) {
      return new Response(JSON.stringify({
        error: 'reCAPTCHA required',
        message: 'Please complete the reCAPTCHA verification'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValidRecaptcha = await validateRecaptcha(recaptchaToken);
    if (!isValidRecaptcha) {
      return new Response(JSON.stringify({
        error: 'reCAPTCHA verification failed',
        message: 'reCAPTCHA verification failed. Please try again.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate required fields
    const { name, email, spanishLevel } = formData;

    if (!name || !email || !spanishLevel) {
      return new Response(JSON.stringify({
        error: 'Required fields missing',
        message: 'Please complete all required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        error: 'Invalid email',
        message: 'Please enter a valid email address'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save to Django database
    await saveWaitlist({
      name,
      email,
      spanishLevel,
      message: formData.message
    });

    return new Response(JSON.stringify({
      success: true,
      message: "You've been added to the waitlist!"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Waitlist form error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'There was a problem processing your request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
