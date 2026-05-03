import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGroq = () => {
  const apiKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
  return apiKey ? new Groq({ apiKey }) : null;
};

const getGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing from environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Starting server with environment keys:", Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')));

  app.use(express.json());

  // API endpoint for scraping
  app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Basic URL validation
      const validUrl = new URL(url);
      
      const response = await axios.get(validUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });

      const $ = cheerio.load(response.data);
      const h1s: { text: string; selector: string; html: string; context?: { prefix: string; suffix: string } }[] = [];

      // Extract SEO Metadata
      const seo = {
        title: $('title').text() || 'No title found',
        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || 'No description found',
        keywords: $('meta[name="keywords"]').attr('content') || 'No keywords found'
      };

      $('h1').each((i, element) => {
        const text = $(element).text().trim();
        if (text) {
          // Build a more robust selector path
          const path: string[] = [];
          
          // Get some context for better anchoring
          const prevText = $(element).prev().text().trim().substring(0, 30);
          const nextText = $(element).next().text().trim().substring(0, 30);
          
          const elId = $(element).attr('id');
          const elClass = $(element).attr('class')?.split(' ')[0];
          let elSelector = 'h1';
          if (elId) elSelector += `#${elId}`;
          if (elClass) elSelector += `.${elClass}`;
          
          $(element).parents().slice(0, 4).each((_, parent) => {
            const tagName = (parent as any).tagName;
            const id = $(parent).attr('id');
            const klass = $(parent).attr('class')?.split(' ')[0];
            path.unshift(`${tagName}${id ? '#' + id : ''}${klass ? '.' + klass : ''}`);
          });
          path.push(elSelector);

          h1s.push({
            text,
            selector: path.join(' > '),
            html: $.html(element),
            context: {
              prefix: prevText,
              suffix: nextText
            }
          });
        }
      });

      res.json({
        url: validUrl.toString(),
        count: h1s.length,
        items: h1s,
        seo
      });
    } catch (error: any) {
      console.error('Scraping error:', error.message);
      res.status(500).json({ 
        error: 'Failed to scrape the URL', 
        details: error.message 
      });
    }
  });

  // API endpoint for SEO optimization
  app.post('/api/optimize-seo', async (req, res) => {
    const { prompt, provider } = req.body;
    console.log(`Optimizing SEO using ${provider}...`);

    try {
      if (provider === 'groq') {
        const groq = getGroq();
        if (!groq) return res.status(400).json({ error: "Groq API Key is missing on the server. Please add it to your Secrets." });
        
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are an expert SEO specialist. Always respond with raw JSON only, no markdown formatting."
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
        });

        const content = chatCompletion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from Groq");
        
        console.log("Groq raw content:", content);
        
        try {
          // Clean JSON formatting
          const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
          res.json(JSON.parse(cleaned));
        } catch (parseError) {
          console.error("JSON Parse Error (Groq):", parseError);
          res.status(500).json({ error: "Invalid JSON response from AI", raw: content });
        }
      } else {
        const ai = getGemini();
        if (!ai) return res.status(400).json({ error: "Gemini API is not configured on the server." });
        
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an expert SEO specialist. Always respond with raw JSON only, no markdown formatting. The JSON must match the requested schema exactly.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                keywords: { type: Type.STRING }
              },
              required: ["title", "description", "keywords"]
            }
          }
        });
        
        const text = response.text;
        if (!text) throw new Error("No response from Gemini");
        
        console.log("Gemini raw text:", text);
        
        try {
          res.json(JSON.parse(text));
        } catch (parseError) {
          console.error("JSON Parse Error (Gemini):", parseError);
          res.status(500).json({ error: "Invalid JSON response from AI", raw: text });
        }
      }
    } catch (error: any) {
      console.error('SEO Optimization error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint for element analysis
  app.post('/api/analyze-element', async (req, res) => {
    const { prompt, provider } = req.body;
    console.log(`Analyzing element using ${provider}...`);

    try {
      if (provider === 'groq') {
        const groq = getGroq();
        if (!groq) return res.status(400).json({ error: "Groq API Key (VITE_GROQ_API_KEY) is missing on the server." });
        
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a web structure analyst. Provide short, specific descriptions of HTML element locations."
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "llama-3.1-8b-instant",
        });

        const description = chatCompletion.choices[0]?.message?.content || "Structural location analyzed.";
        res.json({ description });
      } else {
        const ai = getGemini();
        if (!ai) return res.status(400).json({ error: "Gemini API is not configured on the server." });
        
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are a web structure analyst. Provide short, specific descriptions of HTML element locations."
          }
        });
        
        const description = response.text || "Structural location analyzed.";
        res.json({ description });
      }
    } catch (error: any) {
      console.error('Element analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
