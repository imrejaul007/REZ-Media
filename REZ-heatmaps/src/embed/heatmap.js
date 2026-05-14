/**
 * REZ Heatmaps - Embeddable Tracker
 * Lightweight JavaScript for tracking clicks, scrolls, and mouse movements
 *
 * Usage:
 * <script src="https://your-heatmap-server.com/embed/heatmap.js?websiteId=YOUR_ID"></script>
 */
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    endpoint: '',  // Will be auto-detected or set explicitly
    batchSize: 10,
    batchInterval: 5000,
    scrollThrottle: 500,
    movementThrottle: 100,
    maxMovementPoints: 100,
    sessionTimeout: 1800000, // 30 minutes
    sampleRate: 1, // 100% sampling by default
  };

  // State
  let state = {
    sessionId: null,
    pageId: null,
    websiteId: null,
    initialized: false,
    batchQueue: {
      clicks: [],
      scrolls: [],
      movements: [],
      pageviews: []
    },
    lastScrollDepth: 0,
    maxScrollDepth: 0,
    movementIndex: 0,
    sessionStartTime: null,
    sessionTimeoutId: null,
  };

  // Utility functions
  const utils = {
    uuid: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    debounce: function(func, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
          func.apply(context, args);
        }, wait);
      };
    },

    throttle: function(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(function() {
            inThrottle = false;
          }, limit);
        }
      };
    },

    getViewportSize: function() {
      return {
        width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
        height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
      };
    },

    getScrollDepth: function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const docHeight = Math.max(
        document.body.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.body.offsetHeight || 0,
        document.documentElement.offsetHeight || 0
      );
      const viewHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollableHeight = docHeight - viewHeight;

      if (scrollableHeight <= 0) return 100;
      return Math.min(100, Math.round((scrollTop / scrollableHeight) * 100));
    },

    getElementInfo: function(element) {
      if (!element || element === document) return {};

      const rect = element.getBoundingClientRect();
      return {
        elementX: Math.round(rect.left),
        elementY: Math.round(rect.top),
        elementTag: element.tagName ? element.tagName.toLowerCase() : undefined,
        elementId: element.id || undefined,
        elementClass: element.className && typeof element.className === 'string'
          ? element.className.split(' ').slice(0, 3).join(' ')
          : undefined
      };
    },

    shouldTrack: function() {
      if (Math.random() > CONFIG.sampleRate) return false;
      return true;
    }
  };

  // API functions
  const api = {
    queue: function(type, data) {
      if (!state.initialized || !state.websiteId) return;

      state.batchQueue[type].push({
        ...data,
        sessionId: state.sessionId,
        pageId: state.pageId,
        websiteId: state.websiteId,
        timestamp: Date.now()
      });

      if (state.batchQueue[type].length >= CONFIG.batchSize) {
        this.flush();
      }
    },

    send: function(data) {
      const endpoint = CONFIG.endpoint + '/api/track/' + data.type;
      const payload = data.payload;

      // Use sendBeacon for reliability, fallback to fetch
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function() {});
      }
    },

    flush: function() {
      const queues = state.batchQueue;

      // Send each type
      ['clicks', 'scrolls', 'movements', 'pageviews'].forEach(function(type) {
        const queue = queues[type];
        if (queue.length > 0) {
          // Send as batch
          api.send({
            type: type === 'pageviews' ? 'pageview' : type === 'clicks' ? 'click' : type.slice(0, -1),
            payload: queue
          });
          queue.length = 0;
        }
      });
    }
  };

  // Event handlers
  const handlers = {
    click: function(e) {
      if (!utils.shouldTrack()) return;

      const target = e.target || e.srcElement;
      const elementInfo = utils.getElementInfo(target);

      api.queue('clicks', {
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        viewportWidth: utils.getViewportSize().width,
        viewportHeight: utils.getViewportSize().height,
        ...elementInfo
      });
    },

    scroll: utils.throttle(function(e) {
      if (!utils.shouldTrack()) return;

      const depth = utils.getScrollDepth();

      // Only track if depth changed significantly
      if (depth > state.lastScrollDepth + 5 || depth === 100 && state.lastScrollDepth < 100) {
        const viewport = utils.getViewportSize();
        const docHeight = Math.max(
          document.body.scrollHeight || 0,
          document.documentElement.scrollHeight || 0
        );

        api.queue('scrolls', {
          scrollDepth: depth,
          maxScrollDepth: Math.max(depth, state.maxScrollDepth),
          viewportHeight: viewport.height,
          documentHeight: docHeight
        });

        state.lastScrollDepth = depth;
        state.maxScrollDepth = Math.max(depth, state.maxScrollDepth);
      }
    }, CONFIG.scrollThrottle),

    movement: utils.throttle(function(e) {
      if (!utils.shouldTrack()) return;

      // Limit movement tracking
      state.movementIndex++;
      if (state.movementIndex % 5 !== 0) return;

      api.queue('movements', {
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        throttleIndex: state.movementIndex
      });
    }, CONFIG.movementThrottle),

    pageview: function() {
      if (!utils.shouldTrack()) return;

      const viewport = utils.getViewportSize();

      api.queue('pageviews', {
        url: window.location.href,
        referrer: document.referrer || undefined,
        title: document.title || undefined,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height
      });
    },

    visibilitychange: function() {
      if (document.visibilityState === 'hidden') {
        api.flush();
        handlers.sessionEnd();
      }
    },

    beforeunload: function() {
      api.flush();
    },

    sessionEnd: function() {
      if (!state.sessionId) return;

      // End session via beacon
      const endpoint = CONFIG.endpoint + '/api/track/session/end';
      const payload = { sessionId: state.sessionId };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(payload));
      }
    }
  };

  // Session management
  const session = {
    create: function() {
      state.sessionId = utils.uuid();
      state.pageId = utils.uuid();
      state.sessionStartTime = Date.now();

      // Set session timeout
      state.sessionTimeoutId = setTimeout(function() {
        handlers.sessionEnd();
        session.create();
      }, CONFIG.sessionTimeout);

      // Track initial page view
      handlers.pageview();
    },

    resetPage: function() {
      state.pageId = utils.uuid();
      state.lastScrollDepth = 0;
      state.maxScrollDepth = 0;
      handlers.pageview();
    }
  };

  // Initialization
  function init(websiteId, options) {
    if (state.initialized) return;

    // Apply options
    Object.keys(options || {}).forEach(function(key) {
      if (CONFIG.hasOwnProperty(key)) {
        CONFIG[key] = options[key];
      }
    });

    // Auto-detect endpoint
    if (!CONFIG.endpoint) {
      var scripts = document.getElementsByTagName('script');
      var currentScript = scripts[scripts.length - 1];
      var src = currentScript ? currentScript.src : '';

      if (src) {
        var match = src.match(/^(https?:\/\/[^\/]+)/);
        CONFIG.endpoint = match ? match[1] : window.location.origin;
      } else {
        CONFIG.endpoint = window.location.origin;
      }
    }

    state.websiteId = websiteId;
    state.initialized = true;

    // Create session
    session.create();

    // Attach event listeners
    document.addEventListener('click', handlers.click, true);
    document.addEventListener('mousemove', handlers.movement, true);
    window.addEventListener('scroll', handlers.scroll, { passive: true });
    document.addEventListener('visibilitychange', handlers.visibilitychange);
    window.addEventListener('beforeunload', handlers.beforeunload);

    // Periodic batch flush
    setInterval(function() {
      api.flush();
    }, CONFIG.batchInterval);

    // Track SPA navigation (optional)
    if (options && options.trackSPA) {
      history.pushState = (function(original) {
        return function() {
          original.apply(this, arguments);
          session.resetPage();
        };
      })(history.pushState);

      window.addEventListener('popstate', function() {
        session.resetPage();
      });
    }

    console.log('[REZ Heatmaps] Initialized for website:', websiteId);
  }

  // Expose public API
  window.REZHeatmaps = {
    init: init,
    track: {
      click: handlers.click,
      scroll: handlers.scroll,
      movement: handlers.movement,
      pageview: handlers.pageview
    },
    session: {
      end: handlers.sessionEnd,
      refresh: session.resetPage
    },
    config: function(options) {
      Object.keys(options || {}).forEach(function(key) {
        if (CONFIG.hasOwnProperty(key)) {
          CONFIG[key] = options[key];
        }
      });
    }
  };

  // Auto-initialize from script tag
  (function() {
    var scripts = document.getElementsByTagName('script');
    var currentScript = scripts[scripts.length - 1];
    var websiteId = currentScript ? currentScript.getAttribute('data-website-id') : null;

    if (currentScript && currentScript.src) {
      var params = new URL(currentScript.src).searchParams;
      websiteId = websiteId || params.get('websiteId');

      if (websiteId) {
        // Wait for DOM ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            init(websiteId);
          });
        } else {
          init(websiteId);
        }
      }
    }
  })();
})();
