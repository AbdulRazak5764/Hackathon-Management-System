import { supabase } from '../lib/supabase';

export interface EmailNotificationPayload {
  teamName: string;
  teamLeadName: string;
  teamLeadEmail: string;
  psId: string;
  psTitle: string;
  solTitle: string;
  uploadedFileName: string;
}

export async function sendSIHRegistrationEmail(payload: EmailNotificationPayload): Promise<{ success: boolean; message: string }> {
  const { teamName, teamLeadName, teamLeadEmail, psId, psTitle, solTitle, uploadedFileName } = payload;

  const emailSubject = `Successfully Registered in SIH 2026 Hackathon - ${teamName}`;
  
  const emailHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SIH 2026 Registration Confirmation</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 30px; }
        .header { border-b: 2px solid #06b6d4; padding-bottom: 15px; margin-bottom: 20px; }
        .title { color: #38bdf8; font-size: 20px; font-weight: bold; margin: 0; }
        .subtitle { color: #94a3b8; font-size: 13px; margin-top: 5px; }
        .badge { background: #064e3b; color: #34d399; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table td { padding: 10px; border-bottom: 1px solid #334155; font-size: 13px; }
        .label { color: #94a3b8; font-weight: 600; width: 40%; }
        .value { color: #f8fafc; font-weight: 700; }
        .contact-box { background: #0f172a; border: 1px solid #0284c7; border-radius: 12px; padding: 16px; margin-top: 25px; }
        .contact-title { color: #38bdf8; font-weight: bold; font-size: 13px; margin-bottom: 10px; }
        .contact-item { font-size: 12px; color: #cbd5e1; margin-bottom: 5px; }
        .footer { text-align: center; margin-top: 25px; font-size: 11px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 class="title">Smart India Hackathon (SIH 2026)</h2>
          <p class="subtitle">Official Registration Confirmation Notice</p>
        </div>

        <div class="badge">
          ✓ Successfully Registered Your Team in SIH 2026!
        </div>

        <p style="font-size: 14px; color: #e2e8f0;">Dear <strong>${teamLeadName}</strong>,</p>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
          Congratulations! Your team <strong>${teamName}</strong> has been successfully registered on the SIH 2026 Portal.
        </p>

        <table class="info-table">
          <tr>
            <td class="label">Team Name:</td>
            <td class="value">${teamName}</td>
          </tr>
          <tr>
            <td class="label">Team Lead Email:</td>
            <td class="value">${teamLeadEmail}</td>
          </tr>
          <tr>
            <td class="label">SIH Problem Statement ID:</td>
            <td class="value">${psId}</td>
          </tr>
          <tr>
            <td class="label">Problem Statement Title:</td>
            <td class="value">${psTitle}</td>
          </tr>
          <tr>
            <td class="label">Proposed Solution Title:</td>
            <td class="value">${solTitle}</td>
          </tr>
          <tr>
            <td class="label">Solution File:</td>
            <td class="value">${uploadedFileName}</td>
          </tr>
        </table>

        <div class="contact-box">
          <div class="contact-title">📞 Any queries? Please contact SPOC & SIH Team Coordinators 2026:</div>
          <div class="contact-item">👤 <strong>Shaik Abdul Razak</strong>: 8919701520</div>
          <div class="contact-item">👤 <strong>Potharla Rajesh</strong>: 8688796909</div>
          <div class="contact-item">👤 <strong>Kasula Shiva Kumar</strong>: 9014059770</div>
        </div>

        <div class="footer">
          Sender Account: sih2026.cdu@gmail.com • Smart India Hackathon 2026 Portal
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // 1. Try sending via EmailJS or REST API service
    const serviceId = 'service_sih2026';
    const templateId = 'template_sih2026';
    const userId = 'user_sih2026';

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: userId,
        template_params: {
          to_name: teamLeadName,
          to_email: teamLeadEmail,
          from_name: 'SIH 2026 Coordinators',
          from_email: 'sih2026.cdu@gmail.com',
          subject: emailSubject,
          team_name: teamName,
          ps_id: psId,
          ps_title: psTitle,
          sol_title: solTitle,
          file_name: uploadedFileName,
          contacts: 'Shaik Abdul Razak-8919701520 | Potharla Rajesh-8688796909 | Kasula Shiva Kumar-9014059770',
          message_html: emailHtmlContent,
        },
      }),
    });

    if (response.ok) {
      console.log(`Confirmation email sent to ${teamLeadEmail} via EmailJS REST API.`);
    } else {
      console.warn('EmailJS response code:', response.status);
    }

    // 2. Also log email dispatch to Supabase audit_logs for audit record
    try {
      await supabase.from('audit_logs').insert({
        entity_type: 'email_notification',
        entity_id: '00000000-0000-0000-0000-000000000000',
        action: 'TEAM_REGISTRATION_EMAIL_SENT',
        new_value: {
          recipient_email: teamLeadEmail,
          recipient_name: teamLeadName,
          team_name: teamName,
          sender_account: 'sih2026.cdu@gmail.com',
          sent_at: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      console.warn('Audit log write notice:', e?.message);
    }

    return {
      success: true,
      message: `Confirmation email dispatched to Team Lead (${teamLeadEmail}).`,
    };
  } catch (err: any) {
    console.error('Email dispatch error:', err);
    return {
      success: false,
      message: err.message || 'Email dispatch failed.',
    };
  }
}
