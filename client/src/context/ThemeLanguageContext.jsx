import { createContext, useContext, useEffect, useState, useRef } from 'react';
import api from '../services/api';

const ThemeLanguageContext = createContext(null);

export const useThemeLanguage = () => {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error('useThemeLanguage debe ser utilizado dentro de un ThemeLanguageProvider');
  }
  return context;
};

// Symbols or custom keys to save original text safely
const ORIGINAL_TEXT_KEY = '__originalText';
const ORIGINAL_PLACEHOLDER_KEY = '__originalPlaceholder';
const TRANSLATED_TEXT_SET = new Set(); // Keeps track of English translations to avoid translating them

export const ThemeLanguageProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  const [isEnglish, setIsEnglish] = useState(() => {
    return localStorage.getItem('isEnglish') === 'true';
  });

  const translationQueueRef = useRef([]);
  const batchTimeoutRef = useRef(null);
  const observerRef = useRef(null);

  // 1. Dark Mode Toggler
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // 2. Client Translation Cache
  const translationCache = useRef({});

  // 3. Batch Translate Scheduler
  const processBatchQueue = async () => {
    const queue = translationQueueRef.current;
    if (queue.length === 0) return;

    // Reset queue for next batch
    translationQueueRef.current = [];
    batchTimeoutRef.current = null;

    // Extract unique texts to translate
    const uniqueTexts = Array.from(new Set(queue.map(item => item.text)));
    if (uniqueTexts.length === 0) return;

    try {
      const response = await api.post('/translate', { texts: uniqueTexts, target: 'en' });
      const translations = response.data?.data?.translations || [];

      // Create a lookup map
      const translationMap = {};
      uniqueTexts.forEach((text, index) => {
        translationMap[text] = translations[index] || text;
        // Save in global caches
        translationCache.current[text] = translations[index] || text;
        TRANSLATED_TEXT_SET.add(translations[index]);
      });

      // Apply translations to the queued nodes
      queue.forEach(item => {
        const translated = translationMap[item.text];
        if (!translated) return;

        if (item.isPlaceholder) {
          item.node.placeholder = translated;
        } else {
          item.node.__isTranslating = true;
          item.node.nodeValue = translated;
        }
      });
    } catch (err) {
      console.error('Error al procesar lote de traducciones:', err);
    }
  };

  const scheduleTranslation = (text, node, isPlaceholder = false) => {
    translationQueueRef.current.push({ text, node, isPlaceholder });
    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(processBatchQueue, 80);
    }
  };

  // 4. DOM Crawler (Recursive Spanish-to-English translation)
  const translateNode = (node) => {
    // Skip interactive/non-visible tags
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'PATH', 'VIDEO', 'AUDIO', 'IMG', 'BUTTON-THEME-TOGGLE'];
    if (node.nodeType === 1 && skipTags.includes(node.tagName)) {
      return;
    }

    // Translate Placeholders for Input / Textarea
    if (node.nodeType === 1 && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
      const placeholder = node.getAttribute('placeholder');
      if (placeholder && placeholder.trim()) {
        const trimmed = placeholder.trim();
        // Ignore placeholders that are already English translations
        if (TRANSLATED_TEXT_SET.has(trimmed)) return;

        if (node[ORIGINAL_PLACEHOLDER_KEY] === undefined) {
          node[ORIGINAL_PLACEHOLDER_KEY] = placeholder;
        }

        const cached = translationCache.current[trimmed];
        if (cached) {
          node.placeholder = cached;
        } else {
          scheduleTranslation(trimmed, node, true);
        }
      }
    }

    // Translate Text Nodes (nodeType === 3)
    if (node.nodeType === 3) {
      const val = node.nodeValue;
      if (!val || !val.trim()) return;

      const trimmed = val.trim();
      
      // Skip strings that are purely numeric, date-like, or punctuation
      if (/^[0-9\/\-:\s.,\(\)]+$/.test(trimmed)) return;

      // Skip if this text node is already in English
      if (TRANSLATED_TEXT_SET.has(trimmed)) return;

      // Save original Spanish text if not already saved
      if (node[ORIGINAL_TEXT_KEY] === undefined) {
        node[ORIGINAL_TEXT_KEY] = val;
      }

      const cached = translationCache.current[trimmed];
      if (cached) {
        node.__isTranslating = true;
        // Keep potential surrounding spacing from original node value
        const leadingSpace = val.match(/^\s*/)?.[0] || '';
        const trailingSpace = val.match(/\s*$/)?.[0] || '';
        node.nodeValue = leadingSpace + cached + trailingSpace;
      } else {
        scheduleTranslation(trimmed, node, false);
      }
    }

    // Recurse into children
    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(translateNode);
    }
  };

  // 5. DOM Restoration (Flawlessly restore original Spanish text)
  const restoreSpanish = (node) => {
    if (node.nodeType === 1 && node[ORIGINAL_PLACEHOLDER_KEY] !== undefined) {
      node.placeholder = node[ORIGINAL_PLACEHOLDER_KEY];
    }

    if (node.nodeType === 3 && node[ORIGINAL_TEXT_KEY] !== undefined) {
      node.__isTranslating = true;
      node.nodeValue = node[ORIGINAL_TEXT_KEY];
    }

    if (node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(restoreSpanish);
    }
  };

  // 6. Hook up the engine when translation toggles
  useEffect(() => {
    localStorage.setItem('isEnglish', isEnglish);
    
    const rootElement = document.getElementById('root') || document.body;

    if (isEnglish) {
      // Crawl and translate existing elements
      translateNode(rootElement);

      // Start observer for dynamic client-side updates (React virtual DOM updates)
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              translateNode(node);
            });
          } else if (mutation.type === 'characterData') {
            const node = mutation.target;
            // Prevent infinite loop if we are the ones updating the text node
            if (node.__isTranslating) {
              node.__isTranslating = false;
              return;
            }

            const val = node.nodeValue;
            if (val && val.trim()) {
              const trimmed = val.trim();
              if (TRANSLATED_TEXT_SET.has(trimmed)) return;

              // Save the new value as the new original text (since React replaced it)
              node[ORIGINAL_TEXT_KEY] = val;

              // Translate it
              const cached = translationCache.current[trimmed];
              if (cached) {
                node.__isTranslating = true;
                const leadingSpace = val.match(/^\s*/)?.[0] || '';
                const trailingSpace = val.match(/\s*$/)?.[0] || '';
                node.nodeValue = leadingSpace + cached + trailingSpace;
              } else {
                scheduleTranslation(trimmed, node, false);
              }
            }
          }
        });
      });

      observer.observe(rootElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      observerRef.current = observer;
    } else {
      // Disconnect observer first
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      
      // Cancel any pending batches
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      translationQueueRef.current = [];

      // Restore all text elements back to Spanish
      restoreSpanish(rootElement);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isEnglish]);

  return (
    <ThemeLanguageContext.Provider value={{ darkMode, setDarkMode, isEnglish, setIsEnglish }}>
      {children}
    </ThemeLanguageContext.Provider>
  );
};
