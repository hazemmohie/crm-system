import React, { useState, useEffect } from 'react';
import { AiAgentPermissions, AiAgentPendingAction } from '../types';
import {
  ShieldCheck,
  Bot,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  RefreshCw,
  Check,
  X,
  Eye,
  Bell,
  Calendar,
  Users,
  AlertCircle
} from 'lucide-react';

interface AiAgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAgentSettingsModal: React.FC<AiAgentSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [permissions, setPermissions] = useState<AiAgentPermissions>({
    allowReadDatabase: true,
    allowDetectAnomalies: true,
    allowCreateTasks: true,
    allowSendNotifications: true,
    allowReassignLeads: true,
    allowModifyUserRoles: true,
    executionMode: 'auto',
    restrictScopeToWebAppOnly: true
  });

  const [pendingActions, setPendingActions] = useState<AiAgentPendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Load Permissions
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/ai-permissions');
      if (res.ok) {
        const data = await res.json();
        if (data.permissions) {
          setPermissions(prev => ({
            ...prev,
            allowReadDatabase: Boolean(data.permissions.allowReadDatabase ?? prev.allowReadDatabase),
            allowDetectAnomalies: Boolean(data.permissions.allowDetectAnomalies ?? prev.allowDetectAnomalies),
            allowCreateTasks: Boolean(data.permissions.allowCreateTasks ?? prev.allowCreateTasks),
            allowSendNotifications: Boolean(data.permissions.allowSendNotifications ?? prev.allowSendNotifications),
            allowReassignLeads: Boolean(data.permissions.allowReassignLeads ?? prev.allowReassignLeads),
            allowModifyUserRoles: Boolean(data.permissions.allowModifyUserRoles ?? prev.allowModifyUserRoles),
            executionMode: data.permissions.executionMode || prev.executionMode,
            restrictScopeToWebAppOnly: Boolean(data.permissions.restrictScopeToWebAppOnly ?? prev.restrictScopeToWebAppOnly)
          }));
        }
        if (data.pendingActions) setPendingActions(data.pendingActions);
      }
    } catch (err) {
      console.error('Error fetching AI permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
    }
  }, [isOpen]);

  // Save Permissions
  const handleSavePermissions = async () => {
    try {
      setIsSaving(true);
      setSaveMsg(null);
      const res = await fetch('/api/admin/ai-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      });

      if (res.ok) {
        setSaveMsg(' تم حفظ وتحديث صلاحيات ونطاق الـ AI Manager بنجاح');
        setTimeout(() => setSaveMsg(null), 4000);
      } else {
        setSaveMsg('حدث خطأ أثناء تحديث الصلاحيات');
      }
    } catch (err) {
      setSaveMsg('خطأ في الاتصال بالشبكة');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Approve Action
  const handleApproveAction = async (actionId: string) => {
    try {
      const res = await fetch('/api/admin/ai-pending-actions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      });
      if (res.ok) {
        await fetchPermissions();
      }
    } catch (err) {
      console.error('Error approving action:', err);
    }
  };

  // Handle Reject Action
  const handleRejectAction = async (actionId: string) => {
    try {
      const res = await fetch('/api/admin/ai-pending-actions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      });
      if (res.ok) {
        await fetchPermissions();
      }
    } catch (err) {
      console.error('Error rejecting action:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#fcfbfa] border border-[#dcd2c2] rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 dir-rtl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8dfcf] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#8c622b]/10 text-[#8c622b] rounded-xl border border-[#8c622b]/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
                <span>إعدادات وصلاحيات الـ AI Manager</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> محصور داخل الموقع فقط
                </span>
              </h3>
              <p className="text-xs text-[#6e685f] mt-0.5">
                تحديد الصلاحيات المسموحة للمساعد التنفيذي للذكاء الاصطناعي داخل التطبيق
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8a8377] hover:text-[#2c2824] text-xs font-bold px-2.5 py-1.5 bg-[#e8dfcf] hover:bg-[#d8cebe] rounded-xl transition-all"
          >
            إغلاق ✕
          </button>
        </div>

        {saveMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveMsg}</span>
          </div>
        )}

        {/* Scope Restriction Indicator */}
        <div className="p-4 bg-[#f4ede1] border border-[#dfd4c3] rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#8c622b] shrink-0 mt-0.5" />
          <div className="text-xs text-[#5c5449] leading-relaxed">
            <strong className="text-[#2c2824] block mb-0.5">نطاق العمل الآمن والأخلاقي:</strong>
            تم حصر وقيد جميع صلاحيات ومراقبة الـ AI Manager تماماً داخل قاعدة بيانات التطبيق والأنظمة الداخلية للموقع فقط. لا يمتلك أي وصول أو مراقبة لأي أجهزة أو مواقع خارجية.
          </div>
        </div>

        {/* Permissions Form */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#2c2824] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#8c622b]" />
            <span>صلاحيات القراءة والتنفيذ داخل التطبيق:</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Read DB */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowReadDatabase)}
                onChange={e => setPermissions({ ...permissions, allowReadDatabase: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">قراءة قاعدة البيانات والمتابعة</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">مراقبة الأنشطة، العملاء، وأداء الموظفين</span>
              </div>
            </label>

            {/* Detect Anomalies */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowDetectAnomalies)}
                onChange={e => setPermissions({ ...permissions, allowDetectAnomalies: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">كشف الثغرات وسرقة العملاء</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">رصد المشتبه بهم وإرسال تنبيهات سريعة</span>
              </div>
            </label>

            {/* Create Tasks */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowCreateTasks)}
                onChange={e => setPermissions({ ...permissions, allowCreateTasks: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">إسناد المهام وتحديد المواعيد</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">إنشاء مواعيد ومهام للموظفين تلقائياً</span>
              </div>
            </label>

            {/* Send Notifications */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowSendNotifications)}
                onChange={e => setPermissions({ ...permissions, allowSendNotifications: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">إرسال التنبيهات والإشعارات</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">تنبيه الموظفين والمدير بالإشعارات</span>
              </div>
            </label>

            {/* Reassign Leads */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowReassignLeads)}
                onChange={e => setPermissions({ ...permissions, allowReassignLeads: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">إعادة توزيع وتوجيه العملاء</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">تطبيق قواعد المهلة وتحديث الحصص</span>
              </div>
            </label>

            {/* Modify User Roles */}
            <label className="p-3 bg-[#faf7f0] border border-[#e8dfcf] rounded-xl flex items-start gap-3 cursor-pointer hover:bg-[#f3ede0]">
              <input
                type="checkbox"
                checked={Boolean(permissions.allowModifyUserRoles)}
                onChange={e => setPermissions({ ...permissions, allowModifyUserRoles: e.target.checked })}
                className="mt-1 accent-[#8c622b]"
              />
              <div>
                <span className="text-xs font-bold text-[#2c2824] block">تعديل أدوار وسقوف الموظفين</span>
                <span className="text-[11px] text-[#6e685f] block mt-0.5">تحديث السقف اليومي وصلاحيات الحسابات</span>
              </div>
            </label>
          </div>

          {/* Execution Mode Selector */}
          <div className="p-4 bg-[#f8f4ec] border border-[#e2d8c7] rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-[#2c2824] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8c622b]" />
              <span>نمط وشروط التنفيذ (Execution Governance):</span>
            </h4>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#2c2824]">
                <input
                  type="radio"
                  name="executionMode"
                  value="auto"
                  checked={permissions.executionMode === 'auto'}
                  onChange={() => setPermissions({ ...permissions, executionMode: 'auto' })}
                  className="accent-[#8c622b]"
                />
                <span>⚡ تنفيذ تلقائي مباشر (Auto Execution) - يطبق الإجراء فور إعطاء الأمر شفهياً أو نصياً</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#2c2824]">
                <input
                  type="radio"
                  name="executionMode"
                  value="require_approval"
                  checked={permissions.executionMode === 'require_approval'}
                  onChange={() => setPermissions({ ...permissions, executionMode: 'require_approval' })}
                  className="accent-[#8c622b]"
                />
                <span>🛡️ يتطلب موافقة وتأكيد المدير قبل التنفيذ (Require Admin Approval)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Pending Actions Approval Queue */}
        {pendingActions.length > 0 && (
          <div className="space-y-3 border-t border-[#e8dfcf] pt-4">
            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>إجراءات معلقة بانتظار موافقتك ({pendingActions.length}):</span>
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingActions.map(action => (
                <div key={action.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-[#2c2824]">{action.title}</h5>
                    <p className="text-[11px] text-[#6e685f] mt-0.5">{action.details}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveAction(action.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> موافقة
                    </button>
                    <button
                      onClick={() => handleRejectAction(action.id)}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#e8dfcf] pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#e8dfcf] hover:bg-[#d8cebe] text-[#2c2824] text-xs font-bold rounded-xl"
          >
            إلغاء
          </button>
          <button
            onClick={handleSavePermissions}
            disabled={isSaving}
            className="px-5 py-2 bg-[#8c622b] hover:bg-[#704d1f] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            {isSaving ? 'جاري الحفظ...' : 'تأكيد وحفظ الصلاحيات '}
          </button>
        </div>
      </div>
    </div>
  );
};
