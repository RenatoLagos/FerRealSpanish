import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Configuración de Resend
const resend = new Resend(import.meta.env.RESEND_API_KEY);
const TEACHER_EMAIL = 'ferrealspanish@gmail.com'; // Email del profesor para recibir consultas

// Clave secreta de reCAPTCHA desde variables de entorno
const RECAPTCHA_SECRET_KEY = import.meta.env.RECAPTCHA_SECRET_KEY || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"; // Fallback a clave de prueba

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  'g-recaptcha-response'?: string;
}

// Función para validar reCAPTCHA
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

// Template del correo de contacto
function createContactEmailHTML(data: ContactFormData) {
  const { firstName, lastName, email, message } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Form Submission - FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7dd3c0, #6bc4b1); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .highlight-box { background: #f0f9ff; border-left: 4px solid #7dd3c0; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .contact-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .message-box { background: #fefefe; border: 2px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .emoji { font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Nueva Consulta</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Contact Form Submission</p>
        </div>
        
        <div class="content">
            <p>Has recibido una nueva consulta a través del formulario de contacto de tu sitio web.</p>
            
            <div class="highlight-box">
                <h3 style="color: #2563eb; margin-top: 0;">👤 Información del Contacto</h3>
                <div class="contact-details">
                    <p><span class="emoji">👤</span> <strong>Nombre:</strong> ${firstName} ${lastName}</p>
                    <p><span class="emoji">📧</span> <strong>Email:</strong> <a href="mailto:${email}" style="color: #7dd3c0;">${email}</a></p>
                    <p><span class="emoji">📅</span> <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                </div>
            </div>
            
            <div class="highlight-box">
                <h3 style="color: #059669; margin-top: 0;">💬 Mensaje</h3>
                <div class="message-box">
                    <p style="white-space: pre-wrap; margin: 0;">${message}</p>
                </div>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px;">
                <h4 style="color: #92400e; margin-top: 0;">📋 Próximos Pasos</h4>
                <p style="margin-bottom: 0; color: #92400e;">
                    • Responde a este email directamente para contactar al usuario<br>
                    • Considera programar una llamada si es apropiado<br>
                    • Guarda esta información para tu seguimiento
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
            <p>This email was automatically generated from your contact form.</p>
        </div>
    </div>
</body>
</html>
`;
}

// Template de confirmación para el usuario
function createConfirmationEmailHTML(data: ContactFormData) {
  const { firstName } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thanks for contacting us - FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7dd3c0, #6bc4b1); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .highlight-box { background: #f0f9ff; border-left: 4px solid #7dd3c0; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .emoji { font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank you! 🙏</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">We received your message</p>
        </div>
        
        <div class="content">
            <p>Hello <strong>${firstName}</strong>!</p>
            
            <p>Thank you for contacting us. We have received your message and will get back to you very soon.</p>
            
            <div class="highlight-box">
                <h3 style="color: #2563eb; margin-top: 0;">📧 What's next?</h3>
                <p>• We'll review your message carefully</p>
                <p>• We'll respond within the next 24 hours</p>
                <p>• If you have urgent questions, you can schedule a free class directly</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 16px; margin-bottom: 25px;">Can't wait? Schedule your free class now:</p>
                <a href="https://ferrealspanish.com/schedule-class" 
                   style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white !important; padding: 18px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    📅 Schedule Free Class
                </a>
            </div>
            
            <p>See you soon!<br>
            <strong>FerRealSpanish Team</strong> 🇪🇸</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
            <p>This is an automated confirmation email.</p>
        </div>
    </div>
</body>
</html>
`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData: ContactFormData = await request.json();
    console.log('Received contact form data:', formData);
    
    // Validar reCAPTCHA primero
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
    
    // Validar datos requeridos
    const { firstName, lastName, email, message } = formData;
    
    if (!firstName || !lastName || !email || !message) {
      return new Response(JSON.stringify({ 
        error: 'All fields are required',
        message: 'Please complete all form fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email',
        message: 'Please enter a valid email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si Resend está configurado
    if (!import.meta.env.RESEND_API_KEY) {
      console.log('⚠️ Resend not configured, simulating email send');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Message sent successfully (demo mode)',
        isDemo: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      console.log(`📧 Enviando emails para la consulta de ${firstName} ${lastName}`);
      
      // Enviar email al profesor
      console.log(`📤 Enviando email al profesor: ${TEACHER_EMAIL}`);
      const teacherEmailResult = await resend.emails.send({
        from: 'FerRealSpanish Contact <noreply@ferrealspanish.com>',
        to: [TEACHER_EMAIL],
        replyTo: email,
        subject: `Nueva consulta de ${firstName} ${lastName}`,
        html: createContactEmailHTML(formData),
      });

      console.log('✅ Teacher email sent:', teacherEmailResult);

      // Enviar email de confirmación al usuario
      console.log(`📤 Enviando email de confirmación al usuario: ${email}`);
      const confirmationEmailResult = await resend.emails.send({
        from: 'FerRealSpanish <noreply@ferrealspanish.com>',
        to: [email],
        subject: 'Thanks for contacting us - FerRealSpanish',
        html: createConfirmationEmailHTML(formData),
      });

      console.log('✅ Confirmation email sent:', confirmationEmailResult);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Message sent successfully. We will respond to you soon.',
        teacherEmailId: teacherEmailResult.data?.id,
        confirmationEmailId: confirmationEmailResult.data?.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      
      return new Response(JSON.stringify({ 
        error: 'Error sending emails',
        message: 'There was a problem sending your message. Please try again.',
        details: emailError instanceof Error ? emailError.message : 'Unknown email error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Contact form error:', error);
    
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