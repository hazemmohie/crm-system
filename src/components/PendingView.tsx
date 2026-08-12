import React, { useEffect } from 'react';
import { User } from '../types';
import { Clock, ShieldAlert, LogOut, CheckCircle2, RefreshCw } from 'lucide-react';

interface PendingViewProps {
  user: User;
  onLogout: () => void;
  onCheckStatus: () => void;
  onSwitchToAdmin: () => void;
}

export const PendingView: React.FC<PendingViewProps> = ({
  user,
  onLogout,
  onCheckStatus,
  onSwitchToAdmin,
}) => {
  // Check status periodically without overwhelming the app
  useEffect(() => {
    const timer = setInterval(() => {
      onCheckStatus();
    }, 15000);
    return () => clearInterval(timer);
  }, [onCheckStatus]);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f7f4ed] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#fcfbfa] border border-[#ded5c5] rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-lg relative overflow-hidden">
        
        <div className="inline-flex p-4 bg-[#8c622b]/10 border border-[#8c622b]/20 rounded-2xl text-[#8c622b] shadow-sm">
          <Clock className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#2c2824]">الحساب قيد المراجعة بانتظار موافقة المسؤول</h2>
          <p className="text-[#6e685f] text-xs leading-relaxed">
            مرحباً <span className="font-bold text-[#2c2824]">{user.name}</span> ({user.email}). 
            تم تسجيل دخولك بنجاح، ولكن يتطلب النظام موافقة مسئول الحساب الرئيسي قبل أن يتم تخصيص وتوزيع حصتك من أرقام العملاء.
          </p>
        </div>

        <div className="bg-[#f5efe4] rounded-2xl p-4 border border-[#e2d8c7] text-right space-y-2 text-xs">
          <div className="font-bold text-[#704d1f] flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-[#8c622b]" />
            حالة الحساب الآن:
          </div>
          <p className="text-[#2c2824]">
            • المسؤول عن الحساب: <span className="text-[#8c622b] font-mono font-bold">hazemmohie8@gmail.com</span>
          </p>
          <p className="text-[#6e685f]">
            • بمجرد موافقة المسؤول، سيتم تقسيم أرقام العملاء بالتساوي وإدراج حصتك في حسابك فوراً.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onCheckStatus}
            className="w-full flex items-center justify-center gap-2 bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث وتفقد موافقة المسؤول
          </button>

          <button
            onClick={onLogout}
            className="w-full text-xs text-[#6e685f] hover:text-rose-700 py-2 transition-colors flex items-center justify-center gap-1 cursor-pointer font-medium bg-[#eae3d5] hover:bg-[#dfd7c7] rounded-xl border border-[#d8cebe]"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج والعودة لتسجيل الدخول
          </button>
        </div>

      </div>
    </div>
  );
};
