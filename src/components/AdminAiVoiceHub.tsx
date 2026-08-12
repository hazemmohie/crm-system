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
  ShieldCheck,
  TrendingUp,
  Users,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  Activity,
  Award,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

interface AdminAiVoiceHubProps {
  currentUser: User;
  users: User[];
  customers: Customer[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  audioUrl?: string;
}

export const AdminAiVoiceHub: React.FC<AdminAiVoiceHubProps> = ({
  currentUser,
  users,
  customers
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeakResponse, setAutoSpeakResponse] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<'Aoede' | 'Puck' | 'Kore' | 'Charon' | 'Fenrir'>('Aoede');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Handle Speech Recognition for Admin Query
  const handleToggleVoiceQuery = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (isListening) {
      // Stop listening
      setIsListening(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Try Web Speech API first
    if (SpeechRecognition) {
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
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            setQuery(currentTranscript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
          setIsListening(false);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setErrorMessage('تم حظر أو رفض استخدام الميكروفون في المتصفح. يمكنك إعطاء الإذن في إعدادات الصفحة أو استخدام إدخال النص المباشر.');
            setTimeout(() => setErrorMessage(null), 6000);
          } else {
            startAudioRecordingFallback();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        startAudioRecordingFallback();
      }
    } else {
      startAudioRecordingFallback();
    }
  };

  // Fallback Audio Recording & Gemini Transcription
  const startAudioRecordingFallback = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsLoading(true);
          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64Audio, mimeType: 'audio/webm' })
            });
            const data = await res.json();
            if (data.transcript) {
              setQuery(data.transcript);
              handleSendQuery(data.transcript);
            }
          } catch (err) {
            setErrorMessage('تعذر تفريغ الصوت، يرجى كتابة السؤال نصياً');
          } finally {
            setIsLoading(false);
          }
        };
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      setErrorMessage('تعذر الوصول للميكروفون، يرجى السماح بصلاحيات الميكروفون أو الكتابة نصياً');
    }
  };

  const stopAllSpeech = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  const speakBrowserFallback = (msgId: string, textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = textToSpeak.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeakingMessageId(msgId);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    window.speechSynthesis.speak(utterance);
  };

  const playAudioForMessage = async (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();

    if (msg.audioUrl) {
      try {
        const audio = new Audio(msg.audioUrl);
        currentAudioRef.current = audio;
        setSpeakingMessageId(msg.id);

        audio.onended = () => {
          setSpeakingMessageId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => speakBrowserFallback(msg.id, msg.text);

        await audio.play();
        return;
      } catch (err) {
        console.error('Audio play error:', err);
      }
    }

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
        audio.onerror = () => speakBrowserFallback(msg.id, msg.text);

        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('On-demand Gemini TTS failed:', e);
    }

    speakBrowserFallback(msg.id, msg.text);
  };

  // Submit AI Query
  const handleSendQuery = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || isLoading) return;

    setErrorMessage(null);
    const userMsgId = 'user-' + Date.now();
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          adminEmail: currentUser.email,
          voice: selectedVoice,
          generateVoice: autoSpeakResponse,
          history: chatHistory
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء معالجة الطلب');
      }

      const aiMsgId = 'ai-' + Date.now();
      const aiMessage: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: data.answer,
        audioUrl: data.audioUrl,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory((prev) => [...prev, aiMessage]);

      if (autoSpeakResponse) {
        setTimeout(() => playAudioForMessage(aiMessage), 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ في جلب تحليلات الذكاء الاصطناعي');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Preset Prompts
  const quickPrompts = [
    '📊 ما هي إنتاجية الموظفين اليوم وأرقام الاتصالات والواتساب؟',
    '🏢 ما هو الموقف العقاري للعملاء (البيع والتأجير وغير المحدد)؟',
    '🎯 من هم الموظفون المتفوقون ومن هم الأقل إنجازاً اليوم؟',
    '⏳ ما هي أرقام العملاء المعلّقة التي لم يتم التواصل معها حتى الآن؟',
    '🔄 أعطني تحليلاً شاملاً عن حركة وسجل النشاطات الأخيرة في المشروع'
  ];

  // Quick Stats
  const totalCusts = customers.length;
  const contactedCusts = customers.filter(c => c.status !== 'pending' || (c.feedbackHistory && c.feedbackHistory.length > 0)).length;
  const resolvedCusts = customers.filter(c => c.status && c.status !== 'pending' && c.status !== 'contacted').length;
  const totalCalls = customers.reduce((acc, c) => acc + (c.feedbackHistory || []).filter(f => (f.text || '').includes('📞')).length, 0);
  const totalWa = customers.reduce((acc, c) => acc + (c.feedbackHistory || []).filter(f => (f.text || '').includes('💬')).length, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-[#2c2824] via-[#423b35] to-[#704d1f] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-[#d8cebe]/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8c622b]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-[#8c622b]/30 backdrop-blur-md border border-[#c2a378]/40 px-3 py-1 rounded-full text-xs text-[#e8d5b7] font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>حصري لمدير النظام الفعلي (Admin Only)</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#f8f5ee] flex items-center gap-2">
              <span>مركز الاستعلامات والتحليلات الصوتي الشامل</span>
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
            </h2>
            <p className="text-xs md:text-sm text-[#d8cebe] max-w-2xl leading-relaxed">
              يمكنك السؤال صوتياً أو كتابياً عن أي تفاصيل بالمشروع، أداء الموظفين، إحصائيات المكالمات،
              الموقف العقاري، والعملاء المعلقين وسيجيبك خبير الذكاء الاصطناعي مباشرة بصوته ورسوماته.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#1e1b18]/60 p-3 rounded-2xl border border-[#d8cebe]/30 backdrop-blur-sm self-start md:self-auto">
            <button
              type="button"
              onClick={() => setAutoSpeakResponse(!autoSpeakResponse)}
              className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                autoSpeakResponse
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-[#2c2824] text-slate-400 hover:text-white'
              }`}
              title="تفعيل الإجابة الصوتية التلقائية بالصوت المباشر"
            >
              {autoSpeakResponse ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{autoSpeakResponse ? 'الإجابة الصوتية تلقائية 🔊' : 'الإجابة صامتة 🔇'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
            <div className="text-[#c2a378] text-[10px] font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> إجمالي العملاء والملاك:
            </div>
            <div className="text-lg font-black text-white">{totalCusts} عميل</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
            <div className="text-amber-300 text-[10px] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> تم التواصل معهم:
            </div>
            <div className="text-lg font-black text-amber-200">{contactedCusts} عميل</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
            <div className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> محسوم الموقف (إنجاز):
            </div>
            <div className="text-lg font-black text-emerald-300">{resolvedCusts} إنجاز</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1">
            <div className="text-blue-300 text-[10px] font-medium flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5" /> المكالمات الموثقة:
            </div>
            <div className="text-lg font-black text-blue-200">{totalCalls} مكالمة</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10 space-y-1 col-span-2 sm:col-span-1">
            <div className="text-emerald-300 text-[10px] font-medium flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> مراسلات الواتساب:
            </div>
            <div className="text-lg font-black text-emerald-200">{totalWa} رسالة</div>
          </div>
        </div>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="bg-white border border-[#e2d8c7] rounded-3xl p-4 shadow-sm space-y-2">
        <div className="text-xs font-bold text-[#704d1f] flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#8c622b]" />
          <span>أسئلة سريعة شائعة لمدير النظام (اضغط للسؤال فوراً):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(promptText);
                handleSendQuery(promptText);
              }}
              disabled={isLoading}
              className="text-xs bg-[#f8f5ee] hover:bg-[#f2ece1] border border-[#e8e0d0] text-[#2c2824] px-3 py-1.5 rounded-xl font-medium transition-all hover:border-[#8c622b] shadow-sm cursor-pointer disabled:opacity-50"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Chat & Voice Interaction Area */}
      <div className="bg-white border border-[#e2d8c7] rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[480px]">
        {/* Chat Stream Header */}
        <div className="bg-[#f8f5ee] px-6 py-4 border-b border-[#e2d8c7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#8c622b] text-white rounded-xl shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2c2824]">المحادثة الحية والمستشار الصوتي الذكي</h3>
              <p className="text-[11px] text-[#6e685f]">مرتبط أوتوماتيكياً بأحدث قاعدة بيانات في السيرفر</p>
            </div>
          </div>

          {chatHistory.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setChatHistory([]);
                window.speechSynthesis?.cancel();
              }}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold px-3 py-1 bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer"
            >
              مسح المحادثة
            </button>
          )}
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[500px] bg-[#fdfbf7]">
          {chatHistory.length === 0 ? (
            <div className="text-center py-12 space-y-4 max-w-md mx-auto text-[#6e685f]">
              <div className="w-16 h-16 mx-auto bg-[#f2ece1] border border-[#d8cebe] rounded-full flex items-center justify-center text-[#8c622b] shadow-inner">
                <Mic className="w-8 h-8 animate-bounce" />
              </div>
              <h4 className="text-base font-bold text-[#2c2824]">جاهز للاستماع والإجابة بالصوت والكتابة</h4>
              <p className="text-xs leading-relaxed">
                اضغط على زر <strong className="text-[#8c622b]">الميكروفون</strong> أدناه وتحدث بسؤالك بصوتك المباشر، أو اكتب السؤال في الخانة المخصصة للاستفسار عن أي موظف أو إحصائية بالمشروع.
              </p>
            </div>
          ) : (
            chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.sender === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-2xl shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#704d1f] text-white'
                      : 'bg-[#8c622b] text-white'
                  }`}
                >
                  {msg.sender === 'user' ? 'مدير' : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-2xl p-4 space-y-2 text-xs md:text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#704d1f] text-white rounded-tr-none'
                      : 'bg-white border border-[#e2d8c7] text-[#2c2824] rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 border-b border-current/10 pb-1.5">
                    <span className="font-bold">
                      {msg.sender === 'user' ? 'سؤال مدير النظام' : 'إجابة الخبير التنفيذي للذكاء الاصطناعي'}
                    </span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {msg.sender === 'ai' && (
                    <div className="pt-2 flex items-center justify-end border-t border-[#e8e0d0]/60">
                      <button
                        type="button"
                        onClick={() => playAudioForMessage(msg)}
                        className={`text-xs px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          speakingMessageId === msg.id
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-[#f2ece1] hover:bg-[#e8decb] text-[#704d1f]'
                        }`}
                      >
                        {speakingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>إيقاف الصوت</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-[#8c622b]" />
                            <span>تشغيل بصوت جميناي الاصطناعي 🔊</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-3 max-w-md bg-white p-4 rounded-2xl border border-[#e2d8c7] shadow-sm text-xs text-[#704d1f]">
              <RefreshCw className="w-5 h-5 text-[#8c622b] animate-spin" />
              <span>جاري تحليل قاعدة بيانات المشروع وصياغة الإجابة الصوتية...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border-t border-rose-200 text-rose-800 text-xs p-3 px-6 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Controls Bar (Voice Recording & Text Input) */}
        <div className="p-4 bg-white border-t border-[#e2d8c7] space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2"
          >
            {/* Live Audio Microphone Dictation Button */}
            <button
              type="button"
              onClick={handleToggleVoiceQuery}
              className={`p-3.5 rounded-2xl font-bold flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                  : 'bg-gradient-to-r from-[#8c622b] to-[#704d1f] hover:from-[#704d1f] hover:to-[#573a15] text-white'
              }`}
              title={isListening ? 'جاري الاستماع... اضغط لإيقاف التسجيل' : 'تحدث بصوتك مباشرة'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            <input
              type="text"
              placeholder={isListening ? 'جاري الاستماع لصوتك الآن...' : 'اكتب أو تحدث بسؤالك عن أي تحليل بالمشروع...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-[#f8f5ee] border border-[#e2d8c7] rounded-2xl px-4 py-3 text-xs md:text-sm text-[#2c2824] placeholder-[#8c8275] focus:outline-none focus:ring-2 focus:ring-[#8c622b] font-medium"
            />

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="bg-[#2c2824] hover:bg-[#1a1816] text-[#f8f5ee] px-5 py-3 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all shadow-md disabled:opacity-40 cursor-pointer shrink-0"
            >
              <span>إرسال</span>
              <Send className="w-4 h-4 text-amber-400 rotate-180" />
            </button>
          </form>

          {isListening && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 py-1.5 px-4 rounded-xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>جاري استلام صوتك مباشرة... تحدث الآن وسيقوم المساعد بتفريغ وتحليل السؤال ورده صوتياً.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
