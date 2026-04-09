import { MetaWhatsAppConfig, ApiConfig } from '../types';

export const sendCustomApiMessage = async (
  config: ApiConfig,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  if (!config.isConnected || !config.accessToken || !config.baseUrl) {
    return { success: false, error: 'Custom API is not fully configured or connected.' };
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
    
    if (!response.ok) {
      console.error('Custom API Proxy Error Response:', data);
      return { success: false, error: data.details || data.error || 'Proxy server error' };
    }

    console.log('Custom API Message Sent via Proxy:', data);
    // Check if the actual API returned an error (some APIs return 200 but with error in body)
    if (data.status === 'error' || data.success === false || data.error) {
      console.error('Custom API Provider Error:', data);
      return { success: false, error: data.message || data.error || 'API Provider error' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending Custom API message via proxy:', error);
    // Log the error name and message specifically
    console.log('Error Name:', error.name);
    console.log('Error Message:', error.message);
    return { success: false, error: error.message || 'Network error' };
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
