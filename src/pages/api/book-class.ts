import type { APIRoute } from 'astro';
import { google } from 'googleapis';  
import { Resend } from 'resend';

import { saveBooking } from 'src/lib/django';

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
const TEACHER_TIME_ZONE = import.meta.env.TEACHER_TIME_ZONE || 'Europe/Berlin';

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
  lessonType: string;
  courseType: string;
  studentTimeZone?: string;
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
  const {
    studentName,
    date,
    startTime,
    endTime,
    spanishLevel,
    courseType,
    meetLink,
    meetInstructions,
    studentTimeZone
  } = bookingData;

  const timeZone = studentTimeZone || TEACHER_TIME_ZONE;
  const classStart = new Date(startTime);
  const classEnd = new Date(endTime);
  const formatDate = formatDateForZone(classStart, timeZone);
  const formatStartTime = formatTimeInZone(classStart, timeZone, true);
  const formatEndTime = formatTimeInZone(classEnd, timeZone, true);

  // Hora del profesor (Berlin) para referencia
  const teacherStartTime = formatTimeInZone(classStart, TEACHER_TIME_ZONE, true);
  const teacherEndTime = formatTimeInZone(classEnd, TEACHER_TIME_ZONE, true);
  const showBothTimezones = timeZone !== TEACHER_TIME_ZONE;

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
                    <p><span class="emoji">🕐</span> <strong>Your Time:</strong> ${formatStartTime} - ${formatEndTime}</p>
                    ${showBothTimezones ? `<p><span class="emoji">🌍</span> <strong>Teacher's Time:</strong> ${teacherStartTime} - ${teacherEndTime} (Berlin)</p>` : ''}
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
                    - If you need to reschedule, please contact us at least 24 hours in advance<br>
                    - Keep this email for your records and easy access to the meeting link
                </p>
            </div>
            
            <p>We can't wait to help you on your Spanish learning journey! If you have any questions, feel free to reach out.</p>
            
            <p>¡Nos vemos pronto!<br>
            <strong>FerRealSpanish Team</strong></p>
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

  const classStart = new Date(startTime);
  const classEnd = new Date(endTime);
  const formatDate = formatDateForZone(classStart, TEACHER_TIME_ZONE);
  const formatStartTime = formatTimeInZone(classStart, TEACHER_TIME_ZONE, true);
  const formatEndTime = formatTimeInZone(classEnd, TEACHER_TIME_ZONE, true);

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

// Template de recordatorio 24h antes de la clase
function create24HourReminderEmailHTML(bookingData: any) {
  const { studentName, date, startTime, endTime, meetLink, studentTimeZone } = bookingData;

  const timeZone = studentTimeZone || TEACHER_TIME_ZONE;
  const classStart = new Date(startTime);
  const classEnd = new Date(endTime);
  const formatDate = formatDateForZone(classStart, timeZone);
  const formatStartTime = formatTimeInZone(classStart, timeZone, true);
  const formatEndTime = formatTimeInZone(classEnd, timeZone, true);

  // Hora del profesor (Berlin) para referencia
  const teacherStartTime = formatTimeInZone(classStart, TEACHER_TIME_ZONE, true);
  const teacherEndTime = formatTimeInZone(classEnd, TEACHER_TIME_ZONE, true);
  const showBothTimezones = timeZone !== TEACHER_TIME_ZONE;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class Reminder - Tomorrow! | FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff9500, #ff8c00); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; }
        .highlight-box { background: #fff7ed; border-left: 4px solid #ff9500; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .meet-link { display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white !important; padding: 18px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3); }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Class Reminder!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your Spanish class is tomorrow</p>
        </div>
        
        <div class="content">
            <p>¡Hola <strong>${studentName}</strong>!</p>
            
            <p>This is a friendly reminder that your Spanish class is scheduled for <strong>tomorrow</strong>! 🎉</p>
            
            <div class="highlight-box">
                <h3 style="color: #c2410c; margin-top: 0;">📅 Class Tomorrow</h3>
                <p><strong>Date:</strong> ${formatDate}</p>
                <p><strong>🕐 Your Time:</strong> ${formatStartTime} - ${formatEndTime}</p>
                ${showBothTimezones ? `<p><strong>🌍 Teacher's Time:</strong> ${teacherStartTime} - ${teacherEndTime} (Berlin)</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${meetLink}" class="meet-link" target="_blank">
                    🎯 Class Meeting Link
                </a>
            </div>
            
            <p><strong>Quick reminders:</strong></p>
            <ul>
                <li>✅ Test your camera and microphone</li>
                <li>📝 Have a notebook and pen ready</li>
                <li>🤔 Prepare any questions you'd like to ask</li>
                <li>⏰ Join 2-3 minutes early</li>
            </ul>
            
            <p>We're excited to see you tomorrow!</p>
            
            <p>¡Nos vemos mañana!<br>
            <strong>FerRealSpanish</strong> 🚀</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}

// Template de recordatorio 1h antes de la clase  
function create1HourReminderEmailHTML(bookingData: any) {
  const { studentName, meetLink } = bookingData;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class Starting Soon! | FerRealSpanish</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f9fc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 30px; text-align: center; }
        .meet-link { display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white !important; padding: 20px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 20px 0; box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3); }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Class Starting Soon!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your Spanish class starts in 1 hour</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px;">¡Hola <strong>${studentName}</strong>!</p>
            
            <p style="font-size: 16px; margin-bottom: 30px;">Your Spanish class starts in just <strong>1 hour</strong>! 🚀</p>
            
            <a href="${meetLink}" class="meet-link" target="_blank">
                🎯 Join Class Now
            </a>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Please join 2-3 minutes early to test your connection.
            </p>
            
            <p><strong>¡Nos vemos pronto!</strong><br>
            <strong>FerRealSpanish</strong> 🎓</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FerRealSpanish. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}

// Función para programar recordatorios con lógica específica de tiempo
async function scheduleReminders(bookingData: any) {
  const { startTime, studentEmail, studentName, date, meetLink, studentTimeZone } = bookingData;
  const reminderTimeZone = resolveTimeZone(studentTimeZone);

  try {
    const classDate = new Date(startTime);
    const now = new Date();

    if (Number.isNaN(classDate.getTime())) {
      console.warn('[Reminder] Unable to schedule reminders: invalid class start', { startTime });
      return false;
    }

    const msUntilClass = classDate.getTime() - now.getTime();
    if (msUntilClass <= 0) {
      console.warn('[Reminder] Class already started/passed. Skipping reminders.');
      return false;
    }

    const oneHourBefore = new Date(classDate.getTime() - 60 * 60 * 1000);
    const twentyFourHoursBefore = new Date(classDate.getTime() - 24 * 60 * 60 * 1000);
    const shouldSendDayBefore = msUntilClass >= 24 * 60 * 60 * 1000;

    console.log(`[Reminder] Configuring reminders for ${studentName}`);
    console.log(`  - Class at: ${classDate.toISOString()}`);
    console.log(`  - Hours until class: ${(msUntilClass / (1000 * 60 * 60)).toFixed(1)}`);

    const reminderPlan: Array<{ type: '24h' | '1h'; sendAt: Date }> = [];

    if (shouldSendDayBefore) {
      reminderPlan.push({ type: '24h', sendAt: twentyFourHoursBefore });
    }

    reminderPlan.push({ type: '1h', sendAt: oneHourBefore });

    for (const { type, sendAt } of reminderPlan) {
      if (sendAt.getTime() <= now.getTime()) {
        console.log(`[Reminder] ${type} reminder scheduled time already passed. Sending now.`);
        await sendReminderEmail({
          studentName,
          studentEmail,
          date,
          startTime,
          meetLink,
          reminderType: type,
          studentTimeZone: reminderTimeZone
        });
        continue;
      }

      const msUntilReminder = sendAt.getTime() - now.getTime();

      if (msUntilReminder < 2 * 60 * 1000) {
        console.log(`[Reminder] ${type} reminder is less than 2 minutes away. Sending immediately.`);
        await sendReminderEmail({
          studentName,
          studentEmail,
          date,
          startTime,
          meetLink,
          reminderType: type,
          studentTimeZone: reminderTimeZone
        });
        continue;
      }

      console.log(`[Reminder] ${type} reminder scheduled for ${sendAt.toISOString()}`);
      await sendReminderEmail({
        studentName,
        studentEmail,
        date,
        startTime,
        meetLink,
        reminderType: type,
        studentTimeZone: reminderTimeZone
      }, { sendAt });
    }

    console.log('[Reminder] Reminder configuration complete.');
    return true;
  } catch (error) {
    console.error('[Reminder] Error configuring reminders:', error);
    return false;
  }
}

// Función para enviar o programar recordatorios
async function sendReminderEmail(reminderData: any, options: { sendAt?: Date } = {}) {
  try {
    const { studentName, studentEmail, reminderType } = reminderData;
    const reminderTimeZone = resolveTimeZone(reminderData.studentTimeZone);
    const reminderPayload = { ...reminderData, studentTimeZone: reminderTimeZone };

    let emailSubject: string;
    let emailHTML: string;

    if (reminderType === '24h') {
      emailSubject = `Recordatorio: Clase mañana | FerRealSpanish`;
      emailHTML = create24HourReminderEmailHTML(reminderPayload);
    } else {
      emailSubject = `Tu clase empieza en 1 hora | FerRealSpanish`;
      emailHTML = create1HourReminderEmailHTML(reminderPayload);
    }

    const sendConfig: Record<string, any> = {
      from: `FerRealSpanish Recordatorios <${import.meta.env.FROM_EMAIL || 'noreply@ferrealspanish.com'}>`,
      to: [studentEmail],
      subject: emailSubject,
      html: emailHTML
    };

    if (options.sendAt) {
      sendConfig.scheduledAt = options.sendAt.toISOString();
      console.log(`[Reminder] ${reminderType} reminder scheduled for ${options.sendAt.toISOString()}`);
    } else {
      console.log(`[Reminder] ${reminderType} reminder sent immediately to ${studentEmail}`);
    }

    await resend.emails.send(sendConfig);
    return true;
  } catch (error) {
    console.error(`[Reminder] Error handling ${reminderData.reminderType} reminder:`, error);
    return false;
  }
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
    const { date, startTime, endTime, studentName, studentEmail, spanishLevel, lessonType, courseType } = bookingData;
    const studentTimeZone = resolveTimeZone(bookingData.studentTimeZone);
    
    if (!date || !startTime || !endTime || !studentName || !studentEmail || !spanishLevel || !lessonType || !courseType) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['date', 'startTime', 'endTime', 'studentName', 'studentEmail', 'spanishLevel', 'lessonType', 'courseType']
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

    // VALIDACIÓN CRÍTICA: Verificar que el slot no haya pasado
    // Esto previene reservas de clases que ya ocurrieron debido a race conditions
    const slotStartDate = new Date(startTime);
    const now = new Date();
    const minimumLeadTime = 15 * 60 * 1000; // 15 minutos mínimo antes de la clase

    if (Number.isNaN(slotStartDate.getTime())) {
      console.error('[Booking] Invalid startTime received:', startTime);
      return new Response(JSON.stringify({
        error: 'Invalid time format',
        message: 'The selected time slot is invalid. Please try again.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (slotStartDate.getTime() <= now.getTime() + minimumLeadTime) {
      console.warn('[Booking] Attempted to book a past or imminent slot:', {
        startTime,
        now: now.toISOString(),
        difference: (slotStartDate.getTime() - now.getTime()) / 1000 / 60 + ' minutes'
      });
      return new Response(JSON.stringify({
        error: 'Time slot no longer available',
        message: 'This time slot has already passed or is too soon. Please select a different time.'
      }), {
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

    // Formatear horas para la descripción del evento
    const classStart = new Date(startTime);
    const classEnd = new Date(endTime);
    const teacherStartFormatted = formatTimeInZone(classStart, TEACHER_TIME_ZONE, true);
    const teacherEndFormatted = formatTimeInZone(classEnd, TEACHER_TIME_ZONE, true);
    const studentStartFormatted = formatTimeInZone(classStart, studentTimeZone, true);
    const studentEndFormatted = formatTimeInZone(classEnd, studentTimeZone, true);
    const teacherDateFormatted = formatDateForZone(classStart, TEACHER_TIME_ZONE);
    const studentDateFormatted = formatDateForZone(classStart, studentTimeZone);

    // Crear el evento con Google Meet habilitado
    const event = {
      summary: `Spanish Class - ${studentName} (${spanishLevel})`,
      description: `
🎓 Spanish Class Booking - ${studentName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 TIME ZONES - IMPORTANT!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇩🇪 TEACHER TIME (Berlin):
   📅 ${teacherDateFormatted}
   🕐 ${teacherStartFormatted} - ${teacherEndFormatted}

👤 STUDENT TIME (${studentTimeZone}):
   📅 ${studentDateFormatted}
   🕐 ${studentStartFormatted} - ${studentEndFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 STUDENT CONTACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Name: ${studentName}
- Email: ${studentEmail}
- Phone: ${bookingData.studentPhone || 'Not provided'}
- Spanish Level: ${spanishLevel}
- Timezone: ${studentTimeZone}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 GOOGLE MEET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${meetInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Confirmation email sent to student
✓ Reminders scheduled (24h + 1h before class)
✓ Booked via FerRealSpanish website
      `.trim(),
      start: {
        // IMPORTANTE: Usamos formato sin offset (YYYY-MM-DDTHH:mm:ss) + timeZone
        // Esto evita la ambigüedad de mezclar ISO con Z y timeZone diferente
        dateTime: formatDateTimeForCalendar(startTime, TEACHER_TIME_ZONE),
        timeZone: TEACHER_TIME_ZONE,
      },
      end: {
        dateTime: formatDateTimeForCalendar(endTime, TEACHER_TIME_ZONE),
        timeZone: TEACHER_TIME_ZONE,
      },
      // Los attendees requieren Domain-Wide Delegation - usar método alternativo
      // attendees: [
      //   { 
      //     email: studentEmail, 
      //     displayName: studentName,
      //     responseStatus: 'accepted'
      //   }
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

    // Crear el evento en Google Calendar (solo para el profesor)
    const response = await calendar.events.insert({
      calendarId: TEACHER_CALENDAR_ID,
      sendUpdates: 'none', // No enviar invitaciones automáticas para evitar errores
      requestBody: event
    });

    const createdEvent = response.data;

    // Django: Guardar la reserva en la base de datos
    await saveBooking({ date, startTime, endTime, studentName, studentEmail, spanishLevel, lessonType, studentTimeZone });

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
        meetInstructions,
        studentTimeZone
      };

      const subjectDateLabel = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        timeZone: studentTimeZone
      }).format(new Date(startTime));
      const plainDateLabel = formatDateForZone(new Date(startTime), studentTimeZone);
      const plainStartTime = formatTimeInZone(new Date(startTime), studentTimeZone, true);
      const plainEndTime = formatTimeInZone(new Date(endTime), studentTimeZone, true);

      await resend.emails.send({
        from: `FerRealSpanish <${import.meta.env.FROM_EMAIL || 'noreply@ferrealspanish.com'}>`,
        to: [studentEmail],
        subject: `¡Class Confirmed! Your Spanish lesson is scheduled for ${subjectDateLabel}`,
        html: createConfirmationEmailHTML(emailData),
        // Versión texto plano como fallback
        text: `
Hello ${studentName}!

Your Spanish class has been confirmed:

Date: ${plainDateLabel}
Time: ${plainStartTime} - ${plainEndTime}
Level: ${spanishLevel}

Google Meet Instructions: ${meetInstructions}

Please join the meeting 2-3 minutes early and make sure to test your camera and microphone beforehand.

We're excited to see you in class!

FerRealSpanish Team
        `.trim()
      });

      console.log('Confirmation email sent successfully to:', studentEmail);
      
      // Programar recordatorios adicionales (respaldo)
      await scheduleReminders({
        startTime,
        studentEmail,
        studentName,
        date,
        meetLink,
        studentTimeZone
      });
      
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

      const teacherSubjectDate = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        timeZone: TEACHER_TIME_ZONE
      }).format(new Date(startTime));
      const teacherPlainDate = formatDateForZone(new Date(startTime), TEACHER_TIME_ZONE);
      const teacherPlainStart = formatTimeInZone(new Date(startTime), TEACHER_TIME_ZONE, true);
      const teacherPlainEnd = formatTimeInZone(new Date(endTime), TEACHER_TIME_ZONE, true);

      await resend.emails.send({
        from: `FerRealSpanish System <${import.meta.env.FROM_EMAIL || 'noreply@ferrealspanish.com'}>`,
        to: ['ferrealspanish@gmail.com'],
        subject: `🎯 Nueva Clase Agendada - ${studentName} (${teacherSubjectDate})`,
        html: createTeacherNotificationEmailHTML(teacherEmailData),
        text: `
Nueva clase agendada!

Estudiante: ${studentName}
Email: ${studentEmail}
Teléfono: ${bookingData.studentPhone || 'No proporcionado'}

Fecha: ${teacherPlainDate}
Hora: ${teacherPlainStart} - ${teacherPlainEnd}
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
      message: 'Class booked successfully! Confirmation email sent and intelligent reminder system configured.',
      booking: {
        id: createdEvent.id,
        summary: createdEvent.summary,
        start: createdEvent.start?.dateTime,
        end: createdEvent.end?.dateTime,
        meetLink: meetLink,
        studentName,
        studentEmail,
        courseType,
        spanishLevel,
        remindersEnabled: true,
        reminderSystem: 'intelligent-email-based'
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

    // Manejar errores de permisos de Google Calendar
    if (error.code === 403) {
      console.error('Google Calendar permission error - check Service Account configuration');
      return new Response(JSON.stringify({ 
        error: 'Calendar permission error',
        message: 'There was a configuration error. Please contact support.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Manejar errores de autenticación
    if (error.code === 401) {
      console.error('Google Calendar authentication error - check credentials');
      return new Response(JSON.stringify({ 
        error: 'Calendar authentication error',
        message: 'There was an authentication error. Please contact support.'
      }), {
        status: 500,
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

function resolveTimeZone(candidate?: string): string {
  if (!candidate || typeof candidate !== 'string') {
    return TEACHER_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return TEACHER_TIME_ZONE;
  }
}

function formatDateForZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone
  });
}

function formatTimeInZone(date: Date, timeZone: string, includeZone = false): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  };

  if (includeZone) {
    options.timeZoneName = 'short';
  }

  return date.toLocaleTimeString('en-US', options);
}

function formatTime(date: Date, timeZone: string = TEACHER_TIME_ZONE): string {
  return formatTimeInZone(date, timeZone);
}

/**
 * Convierte una fecha ISO (UTC) a formato local para Google Calendar.
 * Google Calendar espera "YYYY-MM-DDTHH:mm:ss" SIN offset cuando se especifica timeZone.
 * Esto evita la ambigüedad de mezclar ISO con Z y un timeZone diferente.
 *
 * @param isoString - Fecha en formato ISO (ej: "2025-01-15T09:00:00.000Z")
 * @param timeZone - Zona horaria destino (ej: "Europe/Berlin")
 * @returns Fecha formateada sin offset (ej: "2025-01-15T10:00:00")
 */
function formatDateTimeForCalendar(isoString: string, timeZone: string): string {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    console.error('[Calendar] Invalid date received:', isoString);
    throw new Error(`Invalid date format: ${isoString}`);
  }

  // Usar Intl.DateTimeFormat para obtener los componentes en la zona correcta
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  // Formato: YYYY-MM-DDTHH:mm:ss (sin Z, sin offset)
  const result = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  console.log(`[Calendar] Converted ${isoString} -> ${result} (${timeZone})`);

  return result;
}
