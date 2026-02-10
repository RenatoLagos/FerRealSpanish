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
const TEACHER_TIME_ZONE = import.meta.env.TEACHER_TIME_ZONE || 'Europe/Berlin';
const WORK_DAY_START_HOUR = 13;  // 1 PM Berlin time
const WORK_DAY_END_HOUR = 19;   // 7 PM Berlin time
const SLOT_DURATION_MINUTES = 30;

// Función para crear una fecha en la zona horaria del profesor
function createDateInTeacherTimezone(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Crear un string de fecha/hora y parsearlo considerando la zona horaria del profesor
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  // Obtener el offset de la zona horaria del profesor para esta fecha específica
  const tempDate = new Date(dateStr + 'Z'); // Fecha temporal en UTC
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TEACHER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Calcular el offset comparando la hora UTC con la hora en la zona del profesor
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const tzYear = parseInt(getPart('year'));
  const tzMonth = parseInt(getPart('month')) - 1;
  const tzDay = parseInt(getPart('day'));
  const tzHour = parseInt(getPart('hour'));
  const tzMinute = parseInt(getPart('minute'));

  // Crear fecha UTC que cuando se muestre en TEACHER_TIME_ZONE sea la hora deseada
  const targetDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const currentInTZ = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, 0));
  const offsetMs = tempDate.getTime() - currentInTZ.getTime();

  return new Date(targetDate.getTime() + offsetMs);
}

// Verificar si Google está configurado
const isGoogleConfigured = () => {
  return !!(
    import.meta.env.GOOGLE_PROJECT_ID &&
    import.meta.env.GOOGLE_PRIVATE_KEY &&
    import.meta.env.GOOGLE_CLIENT_EMAIL
  );
};

/**
 * Obtiene la fecha/hora actual en la zona horaria del profesor.
 * Esto es crucial para verificar fechas pasadas correctamente,
 * independientemente de la zona horaria del servidor.
 */
function getNowInTeacherTimezone(): { year: number; month: number; day: number; hour: number; minute: number; date: Date } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEACHER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    date: now
  };
}

/**
 * Verifica si una fecha seleccionada es pasada respecto a la zona del profesor.
 */
function isDateInPast(year: number, month: number, day: number): boolean {
  const teacherNow = getNowInTeacherTimezone();

  // Comparar año, mes, día
  if (year < teacherNow.year) return true;
  if (year > teacherNow.year) return false;

  if (month < teacherNow.month) return true;
  if (month > teacherNow.month) return false;

  // Mismo año y mes - comparar día (pasado significa ANTES de hoy)
  return day < teacherNow.day;
}

/**
 * Verifica si la fecha seleccionada es HOY en la zona del profesor.
 */
function isToday(year: number, month: number, day: number): boolean {
  const teacherNow = getNowInTeacherTimezone();
  return year === teacherNow.year && month === teacherNow.month && day === teacherNow.day;
}

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

    // CORRECCIÓN: Usar zona horaria del profesor para verificar fechas pasadas
    // Esto evita problemas cuando el servidor está en UTC y el profesor en otra zona
    if (isDateInPast(year, month, day)) {
      return new Response(JSON.stringify({
        availableSlots: [],
        message: 'No available slots for past dates',
        date
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Flag para saber si es hoy (en zona del profesor) - útil para filtrar slots pasados
    const isTodayInTeacherZone = isToday(year, month, day);

    // Solo permitir clases Lunes (1), Martes (2) y Miércoles (3)
    const dayOfWeek = selectedDate.getDay();
    const allowedDays = [1, 2, 3]; // Monday, Tuesday, Wednesday
    if (!allowedDays.includes(dayOfWeek)) {
      return new Response(JSON.stringify({
        availableSlots: [],
        message: 'Classes only available on Monday, Tuesday, and Wednesday',
        date
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si Google no está configurado, devolver horarios de demostración
    if (!isGoogleConfigured()) {
      const mockSlots = generateMockSlots(selectedDate, isTodayInTeacherZone);

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

      // Generar slots disponibles (1 PM a 7 PM en zona horaria del profesor, 30 minutos cada uno)
      const availableSlots = [];
      const [slotYear, slotMonth, slotDay] = date.split('-').map(num => parseInt(num));
      const workDayEnd = createDateInTeacherTimezone(slotYear, slotMonth - 1, slotDay, WORK_DAY_END_HOUR, 0);

      // Para filtrar slots pasados cuando es hoy
      const nowUTC = new Date();
      // Agregar margen de 30 minutos mínimo para reservar
      const minimumBookingTime = new Date(nowUTC.getTime() + 30 * 60 * 1000);

      for (let hour = WORK_DAY_START_HOUR; hour < WORK_DAY_END_HOUR; hour++) {
        for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
          // Crear slot en la zona horaria del profesor
          const slotStart = createDateInTeacherTimezone(slotYear, slotMonth - 1, slotDay, hour, minute);

          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

          if (slotEnd > workDayEnd) {
            continue;
          }

          // CORRECCIÓN: Si es hoy, filtrar slots que ya pasaron o están muy próximos
          if (isTodayInTeacherZone && slotStart <= minimumBookingTime) {
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
      const mockSlots = generateMockSlots(selectedDate, isTodayInTeacherZone);

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

function generateMockSlots(date: Date, filterPastSlots: boolean = false) {
  const slots = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const workDayEnd = createDateInTeacherTimezone(year, month, day, WORK_DAY_END_HOUR, 0);

  // Para filtrar slots pasados cuando es hoy
  const nowUTC = new Date();
  const minimumBookingTime = new Date(nowUTC.getTime() + 30 * 60 * 1000);

  for (let hour = WORK_DAY_START_HOUR; hour < WORK_DAY_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
      // Crear slot en la zona horaria del profesor
      const slotStart = createDateInTeacherTimezone(year, month, day, hour, minute);

      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

      if (slotEnd > workDayEnd) {
        continue;
      }

      // Filtrar slots pasados si es hoy
      if (filterPastSlots && slotStart <= minimumBookingTime) {
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
      hour12: true,
      timeZone: TEACHER_TIME_ZONE
    });
  };

  return `${formatTime(start)} - ${formatTime(end)}`;
} 