'use client';

import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { setupListeners } from '@reduxjs/toolkit/query';
import { PersistGate } from 'redux-persist/integration/react';
import type { Persistor } from 'redux-persist';
import { makePersistor, makeStore, type AppStore } from './store';
import { realtimeInit } from './middleware/socketMiddleware';

/**
 * Instantiates the Redux store once per client (via refs so re-renders don't
 * rebuild it), rehydrates the persisted domain with redux-persist, wires RTK
 * Query's focus/reconnect refetch listeners, and boots the realtime bus.
 *
 * PersistGate holds render until localStorage has been read, so the first paint
 * already reflects the user's saved hierarchy/statuses/tasks rather than flashing
 * defaults then swapping.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  const persistorRef = useRef<Persistor | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
    persistorRef.current = makePersistor(storeRef.current);
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;
    const unlisten = setupListeners(store.dispatch);
    store.dispatch(realtimeInit());
    return unlisten;
  }, []);

  return (
    <Provider store={storeRef.current}>
      <PersistGate loading={null} persistor={persistorRef.current!}>
        {children}
      </PersistGate>
    </Provider>
  );
}
