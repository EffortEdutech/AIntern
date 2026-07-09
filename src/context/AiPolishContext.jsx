/**
 * AIntern - AI Polish Context
 *
 * Opt-in bridge between page-level AI configuration and the template
 * engine's textarea fields. A page wraps DynamicForm in
 * <AiPolishProvider polish={fn}> and every textarea grows a ✨ Polish
 * button (see the marked AINTERN block in FieldRenderer.jsx).
 *
 * Kept as a separate file so the engine change is a minimal, clearly
 * bounded addition — cherry-picks from WorkLedger remain easy.
 *
 * @file src/context/AiPolishContext.jsx
 * @created July 9, 2026 - Session 4
 */

import { createContext, useContext } from 'react';

/**
 * Context value shape: { polish: async (text) => ({ success, text, error }) }
 * or null when no provider is mounted (engine renders plain textareas).
 */
export const AiPolishContext = createContext(null);

export function AiPolishProvider({ polish, children }) {
  return (
    <AiPolishContext.Provider value={{ polish }}>
      {children}
    </AiPolishContext.Provider>
  );
}

export function useAiPolish() {
  return useContext(AiPolishContext); // null when not provided — by design
}

export default AiPolishContext;
