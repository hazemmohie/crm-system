import React, { useState } from 'react';
import { ShieldCheck, CheckSquare, FileText, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import { User } from '../types';

interface TermsAgreementModalProps {
  user: User;
  onAgree: () => Promise<void>;
}

export const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({ user, onAgree }) => {
  const [hasChecked, setHasChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChecked) return;
    setSubmitting(true);
    try {
      await onAgree();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 dir-rtl font-sans animate-fade-in">
      <div className="max-w-xl w-full bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">ميثاق واتفاقية استخدام نظام توزيع العملاء</h2>
          <p className="text-xs text-slate-400">
            أهلاً بك <span className="text-emerald-400 font-semibold">{user.name}</span>! يرجى قراءة الشروط والالتزام بها قبل متابعة استخدام النظام.
          </p>
        </div>

        {/* Terms Box */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4 max-h-60 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          
          <div className="flex items-start gap-3">
            <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-100 block mb-0.5">1. نظام التوزيع التلقائي الصارم:</span>
              يُقر الموظف بأن النظام يقوم بتقسيم وتوزيع جميع أرقام العملاء بالتساوي تماماً وبشكل آلي صارم بين الموظفين المعتمدين فور الموافقة عليهم.
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-slate-700/60 pt-3">
            <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-100 block mb-0.5">2. السرية والأمانة الرقمية:</span>
              يتم التعامل مع كافة أرقام وبيانات العملاء بشرية وسرية تامة، ويحظر تماماً تصديرها أو مشاركتها خارج النظام.
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-slate-700/60 pt-3">
            <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-100 block mb-0.5">3. الالتزام بتدوين نتائج الاتصال:</span>
              يتعهد الموظف بالتواصل مع العملاء المخصصين له وتسجيل الملاحظة والتحديث فور كل مكالمة لضمان التتبع الدقيق.
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-slate-700/60 pt-3">
            <div className="p-1 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-100 block mb-0.5">4. اعتماد الحساب من المسؤول:</span>
              تسجيل الدخول يمنحك حساماً قيد الانتظار لحين اعتماد المسؤول له لتصلك حصتك المخصصة من الأرقام.
            </div>
          </div>

        </div>

        {/* Checkbox Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="flex items-start gap-3 bg-slate-800/40 border border-slate-700 p-3.5 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-colors">
            <input
              type="checkbox"
              checked={hasChecked}
              onChange={(e) => setHasChecked(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span className="text-xs text-slate-200 font-semibold leading-normal">
              لقد قرأت جميع الشروط والميثاق الموضح أعلاه، وأوافق وألتزم بها تماماً للبدء في استخدام النظام.
            </span>
          </label>

          <button
            type="submit"
            disabled={!hasChecked || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>جاري الحفظ والاعتماد...</span>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                <span>أوافق والتزم بالشروط والمتابعة</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
