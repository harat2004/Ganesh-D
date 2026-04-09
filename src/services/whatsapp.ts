import { MetaWhatsAppConfig, ApiConfig } from '../types';

export const sendCustomApiMessage = async (
  config: ApiConfig,
  to: string,
  message: string
) => {
  if (!config.isConnected || !config.accessToken || !config.baseUrl) {
    console.warn('Custom API is not fully configured or connected.');
    return false;
  }

  const cleanPhone = to.replace(/\D/g, '');
  
  try {
    const response = await fetch('/api/send-custom-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config,
        to: cleanPhone,
        message: message
      })
    });
    
    const data = await response.json();
    console.log('Custom API Message Sent via Proxy:', data);
    return true;
  } catch (error) {
    console.error('Error sending Custom API message via proxy:', error);
    return false;
  }
};

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
  
  try {
    const response = await fetch('/api/send-meta-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config,
        to: cleanPhone,
        customerName,
        orderSummary
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error('Meta WhatsApp API Error via Proxy:', data.error);
      return false;
    }
    
    console.log('Meta WhatsApp Message Sent via Proxy:', data);
    return true;
  } catch (error) {
    console.error('Error sending Meta WhatsApp message via proxy:', error);
    return false;
  }
};
