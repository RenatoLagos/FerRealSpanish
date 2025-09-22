import type { APIRoute } from 'astro';
import { google } from 'googleapis';

// Configuración del Service Account
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
const WORK_DAY_START_HOUR = 9;
const WORK_DAY_END_HOUR = 18;
const SLOT_DURATION_MINUTES = 30;

// Verificar si Google está configurado
const isGoogleConfigured = () => {
  return !!(
    import.meta.env.GOOGLE_PROJECT_ID &&
    import.meta.env.GOOGLE_PRIVATE_KEY &&
    import.meta.env.GOOGLE_CLIENT_EMAIL
  );
};

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    
    if (!date) {
      return new Response(JSON.stringify({ error: 'Date parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{1,2}-\d{1,2}$/;
    if (!dateRegex.test(date)) {
      return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD or YYYY-M-D' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parsear la fecha correctamente
    const [year, month, day] = date.split('-').map(num => parseInt(num));
    const selectedDate = new Date(year, month - 1, day); // month es 0-indexed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Verificar que no sea un día muy pasado (permitir fechas de hoy)
    if (selectedDate < today) {
      return new Response(JSON.stringify({ 
        availableSlots: [],
        message: 'No available slots for past dates',
        date
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que no sea fin de semana
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ 
        availableSlots: [],
        message: 'No classes available on weekends',
        date
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si Google no está configurado, devolver horarios de demostración
    if (!isGoogleConfigured()) {
      const mockSlots = generateMockSlots(selectedDate);
      
      return new Response(JSON.stringify({ 
        availableSlots: mockSlots,
        message: 'Using demo availability (Google Calendar not configured)',
        date,
        isDemo: true
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Intentar usar Google Calendar
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });

      const calendar = google.calendar({ version: 'v3', auth });

      // Obtener eventos ocupados para el día seleccionado
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const busyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: TEACHER_CALENDAR_ID }]
        }
      });

      const busyTimes = busyResponse.data.calendars?.[TEACHER_CALENDAR_ID]?.busy || [];

      // Generar slots disponibles (9 AM a 6 PM, 30 minutos cada uno)
      const availableSlots = [];
      const workDayEnd = new Date(selectedDate);
      workDayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

      for (let hour = WORK_DAY_START_HOUR; hour < WORK_DAY_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
          const slotStart = new Date(selectedDate);
          slotStart.setHours(hour, minute, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION_MINUTES);

          if (slotEnd > workDayEnd) {
            continue;
          }

          // Verificar si este slot no esta ocupado
          const isAvailable = !busyTimes.some((busy: any) => {
            const busyStart = new Date(busy.start!);
            const busyEnd = new Date(busy.end!);
            return (slotStart < busyEnd && slotEnd > busyStart);
          });

          if (isAvailable) {
            availableSlots.push({
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
              displayTime: formatTimeSlot(slotStart, slotEnd)
            });
          }
        }
      }

      return new Response(JSON.stringify({ 
        availableSlots,
        date,
        message: availableSlots.length > 0 ? 'Available slots found' : 'No available slots for this date',
        isDemo: false
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (googleError) {
      const mockSlots = generateMockSlots(selectedDate);
      
      return new Response(JSON.stringify({ 
        availableSlots: mockSlots,
        message: 'Using demo availability due to Google Calendar error',
        date,
        isDemo: true,
        error: 'Google Calendar integration failed'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'Unable to fetch availability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function generateMockSlots(date: Date) {
  const slots = [];
  const workDayEnd = new Date(date);
  workDayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

  for (let hour = WORK_DAY_START_HOUR; hour < WORK_DAY_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION_MINUTES);

      if (slotEnd > workDayEnd) {
        continue;
      }

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        displayTime: formatTimeSlot(slotStart, slotEnd)
      });
    }
  }
  
  return slots;
}

function formatTimeSlot(start: Date, end: Date): string {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  return `${formatTime(start)} - ${formatTime(end)}`;
} 