import type { APIRoute } from 'astro';
import { google } from 'googleapis';

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

interface BookingData {
  date: string;
  startTime: string;
  endTime: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  spanishLevel: string;
  courseType: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const bookingData: BookingData = await request.json();
    console.log('Received booking data:', bookingData);
    
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

    // Crear el evento
    const event = {
      summary: `Spanish Class - ${studentName} (${spanishLevel} ${courseType})`,
      description: `
🎓 Spanish Class Booking - ${studentName}

📧 STUDENT CONTACT: ${studentEmail}
📱 PHONE: ${bookingData.studentPhone || 'Not provided'}

👤 Student Information:
• Name: ${studentName}
• Email: ${studentEmail}
• Phone: ${bookingData.studentPhone || 'Not provided'}
• Spanish Level: ${spanishLevel}
• Course Type: ${courseType}

📅 Class Details:
• Date: ${date}
• Time: ${formatTime(new Date(startTime))} - ${formatTime(new Date(endTime))}

🎯 This class was booked through FerRealSpanish website.

📞 NEXT STEPS:
1. Create a Google Meet link manually: https://meet.google.com/new
2. Send the Meet link to student: ${studentEmail}
3. Or add the student as a guest to this calendar event
      `.trim(),
      start: {
        dateTime: startTime,
        timeZone: 'America/New_York', // Ajustar según tu zona horaria
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/New_York', // Ajustar según tu zona horaria
      },
      // Comentamos attendees para evitar el error de Domain-Wide Delegation
      // attendees: [
      //   { email: studentEmail, displayName: studentName }
      // ],
      // Comentamos conferenceData temporalmente para evitar errores
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
          { method: 'email', minutes: 24 * 60 }, // 1 día antes
          { method: 'popup', minutes: 30 } // 30 minutos antes
        ]
      },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: false
    };

    // Crear el evento en Google Calendar
    const response = await calendar.events.insert({
      calendarId: TEACHER_CALENDAR_ID,
      // conferenceDataVersion: 1, // Comentado porque no usamos conferenceData
      sendUpdates: 'none', // No enviar invitaciones automáticas
      requestBody: event
    });

    const createdEvent = response.data;

    return new Response(JSON.stringify({
      success: true,
      message: 'Class booked successfully!',
      booking: {
        id: createdEvent.id,
        summary: createdEvent.summary,
        start: createdEvent.start?.dateTime,
        end: createdEvent.end?.dateTime,
        meetLink: createdEvent.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri,
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