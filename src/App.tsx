/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Loader2, List, Hash, Globe, AlertCircle, ChevronRight, CheckCircle2, Sparkles, Layout, Copy, Check, RefreshCcw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScrapedItem {
  text: string;
  selector: string;
  html: string;
  locationDescription?: string;
  context?: {
    prefix: string;
    suffix: string;
  };
}

interface ScrapedData {
  url: string;
  count: number;
  items: ScrapedItem[];
  seo?: {
    title: string;
    description: string;
    keywords: string;
  };
}

const BUSINESS_CONTEXTS = [
  { name: "Sure Fire Gas", opt: "Mission, Chilliwack, Abbotsford and Fireplace service & replacement/installation" },
  { name: "Tidal Mechanical Ltd.", opt: "Port Moody, Port Coquitlam and Coquitlam - Plumbing and Gas/Heating" },
  { name: "K & M Mechanical", opt: "Burnaby, New Westminster - Plumbing and Gas/Heating" },
  { name: "Enze Pro HVAC Solutions", opt: "Kelowna, west kelowna - Refrigeration and heating/Gas" },
  { name: "Alberni Valley Refrigeration", opt: "Port Alberni & Qualicum & Parksville - Refrigeration and heating/Gas" },
  { name: "Brians Plumbing", opt: "Langley - Plumbing and Vacuum/vac truck" },
  { name: "Friesens", opt: "Qualicum, Parksville, Nanoose, Coombs - Refrigeration and heating/Gas" },
  { name: "InCircle Group", opt: "Vancouver - Plumbing and heating/Gas" },
  { name: "Matta Plumbing and Gas", opt: "Kelowna and West Kelowna - Plumbing and heating/Gas" },
  { name: "Paton Plumbing Worx", opt: "Langley - Plumbing and heating/Gas" },
  { name: "Superior Gas Installations", opt: "Vancouver - Plumbing and heating/Gas" },
  { name: "BC Marketing Rebates", opt: "Plumbing, HVAC, Heating, Gas, Refrigeration, Fireplaces BC Wide" },
  { name: "BCPHA", opt: "Plumbing, HVAC, Heating, Gas, Refrigeration, Fireplaces BC Wide" },
  { name: "Sea Wolves Men’s Cancer Pack", opt: "Men’s Cancer Support Group, prostate cancer BC Wide" },
];

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState<number | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapedData | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('last-biz') : null;
    return BUSINESS_CONTEXTS.find(b => b.name === saved) || BUSINESS_CONTEXTS[0];
  });
  const [aiProvider, setAiProvider] = useState<'groq' | 'gemini'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('last-ai') : null;
    return (saved as 'groq' | 'gemini') || 'groq';
  });
  const [pageType, setPageType] = useState<'home' | 'other'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('last-page-type') : null;
    return (saved as 'home' | 'other') || 'other';
  });
  const [pageDescriptionOverride, setPageDescriptionOverride] = useState('');

  useEffect(() => {
    localStorage.setItem('last-biz', selectedBusiness.name);
  }, [selectedBusiness]);

  useEffect(() => {
    localStorage.setItem('last-page-type', pageType);
  }, [pageType]);

  useEffect(() => {
    localStorage.setItem('last-ai', aiProvider);
  }, [aiProvider]);

  const [optimizedSeo, setOptimizedSeo] = useState<{ title: string; description: string; keywords: string } | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getOptimizedSeo = async (dataOverride?: any, pageTypeOverride?: 'home' | 'other') => {
    // Identify the correct result data - if called from event, dataOverride will be a MouseEvent
    const activeResult = (dataOverride && 'items' in dataOverride) ? dataOverride : result;
    if (!activeResult) return;

    setOptimizerLoading(true);
    setOptimizedSeo(null);

    try {
      const isHomePage = (typeof pageTypeOverride === 'string' ? pageTypeOverride : pageType) === 'home';
      
      const prompt = `I am updating the SEO Meta data on my website. Please optimize it for the following context: ${selectedBusiness.name} - ${selectedBusiness.opt}.
      ${pageDescriptionOverride ? `PAGE CONTEXT (MANUAL OVERRIDE): ${pageDescriptionOverride}` : ''}
      
      CURRENT SEO:
      URL: ${activeResult.url}
      Title: ${activeResult.seo?.title || "None"}
      Description: ${activeResult.seo?.description || "None"}
      Keywords: ${activeResult.seo?.keywords || "None"}

      RULES FOR GENERATION (FOLLOW EXACTLY):
      1. Name of Page Extraction:
         - Identify the specific topic or location focus of this specific page.
         ${pageDescriptionOverride ? `- PRIORITY #1: Use the following provided context to identify what this page is about: "${pageDescriptionOverride}".` : ''}
         - PRIORITY #2: If the URL path contains a specific city name (e.g., /richmond), that city name (e.g., "Richmond") MUST be used as the "Name of Page".
         - If no location is in the URL and no manual context is provided, derive the "Name of Page" from the most relevant H1 content or service description.

      2. Structure for Title (STRICT MANDATE) - DO NOT DEVIATE:
         - IF IS_HOME_PAGE is true (Current Status: ${isHomePage}):
           * REQUIRED FORMAT: "${selectedBusiness.name} | [core services] and ${selectedBusiness.opt}"
           * LOGIC: This MUST start with "${selectedBusiness.name}".
         - IF IS_HOME_PAGE is false (Current Status: ${isHomePage}):
           * REQUIRED FORMAT: "PRIMARY_TOPIC | ${selectedBusiness.name} - ${selectedBusiness.opt}"
           * PRIMARY_TOPIC: This is the "Name of Page" from Rule 1. It MUST be the very first thing in the string.
           * FORMAT VERIFICATION: The title MUST have exactly two separators: one "|" and one "-". 
           * Example of internal page: "Richmond | ${selectedBusiness.name} - ${selectedBusiness.opt}"
         * DOUBLE CHECK: Is IS_HOME_PAGE ${isHomePage}? 
           - IF TRUE: Title MUST start with "${selectedBusiness.name}".
           - IF FALSE: Title MUST NOT start with "${selectedBusiness.name}". It MUST start with the specific page topic/location.

      3. Meta Description (STRICT INSTRUCTION): 
         - OBJECTIVE: Rewrite the meta description to focus on "${selectedBusiness.opt}". 
         - Context for Rewrite: (Current Description: ${activeResult.seo?.description || "None"}).
         - LENGTH: Exactly 150-160 characters.
         - NEGATIVE CONSTRAINT: DO NOT include the words "Optimize for", "Rewrite", or any meta-instructions in the final string. The output must be a clean, ready-to-use description.
         - TONE: Professional, compelling, and optimized for high click-through rates.

      4. Keywords instruction:
         - OBJECTIVE: Provide 30 keywords for ${selectedBusiness.name} ${isHomePage ? "Home Page" : "Service Page"} focusing on ${selectedBusiness.opt}.
         - Format as a simple comma-separated list.
      
      OUTPUT FORMAT (Strict JSON):
      {
        "title": "Optimized Title",
        "description": "Optimized Description",
        "keywords": "keyword1, keyword2, ... (exactly 30)"
      }`;

      const response = await fetch('/api/optimize-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider: aiProvider })
      });

      const optimized = await response.json();
      
      if (!response.ok) {
        const errorMsg = optimized.error || "Optimization failed";
        const details = optimized.raw ? ` (Raw response was: ${optimized.raw.substring(0, 50)}...)` : "";
        throw new Error(`${errorMsg}${details}`);
      }

      setOptimizedSeo(optimized);
    } catch (err: any) {
      console.error("SEO Optimization failed:", err);
      setError(err.message);
    } finally {
      setOptimizerLoading(false);
    }
  };

  const getHighlightUrl = (item: ScrapedItem) => {
    if (!result) return '#';
    const baseUrl = result.url.includes('#') ? result.url.split('#') [0] : result.url;
    const cleanText = item.text.substring(0, 50).replace(/[^\w\s]/g, '');
    
    let fragment = `#:~:text=${encodeURIComponent(cleanText)}`;
    if (item.context?.prefix) {
      fragment = `#:~:text=${encodeURIComponent(item.context.prefix.substring(0, 20))}-,${encodeURIComponent(cleanText)}`;
    }
    
    return `${baseUrl}${fragment}`;
  };

  const getConsoleCommand = (item: ScrapedItem) => {
    const escapedText = item.text.replace(/'/g, "\\'");
    return `(function() {
      const el = Array.from(document.querySelectorAll('h1')).find(h => h.textContent.includes('${escapedText}'));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '5px solid #1A1A1A';
        el.style.outlineOffset = '5px';
        el.style.backgroundColor = '#FFEB3B';
        console.log('H1 Highlighted:', el);
      } else {
        console.warn('H1 not found with text: ${escapedText}');
      }
    })()`;
  };

  const getSmartLocation = async (item: ScrapedItem, index: number) => {
    if (item.locationDescription) return;

    setAnalysisLoading(index);
    try {
      const prompt = `Analyze this HTML element and its selector path from a website. 
      Describe its visual location and role on the page in 8-12 words. Be specific about hierarchy.
      
      HTML: ${item.html}
      Selector Path: ${item.selector}
      
      Example outputs: 
      - "Main primary headline in the hero section at page top."
      - "Secondary heading found in a sidebar or promotional widget."
      - "Hidden heading used for accessibility in the navigation menu."`;

      const response = await fetch('/api/analyze-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider: aiProvider })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      const description = data.description || "Structural location analyzed.";
      
      setResult(prev => {
        if (!prev) return prev;
        const newItems = [...prev.items];
        newItems[index] = { ...newItems[index], locationDescription: description };
        return { ...prev, items: newItems };
      });
    } catch (err: any) {
      console.error("AI Analysis failed:", err);
    } finally {
      setAnalysisLoading(null);
    }
  };

  const handleScrape = async (e?: React.FormEvent, silent = false) => {
    if (e) e.preventDefault();
    if (!url) return;

    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
      setResult(null);
      setExpandedIndex(null);
      setOptimizedSeo(null);
      setPageDescriptionOverride('');
    }

    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape URL');
      }

      // Auto-detect page type (suggested only, don't overwrite user selection if they interact)
      const parsedUrl = new URL(targetUrl);
      const detectedPageType = (parsedUrl.pathname === '/' || parsedUrl.pathname === '') ? 'home' : 'other';
      
      if (silent && result) {
        setResult({
          ...result,
          count: data.count,
          items: data.items
        });
      } else {
        setResult(data);
        // Use the current pageType state from the UI buttons
        getOptimizedSeo(data, pageType);
      }
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const toggleExpand = (index: number) => {
    const isExpanding = expandedIndex !== index;
    setExpandedIndex(isExpanding ? index : null);
    if (isExpanding && result) {
      getSmartLocation(result.items[index], index);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans selection:bg-[#E4E3E0] selection:text-[#1A1A1A]">
      <header className="border-b border-[#E4E3E0] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded flex items-center justify-center">
              <Hash className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold tracking-tight text-lg">H1 Inspector</h1>
          </div>
          <div className="text-[11px] uppercase tracking-widest font-medium opacity-40">Technical Audit AI-Powered</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <section className="mb-px border border-[#E4E3E0] bg-white rounded-t-xl overflow-hidden p-8 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium tracking-tight mb-2 text-[#1A1A1A]">Analyze Website Structure</h2>
            <p className="text-[#6B6B6B] text-sm mb-8 leading-relaxed">
              Enter a URL to perform a technical audit. We'll crawl the page, extract all H1 tags, and use AI to determine their content hierarchy and visual location.
            </p>

            <div className="mb-6 max-w-[200px]">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] mb-2">Page Type</label>
              <div className="flex p-1 bg-[#F9F9F9] border border-[#E4E3E0] rounded h-10">
                <button
                  type="button"
                  onClick={() => setPageType('home')}
                  className={`flex-1 text-[9px] uppercase font-bold tracking-widest rounded transition-all ${pageType === 'home' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-[#F0F0EF]'}`}
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => setPageType('other')}
                  className={`flex-1 text-[9px] uppercase font-bold tracking-widest rounded transition-all ${pageType === 'other' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-[#F0F0EF]'}`}
                >
                  Other
                </button>
              </div>
            </div>

            <form onSubmit={handleScrape} className="relative group mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Globe className={`w-5 h-5 transition-colors duration-200 ${loading ? 'text-blue-500 animate-pulse' : 'text-[#A1A1A1] group-focus-within:text-[#1A1A1A]'}`} />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="domain.com or https://..."
                  className="w-full h-14 pl-12 pr-32 bg-[#F9F9F9] border border-[#E4E3E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent transition-all placeholder:text-[#A1A1A1] text-lg"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !url}
                  className="absolute right-2 top-2 bottom-2 px-6 bg-[#1A1A1A] text-white rounded-md font-medium text-sm hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? 'Analyzing...' : 'Audit'}</span>
                </button>
              </div>
            </form>

            <div className="mb-2">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] mb-2 flex items-center justify-between">
                Manual Page Context (Optional)
                <span className="font-normal normal-case text-[9px] opacity-60 text-right">Helps AI identify specific service/location focus</span>
              </label>
              <textarea 
                value={pageDescriptionOverride}
                onChange={(e) => setPageDescriptionOverride(e.target.value)}
                placeholder="e.g. This page is about Heat Pump installations in Richmond..."
                className="w-full min-h-[80px] p-4 bg-[#F9F9F9] border border-[#E4E3E0] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] placeholder:text-[#A1A1A1] transition-all resize-none"
              />
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-px bg-red-50 border border-red-100 p-4 flex items-start gap-4"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-900 font-medium text-sm">Audit Failed</p>
                <p className="text-red-700 text-xs mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {!result && !error && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-px border border-[#E4E3E0] bg-white/50 p-12 text-center rounded-b-xl"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white border border-[#E4E3E0] mb-4">
                <Layout className="w-6 h-6 text-[#A1A1A1]" />
              </div>
              <p className="text-sm font-medium text-[#6B6B6B]">Waiting for audit...</p>
              <p className="text-xs text-[#A1A1A1] mt-1">Crawler ready for target hostname.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-px flex flex-col gap-px"
            >
              <div className="bg-white border-x border-b border-[#E4E3E0] shadow-sm p-8 overflow-hidden rounded-b-xl flex flex-col justify-center relative">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1]">H1 Audit Status</div>
                  <button 
                    onClick={() => handleScrape(undefined, true)}
                    disabled={isRefreshing}
                    className="p-1 hover:bg-[#F9F9F9] border border-transparent hover:border-[#E4E3E0] rounded transition-all text-[#A1A1A1] hover:text-[#1A1A1A]"
                    title="Refresh Audit"
                  >
                    <RefreshCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-light ${result.count === 0 ? 'text-red-500' : result.count === 1 ? 'text-green-600' : 'text-orange-500'}`}>
                    {result.count}
                  </span>
                  <span className="text-xs font-medium opacity-40 uppercase tracking-tighter">Tags</span>
                </div>
                {result.count === 1 && (
                  <div className="mt-4 flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Optimal Hierarchy</span>
                  </div>
                )}
                {result.count > 1 && (
                  <div className="mt-4 flex items-center gap-2 text-orange-500">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Multiple H1s Found</span>
                  </div>
                )}
              </div>

              {/* SEO Strategy Optimizer Section */}
              {result.seo && (
                <div className="bg-white border-x border-b border-[#E4E3E0] p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]">AI SEO Strategy Optimizer</span>
                    </div>
                    <div className="text-[10px] text-[#A1A1A1] font-mono">Step 2: Business Optimization</div>
                  </div>

                  <div className="flex flex-col gap-6 mb-8 items-end">
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1]">AI Model Provider</label>
                        <div className="flex p-1 bg-[#F9F9F9] border border-[#E4E3E0] rounded h-8 min-w-[160px]">
                          <button
                            onClick={() => setAiProvider('groq')}
                            className={`flex-1 text-[8px] uppercase font-bold tracking-widest rounded transition-all flex items-center justify-center gap-1.5 ${aiProvider === 'groq' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-[#F0F0EF]'}`}
                          >
                            <Cpu className="w-2.5 h-2.5" />
                            Groq
                          </button>
                          <button
                            onClick={() => setAiProvider('gemini')}
                            className={`flex-1 text-[8px] uppercase font-bold tracking-widest rounded transition-all flex items-center justify-center gap-1.5 ${aiProvider === 'gemini' ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-[#F0F0EF]'}`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            Gemini
                          </button>
                        </div>
                      </div>
                      <label className="block text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] mb-2">Select Business Context</label>
                      <select 
                        value={selectedBusiness.name}
                        onChange={(e) => {
                          const biz = BUSINESS_CONTEXTS.find(b => b.name === e.target.value);
                          if (biz) setSelectedBusiness(biz);
                        }}
                        className="w-full h-11 px-4 bg-[#F9F9F9] border border-[#E4E3E0] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]"
                      >
                        {BUSINESS_CONTEXTS.map(biz => (
                          <option key={biz.name} value={biz.name}>{biz.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end mb-8">
                    <button 
                      onClick={getOptimizedSeo}
                      disabled={optimizerLoading}
                      className="px-8 h-11 bg-blue-600 text-white rounded font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {optimizerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate Optimized Strategy
                    </button>
                  </div>

                  <AnimatePresence>
                    {optimizedSeo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-6 pt-6 border-t border-[#F5F5F4]"
                      >
                        <div className="grid grid-cols-1 gap-6">
                          <div className="bg-blue-50/30 border border-blue-100 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-600 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" />
                                Optimized Title Tag
                              </h4>
                              <button 
                                onClick={() => copyToClipboard(optimizedSeo.title, 'opt-title')}
                                className="text-[9px] font-bold uppercase tracking-tight px-2 py-1 bg-white border border-blue-100 rounded flex items-center gap-1 hover:bg-white/80 transition-colors"
                              >
                                {copiedKey === 'opt-title' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                Copy
                              </button>
                            </div>
                            <p className="text-sm font-medium text-[#1A1A1A] leading-relaxed">{optimizedSeo.title}</p>
                          </div>

                          <div className="bg-blue-50/30 border border-blue-100 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-600 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" />
                                Optimized Meta Description
                              </h4>
                              <button 
                                onClick={() => copyToClipboard(optimizedSeo.description, 'opt-desc')}
                                className="text-[9px] font-bold uppercase tracking-tight px-2 py-1 bg-white border border-blue-100 rounded flex items-center gap-1 hover:bg-white/80 transition-colors"
                              >
                                {copiedKey === 'opt-desc' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                Copy
                              </button>
                            </div>
                            <p className="text-sm text-[#444] leading-relaxed">{optimizedSeo.description}</p>
                          </div>

                          <div className="bg-blue-50/30 border border-blue-100 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-600 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" />
                                30 Optimized Keywords
                              </h4>
                              <button 
                                onClick={() => copyToClipboard(optimizedSeo.keywords, 'opt-kw')}
                                className="text-[9px] font-bold uppercase tracking-tight px-2 py-1 bg-white border border-blue-100 rounded flex items-center gap-1 hover:bg-white/80 transition-colors"
                              >
                                {copiedKey === 'opt-kw' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                Copy All
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {optimizedSeo.keywords.split(',').map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-blue-100 text-[10px] font-mono rounded text-blue-800">
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="bg-white border-x border-b border-[#E4E3E0] rounded-b-xl overflow-hidden shadow-sm">
                <div className="px-8 py-4 border-b border-[#F5F5F4] bg-[#F9F9F9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-[#A1A1A1]" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]">H1 Elements & Smart Analysis</span>
                  </div>
                </div>

                <div className="divide-y divide-[#F5F5F4]">
                  {result.items && result.items.length > 0 ? (
                    result.items.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex flex-col group"
                      >
                        <button
                          onClick={() => toggleExpand(index)}
                          className="w-full text-left p-6 flex items-start gap-4 hover:bg-[#F9F9F9] transition-all cursor-pointer relative"
                        >
                          <div className={`w-8 h-8 rounded border border-[#E4E3E0] flex items-center justify-center text-[11px] font-mono font-bold transition-all shrink-0 ${expandedIndex === index ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-[#F5F5F4] text-[#A1A1A1]'}`}>
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <div className="flex-1 pt-1 overflow-hidden">
                            <p className={`text-lg font-medium leading-tight underline decoration-[#E4E3E0] decoration-2 underline-offset-4 group-hover:decoration-[#1A1A1A] transition-all break-words ${expandedIndex === index ? 'text-[#1A1A1A] decoration-[#1A1A1A]' : 'text-[#444]'}`}>
                              {item.text}
                            </p>
                            {item.locationDescription && (
                              <p className="text-[11px] text-blue-600 font-medium mt-1.5 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" />
                                {item.locationDescription}
                              </p>
                            )}
                          </div>
                          <ChevronRight className={`w-5 h-5 text-[#E4E3E0] transition-transform duration-300 ${expandedIndex === index ? 'rotate-90 text-[#1A1A1A]' : 'text-[#A1A1A1]'}`} />
                        </button>
                        
                        <AnimatePresence>
                          {expandedIndex === index && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-[#F9F9F9] border-t border-[#F5F5F4]"
                            >
                              <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] flex items-center gap-2">
                                        <Hash className="w-3 h-3" />
                                        DOM Selector Path
                                      </h4>
                                      <button 
                                        onClick={() => copyToClipboard(item.selector, `sel-${index}`)}
                                        className="p-1 hover:bg-[#E4E3E0] rounded transition-colors text-[#A1A1A1] hover:text-[#1A1A1A]"
                                        title="Copy selector for DevTools"
                                      >
                                        {copiedKey === `sel-${index}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                    <div className="bg-[#1A1A1A] text-[#D1D5DB] p-4 rounded-md font-mono text-[10px] overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner border border-white/5 group/code cursor-text flex justify-between items-start">
                                      <span className="flex-1">{item.selector}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] mb-3 flex items-center gap-2">
                                      <Sparkles className="w-3 h-3" />
                                      Smart Insight
                                    </h4>
                                    <div className="h-full flex flex-col justify-between gap-4">
                                      <div className="p-4 bg-white border border-[#E4E3E0] rounded-md shadow-sm">
                                        <p className="text-xs leading-relaxed text-[#1A1A1A]">
                                          {analysisLoading === index ? (
                                            <span className="flex items-center gap-2 text-[#A1A1A1]">
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              AI is analyzing hierarchy...
                                            </span>
                                          ) : item.locationDescription || "Analysis pending..."}
                                        </p>
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <a 
                                          href={getHighlightUrl(item)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={() => copyToClipboard(item.text, `text-${index}`)}
                                          className="w-full py-3 px-4 bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-black transition-all flex items-center justify-center gap-2 text-center"
                                        >
                                          Deep Link Highlight <Globe className="w-3 h-3" />
                                        </a>
                                        <button 
                                          onClick={() => copyToClipboard(getConsoleCommand(item), `console-${index}`)}
                                          className="w-full py-2.5 px-4 bg-white border border-[#E4E3E0] text-[#1A1A1A] text-[9px] font-bold uppercase tracking-widest rounded-md hover:bg-[#F5F5F4] transition-all flex items-center justify-center gap-2"
                                        >
                                          {copiedKey === `console-${index}` ? <Check className="w-3 h-3 text-green-600" /> : <Hash className="w-3 h-3" />}
                                          Copy Console Command
                                        </button>
                                        <p className="text-[9px] text-[#A1A1A1] leading-relaxed italic px-1 mt-1">
                                          <strong>Note:</strong> Some sites clear URL highlights on load. If it vanishes, use the <strong>Console Command</strong> above in your browser's DevTools.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#A1A1A1] flex items-center gap-2">
                                      <List className="w-3 h-3" />
                                      HTML Fragment
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => copyToClipboard(item.text, `text-${index}`)}
                                        className="text-[9px] font-bold uppercase tracking-tight px-2 py-1 bg-white border border-[#E4E3E0] rounded flex items-center gap-1 hover:bg-[#F5F5F4] transition-colors"
                                      >
                                        {copiedKey === `text-${index}` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                        Copy Inner Text
                                      </button>
                                    </div>
                                  </div>
                                  <div className="bg-[#1A1A1A] text-[#10B981] p-4 rounded-md font-mono text-[10px] overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner border border-white/5">
                                    {item.html}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-[#A1A1A1] text-sm italic">No H1 tags detected on this URL.</p>
                      <p className="text-[10px] text-[#A1A1A1] mt-2 uppercase tracking-widest font-bold">Audit Tip: This page might be missing a primary semantic headline.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 opacity-30 flex items-center justify-center gap-8">
          <div className="text-[9px] uppercase font-black tracking-[0.2em]">Crawled via Cheerio</div>
          <div className="w-1 h-1 bg-black rounded-full" />
          <div className="text-[9px] uppercase font-black tracking-[0.2em]">Analyzed via {aiProvider === 'groq' ? 'Llama 3' : 'Gemini 3'}</div>
          <div className="w-1 h-1 bg-black rounded-full" />
          <div className="text-[9px] uppercase font-black tracking-[0.2em]">Verified SEO Hierarchy</div>
        </footer>
      </main>
    </div>
  );
}
