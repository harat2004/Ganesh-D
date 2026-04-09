import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SMTP Configuration optimized for Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  // Verify connection configuration
  if (!process.env.MAIL_USERNAME || !process.env.MAIL_PASSWORD) {
    console.warn('WARNING: MAIL_USERNAME or MAIL_PASSWORD is not set in Secrets!');
  }

  transporter.verify(function (error, success) {
    if (error) {
      console.log('SMTP Connection Error (Check your Secrets):', error.message);
      if (process.env.MAIL_PASSWORD && process.env.MAIL_PASSWORD.length !== 16) {
        console.warn(`DEBUG: MAIL_PASSWORD is ${process.env.MAIL_PASSWORD.length} characters long. Google App Passwords must be exactly 16 characters.`);
      }
    } else {
      console.log('SMTP Server is ready to take our messages');
    }
  });

  // API to send Notification/OTP
  app.post('/api/send-otp', async (req, res) => {
    const { email, otp, newEmail, type } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let subject = 'Email Verification Required';
    let content = `
      <h2 style="color: #4f46e5;">Action Required: Verify Your Email</h2>
      <p>We have received a request to update your administrator email to: <strong>${email}</strong></p>
      <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 8px; color: #92400e; margin: 20px 0;">
        <strong>कृपया ध्यान दें (Important):</strong> 
        यह ईमेल सिर्फ यह पुष्टि करने के लिए है कि आपका नया ईमेल पता सही है। 
        <br><br>
        लॉगिन ईमेल बदलने के लिए असली <strong>Verification Link</strong> आपको एक अलग ईमेल में मिलेगा जो <strong>"Firebase"</strong> (noreply@your-project.firebaseapp.com) की तरफ से आएगा।
      </div>
      <p>कृपया अपने <strong>Spam/Junk</strong> फोल्डर में "Firebase" वाला ईमेल ढूंढें और उसमें दिए गए लिंक पर क्लिक करें।</p>
    `;

    if (otp && type !== 'VERIFICATION_INFO') {
      subject = 'Admin Email Change Request - OTP Verification';
      content = `
        <h2 style="color: #4f46e5;">Admin Email Change Request</h2>
        <p>A request has been made to change the Admin Email to: <strong>${newEmail}</strong></p>
        <p>Your 6-digit verification OTP is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5; background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
      `;
    }

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Charbhuja Marketing'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
          ${content}
          <p style="color: #6b7280; font-size: 14px;">If you did not request this change, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #9ca3af;">This is an automated message from Charbhuja Marketing.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error: any) {
      console.error('Email sending error:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
  });

  // API to send Order Notification
  app.post('/api/send-order-notification', async (req, res) => {
    const { adminEmail, customerEmail, orderData } = req.body;

    if (!adminEmail || !orderData) {
      return res.status(400).json({ error: 'Admin email and order data are required' });
    }

    const itemsHtml = orderData.items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.itemName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.service}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price * item.quantity}</td>
      </tr>
    `).join('');

    const recipients = [adminEmail];
    if (customerEmail) {
      recipients.push(customerEmail);
    }

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Charbhuja Marketing'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
      to: recipients.join(', '),
      subject: `Order Confirmation #${orderData.orderNumber} - ${orderData.customerName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">Order Confirmation #${orderData.orderNumber}</h2>
          
          <p>Hello ${orderData.customerName},</p>
          <p>Thank you for your order! We have received your request and are processing it.</p>

          <div style="margin: 20px 0; background: #f9fafb; padding: 15px; border-radius: 8px;">
            <p><strong>Order Number:</strong> #${orderData.orderNumber}</p>
            <p><strong>Customer:</strong> ${orderData.customerName}</p>
            <p><strong>Mobile:</strong> ${orderData.mobile}</p>
            <p><strong>Address:</strong> ${orderData.address}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #eee;">Item</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #eee;">Service</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #eee;">Qty</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #eee;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 15px 10px; text-align: right; font-weight: bold;">Total Amount:</td>
                <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #4f46e5; font-size: 18px;">₹${orderData.totalAmount}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #9ca3af; text-align: center;">
            <p>This is an automated order notification from your store.</p>
            <p>&copy; ${new Date().getFullYear()} ${process.env.MAIL_FROM_NAME || 'Charbhuja Marketing'}</p>
          </div>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Order notification sent successfully' });
    } catch (error: any) {
      console.error('Order notification error:', error);
      res.status(500).json({ error: 'Failed to send order notification', details: error.message });
    }
  });
  
  // Proxy API for Custom WhatsApp to bypass CORS
  app.post('/api/send-custom-whatsapp', async (req, res) => {
    const { config, to, message } = req.body;

    if (!config || !config.baseUrl || !config.accessToken || !to || !message) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
      let targetUrl = config.baseUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      console.log(`Proxying WhatsApp to: ${targetUrl} for number: ${to}`);
      const payload = {
        vendor_uid: config.vendorUid,
        to: to,
        message: message
      };
      console.log('Sending Payload to External API:', JSON.stringify(payload, null, 2));

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('External API Response:', data);
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('Custom WhatsApp Proxy Error:', error);
      res.status(500).json({ 
        error: 'Failed to send WhatsApp message via proxy', 
        details: error.message,
        baseUrl: config.baseUrl 
      });
    }
  });

  // Proxy API for Meta WhatsApp to bypass CORS
  app.post('/api/send-meta-whatsapp', async (req, res) => {
    const { config, to, customerName, orderSummary } = req.body;

    if (!config || !config.accessToken || !config.phoneNumberId || !to) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const url = `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: config.templateName,
        language: {
          code: config.languageCode || "en_US"
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: customerName },
              { type: "text", text: orderSummary }
            ]
          }
        ]
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Meta WhatsApp Proxy Error:', error);
      res.status(500).json({ error: 'Failed to send Meta WhatsApp message via proxy', details: error.message });
    }
  });

  // API to send Order Status Update
  app.post('/api/send-status-update', async (req, res) => {
    const { customerEmail, orderData, newStatus } = req.body;

    if (!customerEmail || !orderData || !newStatus) {
      return res.status(400).json({ error: 'Customer email, order data and new status are required' });
    }

    const statusLabels: { [key: string]: string } = {
      pending: 'Pending',
      receive: 'Received',
      processing: 'Processing',
      ready: 'Ready for Delivery',
      delivery: 'Delivered'
    };

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Charbhuja Marketing'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
      to: customerEmail,
      subject: `Order Status Updated: #${orderData.orderNumber} is now ${statusLabels[newStatus] || newStatus}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">Order Status Update</h2>
          
          <p>Hello ${orderData.customerName},</p>
          <p>Your order <strong>#${orderData.orderNumber}</strong> status has been updated to: <strong style="color: #4f46e5; font-size: 18px;">${statusLabels[newStatus] || newStatus}</strong></p>

          <div style="margin: 20px 0; background: #f9fafb; padding: 15px; border-radius: 8px;">
            <p><strong>Order Number:</strong> #${orderData.orderNumber}</p>
            <p><strong>Total Amount:</strong> ₹${orderData.totalAmount}</p>
            <p><strong>Items:</strong> ${orderData.items.length} items</p>
          </div>

          <p>We will keep you updated on further progress.</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #9ca3af; text-align: center;">
            <p>This is an automated status update from your store.</p>
            <p>&copy; ${new Date().getFullYear()} ${process.env.MAIL_FROM_NAME || 'Charbhuja Marketing'}</p>
          </div>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Status update email sent successfully' });
    } catch (error: any) {
      console.error('Status update email error:', error);
      res.status(500).json({ error: 'Failed to send status update email', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
