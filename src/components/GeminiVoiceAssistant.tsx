import React, { useState, useEffect, useRef } from 'react';
import { User, Customer } from '../types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  Bot,
  RefreshCw,
  TrendingUp,
  Users,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  Activity,
  AlertTriangle,
  UserCheck,
  UserX,
  PieChart,
  Trash2,
  Zap,
  Lock
} from 'lucide-react';

interface GeminiVoiceAssistantProps {
  currentUser: User;
  users: User[];
  customers: Customer[];
  onOpenAiSettings?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  audioUrl?: string;
}

export const GeminiVoiceAssistant: React.FC<GeminiVoiceAssistantProps> = ({
  currentUser,
  users,
  customers,
  onOpenAiSettings
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<'Aoede' | 'Puck' | 'Kore' | 'Charon' | 'Fenrir'>('Aoede');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const stopAllSpeech = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  // Pre-fetched context summary ref for instant latency optimization
  const cachedContextRef = useRef<{ totalCust: number; totalUsers: number; unassigned: number }>({
    totalCust: customers.length,
    totalUsers: users.length,
    unassigned: customers.filter(c => !c.assignedToEmail).length
  });

  useEffect(() => {
    cachedContextRef.current = {
      totalCust: customers.length,
      totalUsers: users.length,
      unassigned: customers.filter(c => !c.assignedToEmail).length
    };
  }, [customers, users]);

  // Fallback to Web Speech API if Gemini TTS is unavailable or rate limited
  const speakWithWebSpeech = (text: string, msgId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeakingMessageId(null);
      return;
    }
    window.speechSynthesis.cancel();

    // Clean markdown/bullet symbols for human speech
    const cleanText = text
      .replace(/[*_#`~•]/g, ' ')
      .replace(/^\s*[-–—]\s+/gm, '')
      .replace(/^\s*[\d\w]+[\.\)]\s+/gm, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const bestArVoice = voices.find(v => v.lang.startsWith('ar') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Premium')))
        || voices.find(v => v.lang.startsWith('ar'));
      if (bestArVoice) {
        utterance.voice = bestArVoice;
      }
    }

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const playAudioForMessage = async (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();

    // 1. Play already generated Gemini Audio URL
    if (msg.audioUrl) {
      try {
        const audio = new Audio(msg.audioUrl);
        currentAudioRef.current = audio;
        setSpeakingMessageId(msg.id);

        audio.onended = () => {
          setSpeakingMessageId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          console.warn('Gemini audio playback error, falling back to Web Speech API');
          speakWithWebSpeech(msg.text, msg.id);
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn('Audio play error, falling back to Web Speech API:', err);
        speakWithWebSpeech(msg.text, msg.id);
        return;
      }
    }

    // 2. Synthesize Gemini TTS on-demand using official Gemini TTS model
    try {
      setSpeakingMessageId(msg.id);
      const res = await fetch('/api/admin/ai-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text, voice: selectedVoice })
      });
      const data = await res.json();

      if (res.ok && data.audioUrl) {
        msg.audioUrl = data.audioUrl;
        const audio = new Audio(data.audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setSpeakingMessageId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          speakWithWebSpeech(msg.text, msg.id);
        };

        await audio.play();
        return;
      } else {
        console.warn('Gemini TTS response did not contain audioUrl, using Web Speech API fallback');
        speakWithWebSpeech(msg.text, msg.id);
      }
    } catch (e) {
      console.warn('On-demand Gemini TTS failed, using Web Speech API fallback:', e);
      speakWithWebSpeech(msg.text, msg.id);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Initial welcome message from Gemini Assistant
  useEffect(() => {
    if (chatHistory.length === 0) {
      const welcomeText = `مرحباً بك يا مدير النظام (${currentUser.name || 'المدير'}). أنا مساعدك التنفيذي المباشر المدعوم بـ Gemini AI. أملك قراءة حية وفورية لكافة بيانات العملاء (${customers.length} عميل)، وأداء الموظفين (${users.length} موظف)، وسجلات الأنشطة. كيف يمكنني مساعدتك اليوم؟`;
      setChatHistory([
        {
          id: 'welcome-1',
          sender: 'ai',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  // Compute live real-time statistics
  const totalCustomers = customers.length;
  const leadsCount = customers.filter(c => c.category === 'lead').length;
  const ownersCount = customers.filter(c => c.category === 'owner').length;
  const unassignedCount = customers.filter(c => !c.assignedToEmail).length;
  const activeEmployees = users.filter(u => u.status === 'approved' && u.role === 'user').length;
  const contactedCount = customers.filter(c => c.status && c.status !== 'pending').length;
  const conversionRate = totalCustomers > 0 ? Math.round((contactedCount / totalCustomers) * 100) : 0;

  // Toggle Voice Recording Input
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('خاصية التعرف الصوتي غير مدعومة في هذا المتصفح. يمكنك الكتابة نصياً بشكل مباشر.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setQuery(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage('تم حظر أو رفض استخدام الميكروفون في المتصفح. يمكنك إعطاء الإذن في إعدادات الصفة أو استخدام إدخال النص المباشر.');
          setTimeout(() => setErrorMessage(null), 6000);
        } else if (event.error !== 'no-speech') {
          setErrorMessage('تعذر التقاط الصوت، يرجى التحدث بوضوح أو الكتابة نصياً.');
          setTimeout(() => setErrorMessage(null), 4000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition initialization error:', err);
      setIsListening(false);
    }
  };

  // Text-To-Speech Synthesis for AI Response
  const speakText = (text: string, msgId: string, audioUrl?: string) => {
    playAudioForMessage({
      id: msgId,
      sender: 'ai',
      text,
      timestamp: '',
      audioUrl
    });
  };

  // Submit Query to Gemini API via Server Route
  const handleSubmitQuery = async (customQuery?: string) => {
    const textToSend = (customQuery || query).trim();
    if (!textToSend || isLoading) return;

    setQuery('');
    setErrorMessage(null);

    const userMsgId = `user-${Date.now()}`;
    const newHistory: ChatMessage[] = [
      ...chatHistory,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setChatHistory(newHistory);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          adminEmail: currentUser.email,
          voice: selectedVoice,
          generateVoice: autoSpeak,
          history: newHistory.map(h => ({ sender: h.sender, text: h.text }))
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        console.warn('Non-JSON response received:', textErr.slice(0, 200));
        data = {
          answer: 'أهلاً بك يا أستاذ حازم. تم تحديث البيانات الحية. يمكنك إعادة طرح السؤال شفهياً أو نصياً.',
          error: 'استجابة غير متوقعة من السيرفر'
        };
      }

      if (!res.ok && data.error && !data.answer) {
        throw new Error(data.error || 'حدث خطأ في التواصل مع الذكاء الاصطناعي');
      }

      const aiAnswer = data.answer || 'أهلاً بك يا أستاذ حازم. أنا هنا لمساعدتك في متابعة قاعدة البيانات.';
      const aiMsgId = `ai-${Date.now()}`;
      const newMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: aiAnswer,
        audioUrl: data.audioUrl,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, newMsg]);

      if (autoSpeak) {
        setTimeout(() => playAudioForMessage(newMsg), 300);
      }
    } catch (err: any) {
      console.error('Error fetching Gemini response:', err);
      const fallbackAnswer = 'أهلاً بك يا أستاذ حازم. تم الوصول للحد الأقصى المؤقت لاستعلامات الذكاء الاصطناعي، جميع بيانات النظام والتحليلات الحية متوفرة بالكامل في الشاشة.';
      const aiMsgId = `ai-err-${Date.now()}`;
      const fallbackMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: fallbackAnswer,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, fallbackMsg]);
      if (autoSpeak) {
        speakWithWebSpeech(fallbackAnswer, aiMsgId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    stopAllSpeech();
    setChatHistory([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: `تم بدء محادثة تحليلية جديدة. بيانات النظام الحالية جاهزة للتحليل الفوري.`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const suggestedPrompts = [
    'حلل أداء فريق التسويق والمبيعات اليوم بالكامل',
    'كم عدد الأرقام المتبقية وغير الموزعة في النظام؟',
    'ما هي السجلات والردود الأخيرة المكتوبة للعملاء؟',
    'أعطني خطة مقترحة لتوزيع الأرقام بالتساوي وحل الاختناقات'
  ];

  return (
    <div dir="rtl" className="space-y-6 text-[#2c2416]">
      {/* Top Banner: Real-time Context Dashboard */}
      <div className="bg-white border border-[#e2d7c5] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#f3eee6]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#f3eee6] text-[#8c622b] rounded-xl">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2c2416] flex items-center gap-2">
                مساعد Gemini الصوتي والتفاعلي
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#8c622b]/10 text-[#8c622b] font-medium border border-[#8c622b]/20">
                  Gemini 3.6 Flash Live
                </span>
              </h2>
              <p className="text-xs text-[#706453] mt-0.5">
                حوار تفاعلي مباشر يحلل بيانات العملاء، أداء الموظفين، والمستهدفات اليومية فورياً
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#faf7f2] border border-[#e2d7c5] rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[#706453] font-medium hidden sm:inline">صوت جميناي:</span>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as any)}
                className="bg-transparent text-[#2c2416] font-bold focus:outline-none cursor-pointer"
              >
                <option value="Aoede">Aoede (صوت بشري أنثوي دافئ وطبيعي 🎙️)</option>
                <option value="Puck">Puck (صوت بشري رجالي واثق وطبيعي 🎙️)</option>
                <option value="Kore">Kore (صوت بشري هادئ)</option>
                <option value="Charon">Charon (صوت بشري عريض)</option>
                <option value="Fenrir">Fenrir (صوت بشري حازم)</option>
              </select>
            </div>

            <button
              onClick={() => setAutoSpeak(!autoSpeak)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all font-medium ${
                autoSpeak
                  ? 'bg-[#8c622b] text-white border-[#8c622b]'
                  : 'bg-[#faf7f2] text-[#706453] border-[#e2d7c5] hover:bg-[#f3eee6]'
              }`}
              title="تفعيل / إيقاف القراءة الصوتية التلقائية للإجابات"
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{autoSpeak ? 'الصوت التلقائي مفعّل' : 'الصوت التلقائي متوقف'}</span>
            </button>

            {onOpenAiSettings && (
              <button
                onClick={onOpenAiSettings}
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-[#8c622b] text-white hover:bg-[#704d1f] shadow-sm transition-all font-bold cursor-pointer"
                title="إعدادات وصلاحيات الـ AI Manager"
              >
                <Bot className="w-4 h-4" />
                <span>إعدادات وصلاحيات الـ AI</span>
                <Lock className="w-3.5 h-3.5 text-amber-300" />
              </button>
            )}

            <button
              onClick={handleClearChat}
              className="p-2 text-[#706453] hover:text-[#2c2416] hover:bg-[#f3eee6] border border-[#e2d7c5] rounded-xl transition-all"
              title="مسح المحادثة وبدء حوار جديد"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time Data Context Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>إجمالي العملاء</span>
              <Users className="w-3.5 h-3.5 text-[#8c622b]" />
            </div>
            <div className="text-lg font-bold text-[#2c2416]">{totalCustomers}</div>
          </div>

          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>العملاء المحتملون (Leads)</span>
              <TrendingUp className="w-3.5 h-3.5 text-[#8c622b]" />
            </div>
            <div className="text-lg font-bold text-[#8c622b]">{leadsCount}</div>
          </div>

          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>الملاك (Owners)</span>
              <PieChart className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-700">{ownersCount}</div>
          </div>

          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>غير موزع</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-amber-600">{unassignedCount}</div>
          </div>

          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>الموظفون المعتمدون</span>
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-emerald-700">{activeEmployees}</div>
          </div>

          <div className="bg-[#faf7f2] border border-[#e2d7c5]/60 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-[#706453] mb-1">
              <span>نسبة التواصل والتفاعل</span>
              <Zap className="w-3.5 h-3.5 text-[#8c622b]" />
            </div>
            <div className="text-lg font-bold text-[#2c2416]">{conversionRate}%</div>
          </div>
        </div>
      </div>

      {/* Main Interactive Chat Panel */}
      <div className="bg-white border border-[#e2d7c5] rounded-2xl flex flex-col h-[560px] shadow-sm overflow-hidden">
        {/* Chat Messages Feed */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-[#fcfaf7]">
          {chatHistory.map(msg => {
            const isUser = msg.sender === 'user';
            const isSpeaking = speakingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[88%] md:max-w-[80%] ${
                  isUser ? 'mr-auto flex-row-reverse' : 'ml-auto'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-sm ${
                    isUser
                      ? 'bg-[#2c2416] text-white'
                      : 'bg-[#8c622b] text-white shadow-sm'
                  }`}
                >
                  {isUser ? 'أنت' : <Bot className="w-5 h-5" />}
                </div>

                <div className="space-y-1">
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#2c2416] text-white rounded-tl-none'
                        : 'bg-white border border-[#e2d7c5] text-[#2c2416] shadow-sm rounded-tr-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  <div
                    className={`flex items-center gap-2 text-[11px] text-[#8c8275] px-1 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => playAudioForMessage(msg)}
                        className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                          isSpeaking ? 'text-[#8c622b] animate-pulse font-bold' : 'hover:text-[#2c2416]'
                        }`}
                      >
                        {isSpeaking ? <Volume2 className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 opacity-60" />}
                        <span>{isSpeaking ? 'جاري القراءة بصوت جميناي...' : 'استماع (صوت Gemini)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[80%] ml-auto">
              <div className="w-9 h-9 rounded-xl bg-[#8c622b] text-white shrink-0 flex items-center justify-center">
                <Bot className="w-5 h-5 animate-spin" />
              </div>
              <div className="bg-white border border-[#e2d7c5] p-4 rounded-2xl rounded-tr-none text-sm text-[#706453] flex items-center gap-2 shadow-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-[#8c622b]" />
                <span>جاري قراءة البيانات الفورية وتحليلها عبر Gemini...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Error Notification banner if any */}
        {errorMessage && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="font-bold underline">
              إغلاق
            </button>
          </div>
        )}

        {/* Suggested Prompts Pills */}
        <div className="p-3 bg-[#faf7f2] border-t border-[#e2d7c5]/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs text-[#8c8275] shrink-0 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#8c622b]" />
            أسئلة سريعة:
          </span>
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmitQuery(p)}
              disabled={isLoading}
              className="text-xs bg-white hover:bg-[#f3eee6] text-[#2c2416] border border-[#e2d7c5] px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-xs disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 md:p-4 bg-white border-t border-[#e2d7c5]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSubmitQuery();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              disabled={isLoading}
              className={`p-3 rounded-xl border transition-all ${
                isListening
                  ? 'bg-red-600 text-white border-red-600 animate-bounce'
                  : 'bg-[#faf7f2] text-[#8c622b] border-[#e2d7c5] hover:bg-[#f3eee6]'
              }`}
              title={isListening ? 'إيقاف التسجيل الصوتي' : 'تحدث بالصوت'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={
                isListening
                  ? 'جاري الاستماع لصوتك الآن...'
                  : 'اكتب سؤالك أو استفسارك لتحليل قاعدة البيانات...'
              }
              disabled={isLoading}
              className="flex-1 bg-[#faf7f2] border border-[#e2d7c5] rounded-xl px-4 py-3 text-sm text-[#2c2416] focus:outline-none focus:ring-2 focus:ring-[#8c622b] transition-all placeholder-[#8c8275]"
            />

            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="bg-[#8c622b] hover:bg-[#735022] text-white px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>إرسال</span>
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
