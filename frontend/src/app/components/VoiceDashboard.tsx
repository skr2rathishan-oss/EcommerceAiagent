import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Square, Volume2, VolumeX, PhoneOff } from "lucide-react";
import { Message } from "../../types/chat"; // Adjust import path if needed

interface VoiceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export const VoiceDashboard: React.FC<VoiceDashboardProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
}) => {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [waveform, setWaveform] = useState<number[]>([1.5, 2.5, 4, 5.5, 6, 5.5, 4, 2.5, 1.5]);
  const [isMuted, setIsMuted] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Handle listening animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "listening" || status === "speaking") {
      interval = setInterval(() => {
        setWaveform(prev => prev.map(() => Math.random() * 8 + 1));
      }, 100);
    } else {
      setWaveform([1.5, 2.5, 4, 5.5, 6, 5.5, 4, 2.5, 1.5]);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleMicTap = async () => {
    if (status === "idle" || status === "speaking") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setStatus("processing");
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          try {
            // Process STT with backend
            const formData = new FormData();
            formData.append("audio", audioBlob);

            const response = await fetch("http://localhost:5000/api/voice/transcribe", {
              method: "POST",
              body: formData,
            });
            
            const data = await response.json();
            if (data.success && data.text) {
              onSendMessage(data.text);
              // Expected AI response logic will trigger "speaking"
            } else {
              console.error("STT Error:", data.message);
              setStatus("idle");
            }
          } catch (error) {
            console.error("Error transcribing audio:", error);
            setStatus("idle");
          }
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setStatus("listening");
      } catch (err) {
        console.error("Microphone access denied or error:", err);
        alert("Please allow microphone access to use Voice Chat.");
      }
    } else if (status === "listening") {
      mediaRecorderRef.current?.stop();
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "idle": return "Ready to help";
      case "listening": return "Listening...";
      case "processing": return "Processing...";
      case "speaking": return "Velora is speaking...";
    }
  };

  // Select last 4-5 exchanges
  const recentMessages = messages.slice(-5);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-20 flex flex-col pt-[56px]"
          style={{
            background: "var(--app-bg, #f0ebfa)",
            fontFamily: "'Nunito', sans-serif"
          }}
        >
          {/* Middle Section (Conversation History) */}
          <div 
            ref={scrollRef}
            className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto px-6 py-6 flex flex-col gap-6 custom-scrollbar pb-32"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {recentMessages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className="max-w-[85%] rounded-2xl p-4 text-[15px] leading-relaxed shadow-sm"
                  style={{
                    background: msg.role === "user" 
                      ? "linear-gradient(135deg, #6D4AFF, #8A63FF)" 
                      : "rgba(255, 255, 255, 0.95)",
                    backdropFilter: msg.role !== "user" ? "blur(12px)" : "none",
                    border: msg.role !== "user" ? "1px solid rgba(64, 41, 112, 0.08)" : "none",
                    color: msg.role === "user" ? "#fff" : "#1a1025",
                    boxShadow: msg.role !== "user" ? "0 4px 15px rgba(64,41,112,0.05)" : "0 4px 15px rgba(109,74,255,0.25)"
                  }}
                >
                  {msg.text}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-3 flex overflow-x-auto gap-3 py-2 no-scrollbar">
                      {msg.products.map(p => (
                        <div key={p.id} className="min-w-[120px] bg-[rgba(64,41,112,0.04)] rounded-lg p-2 border border-[rgba(64,41,112,0.08)]">
                          <div className="text-xs font-bold truncate text-[#402970]">{p.name}</div>
                          <div className="text-[10px] text-[#7c4dba]">${p.price}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom Dock */}
          <div className="h-[22%] w-full absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-6" style={{
            background: "linear-gradient(to top, #f0ebfa 60%, rgba(240,235,250,0))",
          }}>
            
            {/* Waveform */}
            <div className="flex items-center justify-center gap-1.5 h-12 mb-2">
              {waveform.map((val, idx) => (
                <motion.div 
                  key={idx}
                  className="rounded-full"
                  style={{ width: 4, height: 12, background: "#a78bfa" }}
                  animate={{ height: [12, val * 6, 12] }}
                  transition={{ 
                    repeat: status === "listening" || status === "speaking" ? Infinity : 0, 
                    duration: 0.6, 
                    delay: idx * 0.05 
                  }}
                />
              ))}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-center gap-6 mt-1">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-white hover:bg-[rgba(64,41,112,0.06)] text-[#7c6a9e] transition-colors border border-[rgba(64,41,112,0.1)] shadow-sm"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {/* Main Microphone Button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleMicTap}
                className="flex items-center justify-center cursor-pointer relative"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: status === "listening" ? "2px solid #ec4899" : "1px solid rgba(64,41,112,0.12)",
                  background: status === "listening" ? "rgba(236,72,153,0.1)" : "#ffffff",
                  backdropFilter: "blur(10px)",
                  color: status === "listening" ? "#ec4899" : "#7c4dba",
                  boxShadow: status === "listening" ? "0 0 20px rgba(236,72,153,0.3)" : "0 4px 15px rgba(64,41,112,0.12)",
                }}
              >
                {status === "processing" ? (
                  <div className="w-5 h-5 border-2 border-t-transparent border-[#7c4dba] rounded-full animate-spin" />
                ) : status === "listening" ? (
                  <Square size={22} fill="currentColor" />
                ) : (
                  <Mic size={26} strokeWidth={2.5} />
                )}
              </motion.button>
              
              <button 
                onClick={() => {
                  if (status === "listening") mediaRecorderRef.current?.stop();
                  onClose();
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 transition-colors border border-red-100 shadow-sm"
              >
                <PhoneOff size={20} />
              </button>
            </div>
            
            {/* Status Text (Below Mic) */}
            <p className="text-[13px] font-bold text-[#7c4dba] mt-4 tracking-wide">{getStatusText()}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
