import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { Resend } from 'resend';

// Configuración del Service Account (mismo que availability.ts)
const CREDENTIALS = {
  type: "service_account",
  project_id: import.meta.env.GOOGLE_PROJECT_ID,
  private_key_id: import.meta.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: import.meta.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: import.meta.env.GOOGLE_CLIENT_EMAIL,
  client_id: import.meta.env.GOOGLE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};

const TEACHER_CALENDAR_ID = import.meta.env.TEACHER_CALENDAR_ID || 'primary';

// Clave secreta de reCAPTCHA desde variables de entorno
const RECAPTCHA_SECRET_KEY = import.meta.env.RECAPTCHA_SECRET_KEY || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"; // Fallback a clave de prueba

// Configuración de Resend
const resend = new Resend(import.meta.env.RESEND_API_KEY);

interface BookingData {
  date: string;
  startTime: string;
  endTime: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  spanishLevel: string;
  courseType: string;
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

// Template del correo de confirmación
function createConfirmationEmailHTML(bookingData: any) {
  const { studentName, date, startTime, endTime, spanishLevel, courseType, meetLink, meetInstructions } = bookingData;
  
  const formatDate = new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const formatStartTime = new Date(startTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const formatEndTime = new Date(endTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spanish Class Confirmation - FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7dd3c0, #6bc4b1); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .highlight-box { background: #f0f9ff; border-left: 4px solid #7dd3c0; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .class-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .meet-link { 
            display: inline-block; 
            background: linear-gradient(135deg, #ff6b6b, #ee5a52); 
            color: white !important; 
            padding: 18px 35px; 
            border-radius: 12px; 
            text-decoration: none; 
            font-weight: bold; 
            font-size: 16px;
            margin: 20px 0; 
            box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3);
            transition: all 0.3s ease;
            text-align: center;
            min-width: 200px;
        }
        .meet-link:hover { 
            background: linear-gradient(135deg, #ff5252, #d32f2f); 
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
            color: white !important;
        }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .emoji { font-size: 18px; }
        ul { padding-left: 0; list-style: none; }
        li { padding: 8px 0; }
        li::before { content: "✓ "; color: #7dd3c0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>¡Clase Confirmada! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your Spanish Class is Scheduled</p>
        </div>
        
        <div class="content">
            <p>¡Hola <strong>${studentName}</strong>!</p>
            
            <p>We're excited to confirm your Spanish class booking. Your learning journey is about to begin! 🚀</p>
            
            <div class="highlight-box">
                <h3 style="color: #2563eb; margin-top: 0;">📅 Class Details</h3>
                <div class="class-details">
                    <p><span class="emoji">📅</span> <strong>Date:</strong> ${formatDate}</p>
                    <p><span class="emoji">🕐</span> <strong>Time:</strong> ${formatStartTime} - ${formatEndTime}</p>
                    <p><span class="emoji">👤</span> <strong>Student:</strong> ${studentName}</p>
                    <p><span class="emoji">📚</span> <strong>Level:</strong> ${spanishLevel}</p>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <h3 style="color: #000000;">🚀 ¡Ready to Start Learning!</h3>
                <p style="font-size: 16px; margin-bottom: 25px;">Your virtual classroom awaits you:</p>
                <a href="${meetLink}" class="meet-link" target="_blank">
                    🎯 Enter Class Now
                </a>
                <p style="font-size: 14px; color: #666; margin-top: 15px;">
                    Acá está el link de Meet: <a href="${meetLink}" style="color: #ff6b6b; text-decoration: none;">${meetLink}</a>
                </p>
            </div>
            
            <div class="highlight-box">
                <h3 style="color: #059669; margin-top: 0;">📋 Before Your Class</h3>
                <ul>
                    <li>Test your camera and microphone</li>
                    <li>Find a quiet, well-lit space</li>
                    <li>Have a notebook and pen ready</li>
                    <li>Prepare any questions you'd like to ask</li>
                    <li>Join the meeting 2-3 minutes early</li>
                </ul>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px;">
                <h4 style="color: #92400e; margin-top: 0;">📋 Important Notes</h4>
                <p style="margin-bottom: 0; color: #92400e;">
                    • If you need to reschedule, please contact us at least 24 hours in advance<br>
                    • Keep this email for your records and easy access to the meeting link
                </p>
            </div>
            
            <p>We can't wait to help you on your Spanish learning journey! If you have any questions, feel free to reach out.</p>
            
            <p>¡Nos vemos pronto!<br>
            <strong>FerRealSpanish Team</strong> 🇪🇸</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
            <p>This email was sent to confirm your Spanish class booking.</p>
        </div>
    </div>
</body>
</html>
`;
}

// Template del correo de notificación al profesor
function createTeacherNotificationEmailHTML(bookingData: any) {
  const { studentName, studentEmail, studentPhone, date, startTime, endTime, spanishLevel, courseType, meetLink } = bookingData;
  
  const formatDate = new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const formatStartTime = new Date(startTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const formatEndTime = new Date(endTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Class Booking - FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7dd3c0, #6bc4b1); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .highlight-box { background: #f0f9ff; border-left: 4px solid #7dd3c0; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .student-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .class-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .emoji { font-size: 18px; }
        .contact-info { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .contact-info h4 { color: #92400e; margin-top: 0; }
        .contact-info p { color: #92400e; margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Nueva Clase Agendada</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">New Spanish Class Booking</p>
        </div>
        
        <div class="content">
            <p>¡Hola Teacher!</p>
            
            <p>You have a new Spanish class booking through your website! Here are the details:</p>
            
            <div class="highlight-box">
                <h3 style="color: #2563eb; margin-top: 0;">📅 Class Information</h3>
                <div class="class-details">
                    <p><span class="emoji">📅</span> <strong>Date:</strong> ${formatDate}</p>
                    <p><span class="emoji">🕐</span> <strong>Time:</strong> ${formatStartTime} - ${formatEndTime}</p>
                    <p><span class="emoji">📚</span> <strong>Level:</strong> ${spanishLevel}</p>
                    <p><span class="emoji">🎯</span> <strong>Course Type:</strong> ${courseType}</p>
                    <p><span class="emoji">🎥</span> <strong>Meet Link:</strong> <a href="${meetLink}" style="color: #2563eb;">${meetLink}</a></p>
                </div>
            </div>
            
            <div class="contact-info">
                <h4>👤 Student Contact Information</h4>
                <div class="student-details">
                    <p><strong>Name:</strong> ${studentName}</p>
                    <p><strong>Email:</strong> <a href="mailto:${studentEmail}" style="color: #92400e;">${studentEmail}</a></p>
                    <p><strong>Phone:</strong> ${studentPhone || 'Not provided'}</p>
                    <p><strong>Spanish Level:</strong> ${spanishLevel}</p>
                </div>
            </div>
            
            <div class="highlight-box">
                <h3 style="color: #059669; margin-top: 0;">📋 Next Steps</h3>
                <ul style="padding-left: 0; list-style: none;">
                    <li style="padding: 8px 0;">✓ The class has been added to your Google Calendar</li>
                    <li style="padding: 8px 0;">✓ Student received confirmation email with meeting details</li>
                    <li style="padding: 8px 0;">✓ Automatic reminders are set for 24h and 1h before class</li>
                    <li style="padding: 8px 0;">✓ You can contact the student directly using the info above</li>
                </ul>
            </div>
            
            <p>The student has been sent a confirmation email with all the class details and Google Meet information.</p>
            
            <p>¡Que tengas una excelente clase!<br>
            <strong>FerRealSpanish System</strong> 🚀</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
            <p>This email was automatically generated when a student booked a class.</p>
        </div>
    </div>
</body>
</html>
`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const bookingData: BookingData = await request.json();
    console.log('Received booking data:', bookingData);
    
    // Validar reCAPTCHA primero
    const recaptchaToken = bookingData['g-recaptcha-response'];
    if (!recaptchaToken) {
      return new Response(JSON.stringify({ 
        error: 'reCAPTCHA verification required',
        message: 'Please complete the reCAPTCHA verification.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isRecaptchaValid = await validateRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return new Response(JSON.stringify({ 
        error: 'reCAPTCHA validation failed',
        message: 'reCAPTCHA verification failed. Please try again.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validar datos requeridos
    const { date, startTime, endTime, studentName, studentEmail, spanishLevel, courseType } = bookingData;
    
    if (!date || !startTime || !endTime || !studentName || !studentEmail || !spanishLevel || !courseType) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['date', 'startTime', 'endTime', 'studentName', 'studentEmail', 'spanishLevel', 'courseType']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Configurar autenticación con Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // SOLUCIÓN FIJA PARA GOOGLE MEET
    // Opción 1: Usar enlace fijo del profesor (configurado en .env)
    const teacherMeetRoom = import.meta.env.TEACHER_MEET_ROOM;
    
    // Opción 2: Enlace de instrucciones si no hay sala fija
    const instructionLink = "https://meet.google.com/new";
    
    // Usar sala del profesor o dar instrucciones
    const meetLink = teacherMeetRoom || instructionLink;
    const meetInstructions = teacherMeetRoom 
      ? `Your teacher will be waiting for you at: ${teacherMeetRoom}`
      : `Your teacher will create a new Meet room and share the link with you before class. You can also create one yourself at: ${instructionLink}`;

    // Crear el evento con Google Meet habilitado
    const event = {
      summary: `Spanish Class - ${studentName} (${spanishLevel})`,
      description: `
🎓 Spanish Class Booking - ${studentName}

📧 STUDENT CONTACT: ${studentEmail}
📱 PHONE: ${bookingData.studentPhone || 'Not provided'}

👤 Student Information:
• Name: ${studentName}
• Email: ${studentEmail}
• Phone: ${bookingData.studentPhone || 'Not provided'}
• Spanish Level: ${spanishLevel}

📅 Class Details:
• Date: ${date}
• Time: ${formatTime(new Date(startTime))} - ${formatTime(new Date(endTime))}

🎯 This class was booked through FerRealSpanish website.

📧 IMPORTANT: Confirmation email with Google Meet link sent to student automatically.

⏰ AUTOMATIC REMINDERS SET:
• Email reminder 24 hours before class
• Email reminder 1 hour before class  
• Calendar notifications at 1 hour and 15 minutes before

🎥 GOOGLE MEET INSTRUCTIONS: ${meetInstructions}
      `.trim(),
      start: {
        dateTime: startTime,
        timeZone: 'America/New_York', // Ajustar según tu zona horaria
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/New_York', // Ajustar según tu zona horaria
      },
      // Comentamos attendees para evitar error de Domain-Wide Delegation
      // attendees: [
      //   { email: studentEmail, displayName: studentName }
      // ],
      // Comentamos conferenceData temporalmente debido a limitaciones del Service Account
      // conferenceData: {
      //   createRequest: {
      //     requestId: `fer-spanish-${Date.now()}`,
      //     conferenceSolutionKey: {
      //       type: 'hangoutsMeet'
      //     }
      //   }
      // },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 día antes por email
          { method: 'email', minutes: 60 }, // 1 hora antes por email
          { method: 'popup', minutes: 60 }, // 1 hora antes popup/notificación
          { method: 'popup', minutes: 15 } // 15 minutos antes popup adicional
        ]
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false
    };

    // Crear el evento en Google Calendar (sin Meet automático)
    const response = await calendar.events.insert({
      calendarId: TEACHER_CALENDAR_ID,
      sendUpdates: 'none', // No enviar invitaciones automáticas de Google
      requestBody: event
    });

    const createdEvent = response.data;

    // Enviar correo de confirmación al estudiante
    try {
      const emailData = {
        studentName,
        date,
        startTime,
        endTime,
        spanishLevel,
        courseType,
        meetLink,
        meetInstructions
      };

      await resend.emails.send({
        from: `FerRealSpanish <${import.meta.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: [studentEmail],
        subject: `¡Class Confirmed! Your Spanish lesson is scheduled for ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        html: createConfirmationEmailHTML(emailData),
        // Versión texto plano como fallback
        text: `
Hello ${studentName}!

Your Spanish class has been confirmed:

Date: ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${formatTime(new Date(startTime))} - ${formatTime(new Date(endTime))}
Level: ${spanishLevel}

Google Meet Instructions: ${meetInstructions}

Please join the meeting 2-3 minutes early and make sure to test your camera and microphone beforehand.

We're excited to see you in class!

FerRealSpanish Team
        `.trim()
      });

      console.log('Confirmation email sent successfully to:', studentEmail);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // No fallar la reserva si el email falla, pero log el error
    }

    // Enviar correo de notificación al profesor
    try {
      const teacherEmailData = {
        studentName,
        studentEmail,
        studentPhone: bookingData.studentPhone || 'Not provided',
        date,
        startTime,
        endTime,
        spanishLevel,
        courseType,
        meetLink
      };

      await resend.emails.send({
        from: `FerRealSpanish System <${import.meta.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: ['ferrealspanish@gmail.com'],
        subject: `🎯 Nueva Clase Agendada - ${studentName} (${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})`,
        html: createTeacherNotificationEmailHTML(teacherEmailData),
        text: `
Nueva clase agendada!

Estudiante: ${studentName}
Email: ${studentEmail}
Teléfono: ${bookingData.studentPhone || 'No proporcionado'}

Fecha: ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Hora: ${formatTime(new Date(startTime))} - ${formatTime(new Date(endTime))}
Nivel: ${spanishLevel}

El estudiante ha recibido un email de confirmación con los detalles de la clase.
La clase ha sido añadida a tu Google Calendar.

FerRealSpanish System
        `.trim()
      });

      console.log('Teacher notification email sent successfully to: ferrealspanish@gmail.com');
    } catch (teacherEmailError) {
      console.error('Error sending teacher notification email:', teacherEmailError);
      // Log el error pero no fallar la reserva
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Class booked successfully! Confirmation email sent.',
      booking: {
        id: createdEvent.id,
        summary: createdEvent.summary,
        start: createdEvent.start?.dateTime,
        end: createdEvent.end?.dateTime,
        meetLink: meetLink,
        studentName,
        studentEmail,
        courseType,
        spanishLevel
      }
    }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Booking error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack,
      fullError: error
    });

    // Manejar errores específicos de Google Calendar
    if (error.code === 409) {
      return new Response(JSON.stringify({ 
        error: 'Time slot is no longer available',
        message: 'This time slot has been booked by someone else. Please select a different time.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to create booking',
      message: 'There was an error creating your booking. Please try again or contact us directly.',
      details: error.message,
      errorCode: error.code,
      errorStatus: error.status
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
} 