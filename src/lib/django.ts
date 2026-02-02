const DJANGO_API_URL = import.meta.env.DJANGO_API_URL || 'http://localhost:8000/api';

export async function saveBooking(data: {
date: string;
startTime: string;
endTime: string;
studentName: string;
studentEmail: string;
spanishLevel: string;
lessonType?: string;
studentTimeZone?: string;
}) {
try {
    console.log('[Django] Enviando booking:', data);

    const response = await fetch(`${DJANGO_API_URL}/bookings/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    });

    if (response.ok) {
    console.log('[Django] Booking guardado');
    return await response.json();
    }
    console.error('[Django] Error:', await response.text());
    return null;
} catch (error) {
    console.error('[Django] Error (non-fatal):', error);
    return null;
}
}

export async function saveContact(data: {
firstName: string;
lastName: string;
email: string;
message: string;
}) {
try {
    const response = await fetch(`${DJANGO_API_URL}/contacts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    });

    if (response.ok) {
    console.log('[Django] Contact guardado');
    return await response.json();
    }
    console.error('[Django] Error:', await response.text());
    return null;
} catch (error) {
    console.error('[Django] Error (non-fatal):', error);
    return null;
}
}

export async function saveWaitlist(data: {
name: string;
email: string;
spanishLevel: string;
message?: string;
}) {
try {
    console.log('[Django] Saving waitlist entry:', data);

    const response = await fetch(`${DJANGO_API_URL}/waitlist/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    });

    if (response.ok) {
    console.log('[Django] Waitlist entry saved');
    return await response.json();
    }
    console.error('[Django] Error:', await response.text());
    return null;
} catch (error) {
    console.error('[Django] Error (non-fatal):', error);
    return null;
}
}