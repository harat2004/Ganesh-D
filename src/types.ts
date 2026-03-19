export type UserRole = 'admin' | 'customer';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  mobile?: string;
  address?: string;
  isBlocked?: boolean;
  createdAt?: any;
}

export interface Item {
  id: string;
  name: string;
  service: string;
  price: number;
  showPriceToCustomer: boolean;
  createdAt?: any;
}

export interface OrderItem {
  itemName: string;
  service: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'pending' | 'processing' | 'completed';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  items: OrderItem[];
  totalQuantity: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: any;
  trackingId?: string;
}

export interface PopupConfig {
  imageUrl: string;
  text: string;
  link: string;
  show: boolean;
}

export interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  templateName: string;
  languageCode: string;
  enabled: boolean;
}

export interface Settings {
  shopName: string;
  logoUrl: string;
  address: string;
  contactNumber: string;
  whatsappApiUrl: string;
  metaWhatsAppConfig?: MetaWhatsAppConfig;
  popupConfig: PopupConfig;
  themeType: 'type1' | 'type2' | 'type3';
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}
