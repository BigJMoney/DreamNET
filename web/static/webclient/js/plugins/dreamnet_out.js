/*
DreamNET output interception plugin for the Evennia webclient.
- Must be loaded before default_out.js
- Must return true from handled callbacks to stop default_out
*/


(function () {
  const pluginId = "dreamnet_out";

  function hasBridge() {
    return !!(window.dreamnet && window.dreamnet.output && typeof window.dreamnet.output.ingest === "function");
  }

  function ingest(text, reason) {
    if (!hasBridge()) {
      console.warn(`[${pluginId}] dreamnet output bridge missing; dropped output`, { reason });
      return;
    }
    window.dreamnet.output.ingest(String(text ?? ""), reason);
  }

  // Evennia plugin registration
  const Evennia = window.Evennia;
  if (!Evennia) {
    console.warn(`[${pluginId}] window.Evennia missing; plugin not registered`);
    return;
  }

  // v5 webclient uses a plugin handler; this is the common pattern:
  // Evennia.plugin_handler.add("name", pluginObject)
  const ph = window.plugin_handler;
  if (!ph || typeof ph.add !== "function") {
    console.warn(`[${pluginId}] Evennia.plugin_handler.add missing; cannot register`);
    return;
  }

  ph.add(pluginId, {
    // Required by Evennia plugin callback API
    init() {
      console.log(`[${pluginId}] init`);
    },

    // Text output from server
    onText(args, kwargs) {
      // Evennia often passes args as an array of strings.
      // Be defensive and join if needed.
      let text = args;
      if (Array.isArray(args)) text = args.join("");
      ingest(text, "evennia:onText");
      return true; // short-circuit default_out
    },

    // Prompt output (if Evennia sends a prompt separately)
    onPrompt(args, kwargs) {
      let text = args;
      if (Array.isArray(args)) text = args.join("");
      ingest(text, "evennia:onPrompt");
      return true;
    },

    // Optional: error/info messages, depending on Evennia’s routing
    onSystem(args, kwargs) {
      let text = args;
      if (Array.isArray(args)) text = args.join("");
      ingest(text, "evennia:onSystem");
      return true;
    },
  });

  console.log(`[${pluginId}] registered`);
})();
