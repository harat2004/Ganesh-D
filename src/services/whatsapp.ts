import { MetaWhatsAppConfig } from '../types';

export const sendMetaWhatsAppMessage = async (
  config: MetaWhatsAppConfig, 
  to: string, 
  customerName: string, 
  orderSummary: string
) => {
  if (!config.enabled || !config.accessToken || !config.phoneNumberId) {
    console.warn('Meta WhatsApp API is not fully configured or enabled.');
    return false;
  }

  // Meta API expects phone number without '+' and with country code
  const cleanPhone = to.replace(/\D/g, '');
  
  const url = `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
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
    if (data.error) {
      console.error('Meta WhatsApp API Error:', data.error);
      return false;
    }
    
    console.log('Meta WhatsApp Message Sent:', data);
    return true;
  } catch (error) {
    console.error('Error sending Meta WhatsApp message:', error);
    return false;
  }
};
