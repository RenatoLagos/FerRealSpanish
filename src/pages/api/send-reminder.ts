import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Configuración de Resend
const resend = new Resend(import.meta.env.RESEND_API_KEY);

interface ReminderData {
  studentName: string;
  studentEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  meetLink: string;
  reminderType: '24h' | '1h';
}

// Template de recordatorio 24h antes
function create24HourReminderEmailHTML(data: ReminderData) {
  const { studentName, date, startTime, meetLink } = data;
  
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
                <p><strong>Time:</strong> ${formatStartTime}</p>
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

// Template de recordatorio 1h antes
function create1HourReminderEmailHTML(data: ReminderData) {
  const { studentName, meetLink } = data;

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const reminderData: ReminderData = await request.json();
    console.log('Processing reminder request:', reminderData);
    
    const { 
      studentName, 
      studentEmail, 
      date, 
      startTime, 
      endTime, 
      meetLink, 
      reminderType 
    } = reminderData;
    
    // Validar datos requeridos
    if (!studentName || !studentEmail || !date || !startTime || !meetLink || !reminderType) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['studentName', 'studentEmail', 'date', 'startTime', 'meetLink', 'reminderType']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let emailSubject: string;
    let emailHTML: string;
    let emailText: string;

    if (reminderType === '24h') {
      emailSubject = `🔔 Class Tomorrow - ${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} | FerRealSpanish`;
      emailHTML = create24HourReminderEmailHTML(reminderData);
      emailText = `¡Hola ${studentName}! Your Spanish class is tomorrow at ${new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}. Meeting link: ${meetLink}`;
    } else {
      emailSubject = `⏰ Class Starting in 1 Hour! | FerRealSpanish`;
      emailHTML = create1HourReminderEmailHTML(reminderData);
      emailText = `¡Hola ${studentName}! Your Spanish class starts in 1 hour. Join here: ${meetLink}`;
    }

    // Enviar recordatorio
    await resend.emails.send({
      from: `FerRealSpanish Reminders <${import.meta.env.FROM_EMAIL || 'noreply@ferrealspanish.com'}>`,
      to: [studentEmail],
      subject: emailSubject,
      html: emailHTML,
      text: emailText
    });

    console.log(`${reminderType} reminder sent successfully to:`, studentEmail);

    return new Response(JSON.stringify({
      success: true,
      message: `${reminderType} reminder sent successfully`,
      reminderType,
      sentTo: studentEmail,
      sentAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Reminder sending error:', error);

    return new Response(JSON.stringify({ 
      error: 'Failed to send reminder',
      message: 'There was an error sending the reminder email.',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 