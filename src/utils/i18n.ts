import { useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    brandTitle: 'DeepRoots CRM Real Estate',
    brandSubtitle: 'منظومة إدارة العملاء والعقارات والتوزيع المباشر',
    login: 'تسجيل الدخول',
    register: 'حساب جديد',
    clientRequest: 'تقديم طلب عقار',
    welcomeBack: 'مرحباً بك مجدداً',
    dashboard: 'لوحة التحكم',
    adminDashboard: 'لوحة تحكم المسؤول',
    userDashboard: 'لوحة المبيعات والعملاء',
    pendingApproval: 'الحساب قيد المراجعة',
    pendingMsg: 'حسابك بانتظار اعتماد المالك لتفعيل الصلاحيات.',
    logout: 'تسجيل الخروج',
    guide: 'دليل النظام',
    sharedExchange: 'سوق الطلبات المشتركة',
    notifications: 'التنبيهات',
    noNotifs: 'لا توجد تنبيهات حالياً',
    search: 'بحث...',
    filter: 'تصفية',
    addCustomer: 'إضافة عميل جديد',
    exportExcel: 'تصدير Excel',
    importExcel: 'استيراد Excel',
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    status: 'الحالة',
    phone: 'رقم الهاتف',
    email: 'البريد الإلكتروني',
    name: 'الاسم',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    role: 'الصلاحية',
    actions: 'الإجراءات',
    admin: 'أدمن',
    employee: 'موظف مبيعات',
    supervisor: 'مشرف مبيعات',
    langToggle: 'English',
    themeCalm: 'المظهر الهادئ',
  },
  en: {
    brandTitle: 'DeepRoots CRM Real Estate',
    brandSubtitle: 'Real Estate Sales & Lead Management System',
    login: 'Sign In',
    register: 'Create Account',
    clientRequest: 'Submit Property Request',
    welcomeBack: 'Welcome Back',
    dashboard: 'Dashboard',
    adminDashboard: 'Executive Admin Dashboard',
    userDashboard: 'Sales & Customer Workspace',
    pendingApproval: 'Account Pending Approval',
    pendingMsg: 'Your account is pending admin authorization.',
    logout: 'Sign Out',
    guide: 'System Guide',
    sharedExchange: 'Shared Requests Market',
    notifications: 'Notifications',
    noNotifs: 'No active notifications',
    search: 'Search...',
    filter: 'Filter',
    addCustomer: 'Add New Customer',
    exportExcel: 'Export Excel',
    importExcel: 'Import Excel',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    status: 'Status',
    phone: 'Phone Number',
    email: 'Email Address',
    name: 'Full Name',
    username: 'Username',
    password: 'Password',
    role: 'Role',
    actions: 'Actions',
    admin: 'Admin',
    employee: 'Sales Agent',
    supervisor: 'Supervisor',
    langToggle: 'العربية',
    themeCalm: 'Calm Theme',
  }
};

export function getStoredLanguage(): Language {
  const saved = localStorage.getItem('app_language');
  if (saved === 'en' || saved === 'ar') return saved;
  return 'ar';
}

export function setStoredLanguage(lang: Language) {
  localStorage.setItem('app_language', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
