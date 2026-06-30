import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, ArrowRight, Gift, Package, Edit2, Loader2, 
  AlertCircle, Undo, Calendar, User, Compass, HelpCircle, 
  ChevronRight, RefreshCw, ShoppingBag, Truck
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { sendIntentMessage } from "../services/chatServices";
import { formatUIPrice } from "../services/mapping";
import { apiFetch } from "../services/api";

interface GuidedWorkflowPanelProps {
  messageIndex: number;
  workflow: {
    type: "find_products" | "find_gift" | "track_order";
    step: number;
    answers: Record<string, any>;
    isCompleted: boolean;
    loading: boolean;
    error: string | null;
  };
}

export const GuidedWorkflowPanel: React.FC<GuidedWorkflowPanelProps> = ({ messageIndex, workflow }) => {
  const { setMessages, orderedItems } = useApp();
  const [textVal, setTextVal] = useState("");
  const [activeProgressStep, setActiveProgressStep] = useState<string>("UNDERSTANDING");
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup initial text input value if editing a step
  useEffect(() => {
    if (workflow.step === 0) {
      if (workflow.type === "find_products") {
        setTextVal(workflow.answers.query || "");
      } else if (workflow.type === "find_gift") {
        setTextVal(workflow.answers.recipient || "");
      } else if (workflow.type === "track_order" && workflow.answers.method === "id") {
        setTextVal(workflow.answers.orderNumber || "");
      }
    } else if (workflow.type === "track_order" && workflow.step === 1 && workflow.answers.method === "id") {
      setTextVal(workflow.answers.orderNumber || "");
    } else {
      setTextVal("");
    }
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [workflow.step, workflow.type]);

  const updateWorkflow = (updater: (prev: any) => any) => {
    setMessages(prev => prev.map((msg, idx) => {
      if (idx === messageIndex && msg.type === "guided_workflow" && msg.workflow) {
        return {
          ...msg,
          workflow: updater(msg.workflow)
        };
      }
      return msg;
    }));
  };

  const handleNext = (answerValue: any) => {
    const updatedAnswers = { ...workflow.answers };
    
    if (workflow.type === "find_products") {
      if (workflow.step === 0) {
        updatedAnswers.query = answerValue || textVal;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 1 }));
      } else if (workflow.step === 1) {
        updatedAnswers.category = answerValue;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 2 }));
      } else if (workflow.step === 2) {
        updatedAnswers.budget = answerValue;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 3 }));
      } else if (workflow.step === 3) {
        updatedAnswers.brand = answerValue;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 4 }));
      }
    } else if (workflow.type === "find_gift") {
      if (workflow.step === 0) {
        updatedAnswers.recipient = answerValue || textVal;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 1 }));
      } else if (workflow.step === 1) {
        updatedAnswers.occasion = answerValue || textVal;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 2 }));
      } else if (workflow.step === 2) {
        updatedAnswers.budget = answerValue;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 3 }));
      } else if (workflow.step === 3) {
        updatedAnswers.interests = answerValue;
        updateWorkflow(prev => ({ ...prev, answers: updatedAnswers, step: 4 }));
      }
    }
  };

  const handleEditStep = (stepNum: number) => {
    updateWorkflow(prev => ({ ...prev, step: stepNum }));
  };

  const handleReset = () => {
    updateWorkflow(prev => ({
      ...prev,
      step: 0,
      answers: {},
      isCompleted: false,
      loading: false,
      error: null
    }));
    setProgressLogs([]);
  };

  // Submit Find Products search
  const submitProductSearch = async () => {
    updateWorkflow(prev => ({ ...prev, loading: true, error: null }));
    setProgressLogs([
      { id: "UNDERSTANDING", title: "Processing filters", status: "completed" },
      { id: "SEARCHING", title: "Searching catalog", status: "active" },
      { id: "FILTERING", title: "Filtering catalog", status: "pending" },
      { id: "RANKING", title: "Sorting results", status: "pending" }
    ]);

    // Parse filters
    const filters: any = {};
    if (workflow.answers.category && workflow.answers.category !== "Skip") {
      filters.category = workflow.answers.category;
    }
    if (workflow.answers.brand && workflow.answers.brand !== "Skip") {
      filters.brand = workflow.answers.brand;
    }
    if (workflow.answers.budget && workflow.answers.budget !== "Skip") {
      const b = workflow.answers.budget;
      if (b === "Under $50") filters.priceMax = 50;
      else if (b === "$50 - $100") { filters.priceMin = 50; filters.priceMax = 100; }
      else if (b === "$100 - $250") { filters.priceMin = 100; filters.priceMax = 250; }
      else if (b === "$250+") filters.priceMin = 250;
    }

    try {
      const response = await sendIntentMessage(
        workflow.answers.query,
        "search_products",
        {
          query: workflow.answers.query,
          filters
        },
        (payload) => {
          if (payload.step) {
            setActiveProgressStep(payload.step);
          }
          if (payload.logs) {
            setProgressLogs(payload.logs);
          }
        }
      );

      let finalProducts = [];
      if (Array.isArray(response)) {
        finalProducts = response;
      } else if (response && typeof response === "object") {
        if (response.products) {
          finalProducts = response.products;
        } else if (response.type === "product_grid" && response.products) {
          finalProducts = response.products;
        }
      }

      setMessages(prev => prev.map((msg, idx) => {
        if (idx === messageIndex) {
          return {
            ...msg,
            text: finalProducts.length > 0 
              ? `I found **${finalProducts.length}** products matching your guided search query: "${workflow.answers.query}".` 
              : `I couldn't find any products matching your specific filters. Try searching with different options!`,
            products: finalProducts,
            workflow: {
              ...msg.workflow!,
              isCompleted: true,
              loading: false,
              error: finalProducts.length === 0 ? "No items found matching your filter criteria." : null
            }
          };
        }
        return msg;
      }));

    } catch (err: any) {
      updateWorkflow(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to search product database. Please try again."
      }));
    }
  };

  // Submit Gift Finder search
  const submitGiftSearch = async () => {
    updateWorkflow(prev => ({ ...prev, loading: true, error: null }));
    setProgressLogs([
      { id: "UNDERSTANDING", title: "Building gift preferences", status: "completed" },
      { id: "SEARCHING", title: "Searching catalog", status: "active" },
      { id: "FILTERING", title: "Applying recipient preferences", status: "pending" },
      { id: "RANKING", title: "Ranking gifts", status: "pending" }
    ]);

    // Build gift finder search query
    const recipient = workflow.answers.recipient;
    const occasion = workflow.answers.occasion;
    const interests = workflow.answers.interests && workflow.answers.interests !== "Skip" ? `interested in ${workflow.answers.interests}` : "";
    const fullQuery = `Gift ideas for a ${recipient} for a ${occasion} ${interests}`.trim();

    const filters: any = {};
    if (workflow.answers.budget) {
      const b = workflow.answers.budget;
      if (b === "Under $30") filters.priceMax = 30;
      else if (b === "$30 - $75") { filters.priceMin = 30; filters.priceMax = 75; }
      else if (b === "$75 - $150") { filters.priceMin = 75; filters.priceMax = 150; }
      else if (b === "$150+") filters.priceMin = 150;
    }

    try {
      const response = await sendIntentMessage(
        fullQuery,
        "search_products",
        {
          query: fullQuery,
          filters
        },
        (payload) => {
          if (payload.step) {
            setActiveProgressStep(payload.step);
          }
          if (payload.logs) {
            setProgressLogs(payload.logs);
          }
        }
      );

      let finalProducts = [];
      if (Array.isArray(response)) {
        finalProducts = response;
      } else if (response && typeof response === "object") {
        if (response.products) {
          finalProducts = response.products;
        } else if (response.type === "product_grid" && response.products) {
          finalProducts = response.products;
        }
      }

      setMessages(prev => prev.map((msg, idx) => {
        if (idx === messageIndex) {
          return {
            ...msg,
            text: finalProducts.length > 0 
              ? `Here are some personalized gift suggestions for your **${recipient}** on their **${occasion}**:` 
              : `I couldn't find any gift recommendations matching your exact preferences. Let's try adjusting the criteria!`,
            products: finalProducts,
            workflow: {
              ...msg.workflow!,
              isCompleted: true,
              loading: false,
              error: finalProducts.length === 0 ? "No gift recommendations found. Try expanding your search options." : null
            }
          };
        }
        return msg;
      }));

    } catch (err: any) {
      updateWorkflow(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to query gift recommendations. Please try again."
      }));
    }
  };

  // Submit Order ID tracking
  const trackWithOrderId = async (orderId: string) => {
    if (!orderId || orderId.trim() === "") return;
    
    updateWorkflow(prev => ({ ...prev, loading: true, error: null }));
    const trimmedId = orderId.trim();

    try {
      const sessionId = sessionStorage.getItem("velora_session_id") || "default";
      const res = await apiFetch("/api/orders/track", {
        method: "POST",
        headers: { "x-session-id": sessionId },
        body: JSON.stringify({ orderNumber: trimmedId })
      });

      if (!res.ok) {
        throw new Error("Order not found or tracking service unavailable");
      }

      const trackingData = await res.json();
      
      // Instantly change message details to OrderTrackingCard
      setMessages(prev => prev.map((msg, idx) => {
        if (idx === messageIndex) {
          return {
            ...msg,
            type: "order_tracking",
            text: `Here is the current tracking status for order **${trimmedId}**:`,
            tracking: trackingData,
            workflow: undefined // Clear workflow to hide the panel
          };
        }
        return msg;
      }));
    } catch (err: any) {
      updateWorkflow(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to locate order number. Please verify the ID and try again."
      }));
    }
  };

  // Render Loading Progress Logs
  const renderLoadingProgress = () => {
    return (
      <div className="flex flex-col gap-3 py-6 items-center justify-center font-['Nunito']">
        <Loader2 className="animate-spin text-[#7c4dba] mb-2" size={28} />
        <span style={{ color: "#1a1025", fontSize: 14, fontWeight: 700 }}>Processing Request...</span>
        
        <div className="w-full max-w-xs mt-3 bg-rgba(64,41,112,0.05) rounded-xl p-3 border border-purple-100" style={{ background: "rgba(124,77,186,0.03)" }}>
          {progressLogs.map((logStep) => (
            <div key={logStep.id} className="flex items-center justify-between text-xs py-1">
              <span className="font-semibold text-purple-950">{logStep.title}</span>
              {logStep.status === "completed" && <span className="text-green-600 font-bold">✓</span>}
              {logStep.status === "active" && <Loader2 size={10} className="animate-spin text-purple-700" />}
              {logStep.status === "pending" && <span className="text-purple-300">○</span>}
              {logStep.status === "error" && <span className="text-red-500">❌</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // FIND PRODUCTS FLOW RENDERER
  // ───────────────────────────────────────────────────────────────────────────
  const renderFindProducts = () => {
    if (workflow.loading) {
      return renderLoadingProgress();
    }

    if (workflow.error && workflow.step === 4) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AlertCircle size={36} className="text-orange-500" />
          <h4 className="font-extrabold text-[#1a1025]">No Products Found</h4>
          <p className="text-xs text-[#7c6a9e] max-w-sm">{workflow.error}</p>
          <div className="flex gap-2.5 mt-2">
            <button onClick={() => handleEditStep(0)} className="px-4 py-2 border rounded-xl font-bold text-xs text-[#7c4dba] bg-white cursor-pointer hover:bg-purple-50">Adjust Search</button>
            <button onClick={handleReset} className="px-4 py-2 bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white rounded-xl font-bold text-xs cursor-pointer">Start Over</button>
          </div>
        </div>
      );
    }

    // Step 0: Search query / Product name
    if (workflow.step === 0) {
      return (
        <div className="flex flex-col gap-4">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Search size={15} className="text-purple-700" /> What product or search query are you looking for?
          </h4>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              placeholder="e.g. Wireless Headphones, Running Shoes..."
              onKeyDown={e => e.key === "Enter" && textVal.trim() && handleNext(textVal)}
              className="flex-1 px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500 text-xs font-semibold"
            />
            <button 
              onClick={() => textVal.trim() && handleNext(textVal)}
              disabled={!textVal.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white cursor-pointer disabled:opacity-50"
            >
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {["Wireless Headphones", "Running Shoes", "Gaming Laptop", "Smart Watch"].map((s) => (
              <button 
                key={s} 
                onClick={() => { setTextVal(s); handleNext(s); }}
                className="px-3 py-1.5 border border-purple-100 rounded-full bg-white hover:bg-purple-50 text-xs font-semibold text-[#402970] cursor-pointer"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 1: Category Filter (Optional)
    if (workflow.step === 1) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Compass size={15} className="text-purple-700" /> Select a category (optional):
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {["Electronics", "Fashion", "Beauty", "Home & Living", "Gaming", "Sports"].map((cat) => (
              <button
                key={cat}
                onClick={() => handleNext(cat)}
                className="px-3 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{cat}</span>
                <ChevronRight size={12} className="text-purple-300" />
              </button>
            ))}
          </div>
          <button onClick={() => handleNext("Skip")} className="mt-2 text-center text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer">
            Skip ➔
          </button>
        </div>
      );
    }

    // Step 2: Budget range (Optional)
    if (workflow.step === 2) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <ShoppingBag size={15} className="text-purple-700" /> What is your maximum budget? (optional)
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {["Under $50", "$50 - $100", "$100 - $250", "$250+"].map((range) => (
              <button
                key={range}
                onClick={() => handleNext(range)}
                className="px-3 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{range}</span>
                <ChevronRight size={12} className="text-purple-300" />
              </button>
            ))}
          </div>
          <button onClick={() => handleNext("Skip")} className="mt-2 text-center text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer">
            Skip ➔
          </button>
        </div>
      );
    }

    // Step 3: Brand (Optional)
    if (workflow.step === 3) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Truck size={15} className="text-purple-700" /> Select a brand preference (optional):
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {["SoundFlow", "Vega", "AirStep", "ProBook", "ClearSound", "Flux"].map((brand) => (
              <button
                key={brand}
                onClick={() => handleNext(brand)}
                className="px-3 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{brand}</span>
                <ChevronRight size={12} className="text-purple-300" />
              </button>
            ))}
          </div>
          <button onClick={() => handleNext("Skip")} className="mt-2 text-center text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer">
            Skip ➔
          </button>
        </div>
      );
    }

    // Step 4: Summary & Submit Find Products
    if (workflow.step === 4) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025]">📋 Guided Search Summary</h4>
          <div className="border border-purple-100 rounded-xl p-3 bg-white flex flex-col gap-2 mt-1 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Query:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(0)}>
                {workflow.answers.query} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Category:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(1)}>
                {workflow.answers.category || "Any"} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Budget:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(2)}>
                {workflow.answers.budget || "Any"} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#7c6a9e] font-semibold">Brand:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(3)}>
                {workflow.answers.brand || "Any"} <Edit2 size={10} />
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={handleReset}
              className="flex-1 py-2 border border-purple-200 rounded-xl font-bold text-xs text-[#7c6a9e] cursor-pointer bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              <Undo size={12} /> Start Over
            </button>
            <button 
              onClick={submitProductSearch}
              className="flex-1.5 py-2 bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              Search Products <Search size={12} />
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // FIND GIFT FLOW RENDERER
  // ───────────────────────────────────────────────────────────────────────────
  const renderFindGift = () => {
    if (workflow.loading) {
      return renderLoadingProgress();
    }

    if (workflow.error && workflow.step === 4) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AlertCircle size={36} className="text-orange-500" />
          <h4 className="font-extrabold text-[#1a1025]">No Gifts Found</h4>
          <p className="text-xs text-[#7c6a9e] max-w-sm">{workflow.error}</p>
          <div className="flex gap-2.5 mt-2">
            <button onClick={() => handleEditStep(0)} className="px-4 py-2 border rounded-xl font-bold text-xs text-[#7c4dba] bg-white cursor-pointer hover:bg-purple-50">Adjust Info</button>
            <button onClick={handleReset} className="px-4 py-2 bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white rounded-xl font-bold text-xs cursor-pointer">Start Over</button>
          </div>
        </div>
      );
    }

    // Step 0: Recipient
    if (workflow.step === 0) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <User size={15} className="text-purple-700" /> Who is the gift for?
          </h4>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {["Friend", "Partner", "Parent", "Sibling", "Colleague", "Child"].map((rec) => (
              <button
                key={rec}
                onClick={() => handleNext(rec)}
                className="px-2 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-center cursor-pointer"
              >
                {rec}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <input
              ref={inputRef}
              type="text"
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              placeholder="Or enter custom (e.g. Grandma, Boss)..."
              onKeyDown={e => e.key === "Enter" && textVal.trim() && handleNext(textVal)}
              className="flex-1 px-3 py-1.5 border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500 text-xs font-semibold"
            />
            <button 
              onClick={() => textVal.trim() && handleNext(textVal)}
              disabled={!textVal.trim()}
              className="p-1.5 rounded-xl bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white cursor-pointer disabled:opacity-50"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      );
    }

    // Step 1: Occasion
    if (workflow.step === 1) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Calendar size={15} className="text-purple-700" /> What is the occasion?
          </h4>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {["Birthday", "Anniversary", "Wedding", "Housewarming", "Holiday", "Just Because"].map((occ) => (
              <button
                key={occ}
                onClick={() => handleNext(occ)}
                className="px-2 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-center cursor-pointer"
              >
                {occ}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <input
              ref={inputRef}
              type="text"
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              placeholder="Or enter custom (e.g. Graduation)..."
              onKeyDown={e => e.key === "Enter" && textVal.trim() && handleNext(textVal)}
              className="flex-1 px-3 py-1.5 border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500 text-xs font-semibold"
            />
            <button 
              onClick={() => textVal.trim() && handleNext(textVal)}
              disabled={!textVal.trim()}
              className="p-1.5 rounded-xl bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white cursor-pointer disabled:opacity-50"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      );
    }

    // Step 2: Budget
    if (workflow.step === 2) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <ShoppingBag size={15} className="text-purple-700" /> What is your budget?
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {["Under $30", "$30 - $75", "$75 - $150", "$150+"].map((range) => (
              <button
                key={range}
                onClick={() => handleNext(range)}
                className="px-3 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{range}</span>
                <ChevronRight size={12} className="text-purple-300" />
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 3: Interests (Optional)
    if (workflow.step === 3) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Compass size={15} className="text-purple-700" /> Select their interests / preferences (optional):
          </h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {["Tech & Gaming", "Fashion & Style", "Fitness & Sports", "Home Decor", "Books & Reading"].map((int) => (
              <button
                key={int}
                onClick={() => handleNext(int)}
                className="px-3 py-2 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] text-left flex items-center justify-between cursor-pointer"
              >
                <span>{int}</span>
                <ChevronRight size={12} className="text-purple-300" />
              </button>
            ))}
          </div>
          <button onClick={() => handleNext("Skip")} className="mt-2 text-center text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer">
            Skip ➔
          </button>
        </div>
      );
    }

    // Step 4: Summary & Submit Find Gift
    if (workflow.step === 4) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025]">🎁 Guided Gift Preferences</h4>
          <div className="border border-purple-100 rounded-xl p-3 bg-white flex flex-col gap-2 mt-1 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Recipient:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(0)}>
                {workflow.answers.recipient} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Occasion:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(1)}>
                {workflow.answers.occasion} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-purple-50">
              <span className="text-[#7c6a9e] font-semibold">Budget:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(2)}>
                {workflow.answers.budget} <Edit2 size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#7c6a9e] font-semibold">Interests:</span>
              <span className="font-bold text-[#1a1025] flex items-center gap-1 cursor-pointer text-right hover:text-[#7c4dba]" onClick={() => handleEditStep(3)}>
                {workflow.answers.interests || "Any"} <Edit2 size={10} />
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={handleReset}
              className="flex-1 py-2 border border-purple-200 rounded-xl font-bold text-xs text-[#7c6a9e] cursor-pointer bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              <Undo size={12} /> Start Over
            </button>
            <button 
              onClick={submitGiftSearch}
              className="flex-1.5 py-2 bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              Get Gift Ideas <Gift size={12} />
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TRACK MY ORDER FLOW RENDERER
  // ───────────────────────────────────────────────────────────────────────────
  const renderTrackOrder = () => {
    if (workflow.loading) {
      return (
        <div className="flex flex-col gap-3 py-6 items-center justify-center font-['Nunito']">
          <Loader2 className="animate-spin text-[#7c4dba] mb-2" size={28} />
          <span style={{ color: "#1a1025", fontSize: 14, fontWeight: 700 }}>Querying Tracking Database...</span>
          <span className="text-xs text-[#7c6a9e]">Retrieving estimated delivery date and status logs...</span>
        </div>
      );
    }

    // Step 0: Choose tracking method
    if (workflow.step === 0) {
      return (
        <div className="flex flex-col gap-3">
          <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
            <Package size={15} className="text-purple-700" /> How would you like to track your order?
          </h4>
          <div className="flex flex-col gap-2.5 mt-1">
            <button
              onClick={() => updateWorkflow(prev => ({ ...prev, step: 1, answers: { ...prev.answers, method: "id" } }))}
              className="px-4 py-3 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-[#7c4dba]" />
                <div className="text-left">
                  <div className="font-bold">Enter Order ID</div>
                  <div className="text-[10px] text-[#7c6a9e] font-medium mt-0.5">Lookup using order reference number</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-purple-300" />
            </button>
            
            <button
              onClick={() => updateWorkflow(prev => ({ ...prev, step: 1, answers: { ...prev.answers, method: "recent" } }))}
              className="px-4 py-3 border border-purple-100 bg-white hover:bg-purple-50 rounded-xl font-bold text-xs text-[#402970] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#7c4dba]" />
                <div className="text-left">
                  <div className="font-bold">View My Recent Orders</div>
                  <div className="text-[10px] text-[#7c6a9e] font-medium mt-0.5">Select from order history ({orderedItems.length} orders found)</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-purple-300" />
            </button>
          </div>
        </div>
      );
    }

    // Step 1: Method selected
    if (workflow.step === 1) {
      if (workflow.answers.method === "id") {
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => updateWorkflow(prev => ({ ...prev, step: 0, error: null }))} className="text-purple-600 hover:text-purple-800 text-xs font-bold flex items-center cursor-pointer">
                ↩ Back
              </button>
            </div>
            <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
              <Package size={15} className="text-purple-700" /> Enter your Order ID / Number:
            </h4>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={textVal}
                onChange={e => setTextVal(e.target.value)}
                placeholder="e.g. VIMP12345 or KAP-123-456"
                onKeyDown={e => e.key === "Enter" && textVal.trim() && trackWithOrderId(textVal)}
                className="flex-1 px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500 text-xs font-semibold"
              />
              <button 
                onClick={() => trackWithOrderId(textVal)}
                disabled={!textVal.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white cursor-pointer font-bold text-xs disabled:opacity-50"
              >
                Track
              </button>
            </div>
            {workflow.error && (
              <p className="text-red-500 font-semibold text-[11px] mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {workflow.error}
              </p>
            )}
          </div>
        );
      } else if (workflow.answers.method === "recent") {
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => updateWorkflow(prev => ({ ...prev, step: 0, error: null }))} className="text-purple-600 hover:text-purple-800 text-xs font-bold flex items-center cursor-pointer">
                ↩ Back
              </button>
            </div>
            <h4 className="font-extrabold text-sm text-[#1a1025] flex items-center gap-1.5">
              📦 Select from Recent Orders
            </h4>
            
            {orderedItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#7c6a9e] font-semibold border border-dashed border-purple-200 rounded-xl bg-purple-50/50">
                You do not have any recent orders stored in this session.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {orderedItems.map((order) => (
                  <div 
                    key={order.orderNumber}
                    className="p-3 border border-purple-100 bg-white rounded-xl flex items-center justify-between text-xs hover:border-purple-300 transition-colors"
                  >
                    <div className="text-left flex flex-col gap-1 min-w-0">
                      <span className="font-mono font-bold text-[#7c4dba] overflow-hidden text-ellipsis whitespace-nowrap">{order.orderNumber}</span>
                      <span className="text-[10px] text-[#7c6a9e] font-medium">{order.orderDate} · {order.items.length} items</span>
                      <span className="font-bold text-[#1a1025]">{formatUIPrice(order.summary.total, order.items[0]?.currency)}</span>
                    </div>
                    <button
                      onClick={() => trackWithOrderId(order.orderNumber)}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#7c4dba] to-[#402970] text-white rounded-lg font-bold text-[10px] cursor-pointer flex-shrink-0"
                    >
                      Track
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }

    return null;
  };

  // Main container style
  return (
    <div 
      className="w-full text-left font-['Nunito'] mt-1 bg-white/70 border border-purple-100 rounded-2xl p-4 shadow-sm"
      style={{
        background: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(14px)",
        border: "1.5px solid rgba(124, 77, 186, 0.15)",
        boxShadow: "0 6px 20px rgba(64, 41, 112, 0.04)"
      }}
    >
      {workflow.type === "find_products" && renderFindProducts()}
      {workflow.type === "find_gift" && renderFindGift()}
      {workflow.type === "track_order" && renderTrackOrder()}
    </div>
  );
};
