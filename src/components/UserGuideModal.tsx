import React from 'react';
import { BookOpen, CheckCircle, Shield, FileSpreadsheet, RefreshCw, Phone, MessageSquare, X } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl font-sans animate-fade-in">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-2 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">دليل استخدام ودورات عمل نظام التوزيع</h2>
            <p className="text-xs text-slate-400">شرح مبسط وخطوات واضحة للتعامل مع النظام بكل سهولة</p>
          </div>
        </div>

        {/* Steps for Admin or User */}
        {isAdmin ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              📌 دليل وظائف مسؤول النظام (Admin)
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">1</span>
                  الموافقة على الموظفين المعتمدين:
                </div>
                <p className="text-slate-400 pr-7">
                  عند تسجيل أي موظف جديد ببريد Gmail، يظهر في قسم "موافقة وإدارة الموظفين". بمجرد الضغط على "اعتماد وتوزيع"، يُدرج الموظف في القائمة ويحصل على حصته فوراً بالتساوي.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">2</span>
                  إدخال الأرقام أو ربط Google Sheets:
                </div>
                <p className="text-slate-400 pr-7">
                  من تبويب "Google Sheets"، ادخل رابط الشيت (تأكد من ضبط مشاركته لـ Anyone with link can view) ثم اضغط "جلب واستيراد". أو الصق الأرقام مباشرة بالتبويب المنسدل.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">3</span>
                  التوزيع التلقائي الصارم (شفل بالتساوي):
                </div>
                <p className="text-slate-400 pr-7">
                  النظام مقيّد بآلية صارمة: لو كان لديك 100 عميل و4 موظفين معتمدين، يحصل كل موظف على 25 عميل تلقائياً! ويمكنك ضغط زر "توزيع جميع الأرقام بالتساوي" بأي وقت لإعادة التوازن.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              📌 دليل استخدام الموظف (المبيعات)
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">1</span>
                  استلام الأرقام المخصصة لك فقط:
                </div>
                <p className="text-slate-400 pr-7">
                  تظهر لك شاشتك الرئيسية الخاصة بالأرقام الموزعة عليك. لن يرى زملائك أرقامك، ولن ترى أرقامهم لضمان تنظيم العمل.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">2</span>
                  الاتصال والتواصل المباشر عبر واتساب:
                </div>
                <p className="text-slate-400 pr-7">
                  اضغط على زر الهاتف للاتصال المباشر، أو زر واتساب الأخضر لفتح محادثة فورية مع العميل دون الحاجة لحفظ رقمه بالهاتف!
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">3</span>
                  إملاء الملاحظات بالصوت أو الكتابة:
                </div>
                <p className="text-slate-400 pr-7">
                  بعد التواصل، اختر نتيجة الاتصال (مهتم / لم يرد / تم التواصل) واكتب ملاحظتك، أو اضغط زر الميكروفون 🎤 للإملاء الصوتي السريع لتقوم الميزة بكتابة ملاحظتك آلياً.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>نظام توزيع محمي ومؤمن برمجياً</span>
          </div>
          <button
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl transition-colors"
          >
            فهمت، إغلاق الدليل
          </button>
        </div>

      </div>
    </div>
  );
};
