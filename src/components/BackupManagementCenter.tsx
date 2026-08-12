import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Download,
  Upload,
  Archive,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RotateCcw,
  FileCheck,
  FolderCheck,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import { User } from '../types';

interface BackupStatusResponse {
  success: boolean;
  metrics: {
    totalUsers: number;
    totalCustomers: number;
    totalActivities: number;
    totalArchived: number;
    totalTasks: number;
    totalRecords: number;
    estimatedSizeBytes: number;
    estimatedSizeMB: string;
    capacityPercent: number;
    thresholdAlert: 'ok' | 'warning' | 'danger';
    maxCapacityRecords: number;
  };
  backupConfig: {
    lastBackupAt?: string;
    nextBackupAt?: string;
    backupScheduleDays?: number;
    autoBackupEnabled?: boolean;
    autoArchiveEnabled?: boolean;
    retentionDays?: number;
    lastBackupStatus?: string;
    lastBackupFolder?: string;
    lastBackupFileName?: string;
    lastBackupSizeBytes?: number;
    archivedRecordsCount?: number;
  };
  backupAuditLogs: Array<{
    id: string;
    timestamp: string;
    triggeredBy: string;
    backupFolder: string;
    fileName: string;
    fileSizeBytes?: number;
    recordsCount: number;
    archivedCount: number;
    status: string;
    verificationStatus: string;
    errorDetails?: string;
  }>;
}

interface BackupManagementCenterProps {
  currentUser?: User;
}

export const BackupManagementCenter: React.FC<BackupManagementCenterProps> = ({ currentUser }) => {
  const [statusData, setStatusData] = useState<BackupStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Archive Explorer State
  const [archivedRecords, setArchivedRecords] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonText, setRestoreJsonText] = useState('');

  const fetchBackupStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/status');
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch (err: any) {
      console.error('Error fetching backup status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedRecords = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/backup/archived?search=${encodeURIComponent(archiveSearch)}`);
      const data = await res.json();
      if (data.success) {
        setArchivedRecords(data.archivedRecords || []);
      }
    } catch (err) {
      console.error('Error fetching archived records:', err);
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
    fetchArchivedRecords();
  }, []);

  const handleRunBackup = async () => {
    setActionLoading(true);
    setAlertMessage(null);
    try {
      const res = await fetch('/api/backup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggeredBy: `${currentUser?.name || 'مدير النظام'} (تشغيل يدوي)`,
          performedByEmail: currentUser?.email,
          performedByName: currentUser?.name,
          performArchiving: true
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage({
          type: 'success',
          text: `تم إنشاء وتأكيد النسخة الاحتياطية بنجاح! الملف: ${data.filename} (${data.recordsCount} سجل، أُرشف ${data.archivedCount} سجل قديم).`
        });
        fetchBackupStatus();
        fetchArchivedRecords();
      } else {
        setAlertMessage({ type: 'error', text: data.error || 'فشل تشغيل النسخ الاحتياطي' });
      }
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الاتصال بالسيرفر' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/backup/download', '_blank');
  };

  const handleRestoreArchivedRecord = async (recordId: string, refCode: string) => {
    if (!confirm(`هل أنت متأكد من استعادة السجل (${refCode || recordId}) من الأرشيف إلى القائمة النشطة؟`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/backup/restore-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          performedByEmail: currentUser?.email,
          performedByName: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage({ type: 'success', text: `تمت استعادة السجل (${refCode || recordId}) إلى الجدول النشط بنجاح!` });
        fetchBackupStatus();
        fetchArchivedRecords();
      } else {
        setAlertMessage({ type: 'error', text: data.error || 'فشل استعادة السجل' });
      }
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'خطأ في الاتصال' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreJsonText(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreJsonText.trim()) {
      alert('يرجى تحديد ملف أو لصق محتوى النسخة الاحتياطية أولاً');
      return;
    }

    try {
      const parsed = JSON.parse(restoreJsonText);
      if (!confirm('تأكيد هام: هل أنت متأكد من استعادة كافة بيانات النظام من هذه النسخة؟ سيتم الدمج مع الحفاظ الكامل على كافة حسابات الموظفين الحالية.')) {
        return;
      }

      setActionLoading(true);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupData: parsed,
          performedByEmail: currentUser?.email,
          performedByName: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage({ type: 'success', text: `تمت استعادة حالة النظام بنجاح! السجلات النشطة: ${data.customersCount}، الموظفون: ${data.usersCount}.` });
        setShowRestoreModal(false);
        setRestoreJsonText('');
        fetchBackupStatus();
        fetchArchivedRecords();
      } else {
        setAlertMessage({ type: 'error', text: data.error || 'فشل استعادة النظام' });
      }
    } catch (err: any) {
      alert('الملف غير صالح أو التنسيق غير مطابق لـ JSON: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const metrics = statusData?.metrics;
  const config = statusData?.backupConfig;
  const logs = statusData?.backupAuditLogs || [];

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2c2824] via-[#3a3530] to-[#2c2824] text-white p-6 rounded-3xl shadow-xl border border-[#8c622b]/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#8c622b]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
              <ShieldCheck className="w-5 h-5 animate-pulse" />
              <span>نظام حماية البيانات والأرشفة التلقائية (Production Security & Disaster Recovery)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-amber-100">
              مركز النسخ الاحتياطي التلقائي ومراقبة السعة البيانية 🛡️
            </h2>
            <p className="text-xs text-amber-200/80 mt-1 max-w-2xl">
              تخزين دائم عبر Google Cloud Firestore + نسَخ احتياطية دورية كل 3 أيام الساعة 12:00 AM في مجلد الشركات الرائد <span className="font-mono underline text-amber-300">Production CRM Backups</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBackup}
              disabled={actionLoading}
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold py-3 px-5 rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>تشغيل نسخة احتياطية فورية الآن</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="bg-[#3d3731] hover:bg-[#4a433c] text-amber-300 border border-amber-500/30 text-xs font-bold py-3 px-4 rounded-2xl shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف النسخة (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Notification Message */}
      {alertMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between shadow-md ${
            alertMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <span>{alertMessage.text}</span>
          </div>
          <button onClick={() => setAlertMessage(null)} className="text-slate-400 hover:text-white font-bold text-sm px-2">
            ✕
          </button>
        </div>
      )}

      {/* Active Capacity & Permanent Rules Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Capacity Gauge Meter */}
        <div className="md:col-span-2 bg-[#f8f5ee] border-2 border-[#e2d8c7] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#8c622b]" />
              <h3 className="text-sm font-bold text-[#2c2824]">سعة ومساحة قاعدة البيانات النشطة</h3>
            </div>
            {metrics && (
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  metrics.thresholdAlert === 'danger'
                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                    : metrics.thresholdAlert === 'warning'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {metrics.thresholdAlert === 'danger'
                  ? '⚠️ تحذير: سعة حرجة (90%+)'
                  : metrics.thresholdAlert === 'warning'
                  ? '⚡ تنبيه: ارتفعت السعة عن 70%'
                  : '✅ السعة متزنة وآمنة'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-[#2c2824]">
              <span>السجلات النشطة الحالية: {metrics?.totalRecords || 0} سجل</span>
              <span>{metrics?.capacityPercent || 0}% مستخدمة ({metrics?.estimatedSizeMB || '0'} MB)</span>
            </div>
            <div className="w-full bg-[#e8e0d0] rounded-full h-3 overflow-hidden p-0.5 border border-[#d8cebe]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (metrics?.capacityPercent || 0) >= 90
                    ? 'bg-rose-600'
                    : (metrics?.capacityPercent || 0) >= 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.max(5, metrics?.capacityPercent || 0)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[11px] font-bold">
            <div className="bg-white p-2 rounded-xl border border-[#e2d8c7]">
              <span className="text-[#6e685f] block text-[10px]">الموظفون</span>
              <span className="text-[#8c622b] text-sm">{metrics?.totalUsers || 0}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#e2d8c7]">
              <span className="text-[#6e685f] block text-[10px]">العملاء والملاك</span>
              <span className="text-[#2c2824] text-sm">{metrics?.totalCustomers || 0}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#e2d8c7]">
              <span className="text-[#6e685f] block text-[10px]">النشاطات والمكالمات</span>
              <span className="text-emerald-700 text-sm">{metrics?.totalActivities || 0}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#e2d8c7]">
              <span className="text-[#6e685f] block text-[10px]">الأرشيف التاريخي</span>
              <span className="text-amber-800 text-sm">{metrics?.totalArchived || 0}</span>
            </div>
          </div>
        </div>

        {/* Employee Protection Assurance Card */}
        <div className="bg-[#fffbf0] border-2 border-amber-500/40 rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>حماية حسابات الموظفين (Permanent Employees)</span>
            </div>
            <p className="text-[11px] text-[#2c2824] leading-relaxed font-medium">
              حسابات الموظفين (Users) دائمة ومحمية من الحذف أو الأرشفة نهائياً. يتم إبقاء جميع بيانات الدخول والصلاحيات والأكواد دون أي مساس.
            </p>
          </div>
          <div className="bg-amber-100/80 text-amber-900 text-[10px] font-extrabold p-2 rounded-xl border border-amber-300 text-center">
            🔒 Employee Accounts 100% Protected
          </div>
        </div>

        {/* Scheduled Automation Card */}
        <div className="bg-[#f8f5ee] border-2 border-[#e2d8c7] rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2c2824] flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#8c622b]" />
                جدول النسخ الآلي
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                نشط كل 3 أيام
              </span>
            </div>
            <div className="text-[11px] text-[#6e685f] space-y-1">
              <div>آخر نسخ: <strong className="text-[#2c2824]">{config?.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString('ar-EG') : 'قيد الانتظار'}</strong></div>
              <div>النسخ القادم: <strong className="text-[#8c622b]">{config?.nextBackupAt ? new Date(config.nextBackupAt).toLocaleString('ar-EG') : '12:00 AM (3 أيام)'}</strong></div>
              <div>المجلد: <strong className="text-[#2c2824] font-mono text-[10px]">{config?.lastBackupFolder || 'Production CRM Backups/'}</strong></div>
            </div>
          </div>
          <div className="bg-white text-[10px] text-slate-700 font-bold p-2 rounded-xl border border-[#d8cebe] text-center flex items-center justify-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>الحالة: {config?.lastBackupStatus || 'مؤكد وسليم'}</span>
          </div>
        </div>
      </div>

      {/* Historical Archive Explorer & Restore Controls */}
      <div className="bg-white border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e2d8c7]">
          <div>
            <h3 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#8c622b]" />
              <span>أرشيف البيانات التاريخية والمستعادة ({archivedRecords.length} سجل ملموم)</span>
            </h3>
            <p className="text-xs text-[#6e685f]">
              يحتفظ النظام بالسجلات القديمة أو المغلقة بأمان دون حذف لتقليل حجم Firestore النشط، ويمكن استعادتها للجدول بضغطة زر.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8c622b] absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث بالكود، الهاتف، الاسم..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchArchivedRecords()}
                className="pr-9 pl-3 py-2 bg-[#f8f5ee] border border-[#d8cebe] rounded-xl text-xs font-semibold text-[#2c2824] focus:outline-none focus:ring-2 focus:ring-[#8c622b] w-60"
              />
            </div>
            <button
              onClick={fetchArchivedRecords}
              className="bg-[#f2ece1] hover:bg-[#e8decb] text-[#704d1f] font-bold text-xs p-2 rounded-xl border border-[#d8cebe]"
            >
              <RefreshCw className={`w-4 h-4 ${archiveLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowRestoreModal(true)}
              className="bg-[#3d3731] hover:bg-[#2c2824] text-amber-200 text-xs font-bold py-2 px-3 rounded-xl border border-amber-500/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>استعادة نسخة كاملة</span>
            </button>
          </div>
        </div>

        {/* Archived Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#e2d8c7]">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#f8f5ee] text-[#704d1f] font-bold border-b border-[#e2d8c7]">
              <tr>
                <th className="p-3">الكود المرجعي</th>
                <th className="p-3">رقم العميل/الوحدة</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">الموظف المسؤول</th>
                <th className="p-3">تاريخ الأرشفة</th>
                <th className="p-3 text-center">اللاجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2d8c7]">
              {archivedRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-[#6e685f] font-medium">
                    لا توجد سجلات مؤرشفة تنطبق على البحث الحالي. قاعدة البيانات النشطة تحتوي كافة السجلات.
                  </td>
                </tr>
              ) : (
                archivedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-[#fcfaf5] transition-colors">
                    <td className="p-3 font-mono font-bold text-[#8c622b]">{item.refCode || 'N/A'}</td>
                    <td className="p-3 font-bold text-[#2c2824]">{item.customerNumber}</td>
                    <td className="p-3 font-mono dir-ltr text-right">{item.phone}</td>
                    <td className="p-3 text-[#6e685f]">{item.assignedToName || item.assignedToEmail || 'غير معين'}</td>
                    <td className="p-3 text-[#6e685f]">{item.archivedAt ? new Date(item.archivedAt).toLocaleString('ar-EG') : 'مؤرشف'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRestoreArchivedRecord(item.id, item.refCode || item.customerNumber)}
                        disabled={actionLoading}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 mx-auto shadow cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة للجدول النشط</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification & Backup Audit History Log Table */}
      <div className="bg-white border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e2d8c7]">
          <div>
            <h3 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-700" />
              <span>سجل تأكيد والتحقق من عمليات النسخ والنسخ الاحتياطية (Audit Verification Logs)</span>
            </h3>
            <p className="text-xs text-[#6e685f]">
              يوثق كل عملية نسخ احتياطي، حجم البيانات، حالة التحقق التلقائي 100% ورقم المجلد.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e2d8c7]">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#f8f5ee] text-[#704d1f] font-bold border-b border-[#e2d8c7]">
              <tr>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">المُشغِّل</th>
                <th className="p-3">اسم وملف النسخة</th>
                <th className="p-3">عدد السجلات</th>
                <th className="p-3">عدد المؤرشف</th>
                <th className="p-3">نتيجة التحقق (Verification)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2d8c7]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-[#6e685f]">
                    سجل عمليات النسخ الاحتياطي فارغ حالياً. اضغط "تشغيل نسخة احتياطية فورية الآن" للإنشاء وتوثيق الحالة.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#fcfaf5]">
                    <td className="p-3 font-mono text-[#2c2824]">{new Date(log.timestamp).toLocaleString('ar-EG')}</td>
                    <td className="p-3 font-bold text-[#8c622b]">{log.triggeredBy}</td>
                    <td className="p-3 font-mono text-[11px] text-[#6e685f]">{log.fileName}</td>
                    <td className="p-3 font-bold text-[#2c2824]">{log.recordsCount} سجل</td>
                    <td className="p-3 text-amber-800 font-bold">{log.archivedCount} سجل</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {log.verificationStatus || log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full State Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white border-2 border-[#8c622b] rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-[#2c2824] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#8c622b]" />
                <span>استعادة كاملة للنظام من نسخة احتياطية (JSON)</span>
              </h3>
              <button onClick={() => setShowRestoreModal(false)} className="text-slate-400 hover:text-black font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 leading-relaxed font-bold">
                🔒 ضمان الأمان: استعادة النسخة الاحتياطية ستقوم بدمج البيانات مع الحفاظ على كافة حسابات الموظفين الحالية (Users) وتعيين أذوناتهم دون أي فقدان.
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">رفع ملف النسخة الاحتياطية (.json):</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-700 p-2 bg-[#f8f5ee] border border-[#d8cebe] rounded-xl cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">أو لصق نص الـ JSON المباشر:</label>
                <textarea
                  rows={6}
                  value={restoreJsonText}
                  onChange={(e) => setRestoreJsonText(e.target.value)}
                  placeholder='{"users": [...], "customers": [...]}'
                  className="w-full p-3 bg-[#f8f5ee] border border-[#d8cebe] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#8c622b]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="bg-[#f2ece1] hover:bg-[#e8decb] text-[#2c2824] font-bold text-xs py-2.5 px-4 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={actionLoading || !restoreJsonText.trim()}
                className="bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'جاري الاستعادة...' : 'تأفيذ استعادة البيانات والتحديث'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
